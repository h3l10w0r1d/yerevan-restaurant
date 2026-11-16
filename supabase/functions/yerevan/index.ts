// Yerevan restaurant API on Supabase Edge Functions. The public site is served by Cloudflare Pages,
// which proxies /api/*, /blog* and /sitemap.xml here. Port of the FastAPI app in backend/app.
import { Hono, Context } from "npm:hono@4.6.14";
import { cors } from "npm:hono@4.6.14/cors";
import {
  addDays, config, dayBookings, fail, freeSeats, getSettings, HttpError, nowLocal, peakSeated, publicMenu, sha256,
  slotsFor, slugifyId, sql, toMin, today, uniqueId, utcNow, validate, validDate,
} from "./lib.ts";
import * as emails from "./emails.ts";
import { auth, MANAGER, requireRole, STAFF } from "./auth.ts";
import { blog, intParam } from "./blog.ts";
import { seo } from "./seo.ts";

const RES_STATUSES = ["pending", "confirmed", "seated", "completed", "cancelled", "no_show"];
const ORDER_STATUSES = ["pending", "confirmed", "ready", "completed", "cancelled"];
const BADGES = ["popular", "signature", "new", "spicy"];
const ACTIVE = ["pending", "confirmed", "seated", "completed"];
const HHMM = /^\d{2}:\d{2}$/;
const json = (c: Context) => c.req.json().catch(() => null);

const api = new Hono();

// --- Public -----------------------------------------------------------------------

api.get("/api/health", (c) => c.json({ status: "ok" }));

api.get("/api/info", async (c) => {
  const s = await getSettings();
  return c.json({
    ...s.restaurant, hours: s.hours, ordering_enabled: s.ordering_enabled, max_party_size: s.max_party_size,
    booking_window_days: s.booking_window_days, prelaunch: s.prelaunch, opening_date: s.opening_date || null,
  });
});

api.get("/api/menu", async (c) => {
  if ((await getSettings()).prelaunch) return c.json({ currency: "EUR", categories: [], prelaunch: true });
  return c.json(await publicMenu());
});

api.get("/api/images/:id", async (c) => {
  const [img] = await sql`select content_type, data from image where id = ${c.req.param("id")}`;
  if (!img) fail(404, "not_found");
  return new Response(img.data, {
    headers: { "Content-Type": img.content_type, "X-Content-Type": img.content_type, "Cache-Control": "public, max-age=31536000, immutable" },
  });
});

api.get("/api/availability", async (c) => {
  const day = c.req.query("date");
  if (!validDate(day)) fail(422, [{ loc: ["query", "date"], msg: "Input should be a valid date" }]);
  const g = c.req.query("guests") ?? "2";
  if (!/^\d+$/.test(g) || +g < 1 || +g > 50) fail(422, [{ loc: ["query", "guests"], msg: "Input should be between 1 and 50" }]);
  const guests = Number(g);
  const s = await getSettings();
  const now = nowLocal();
  const bookings = await dayBookings(day!);
  const slots = slotsFor(day!, s).map((slot) => ({
    time: slot, available: `${day}T${slot}:00` > now && freeSeats(bookings, slot, s) >= guests,
  }));
  return c.json({ date: day, slots });
});

api.post("/api/reservations", async (c) => {
  const b = validate<any>(await json(c), {
    name: { min: 2, max: 120 }, email: { email: true, max: 320 }, phone: { min: 6, max: 40 }, date: {},
    time: { re: HHMM }, guests: { type: "int", min: 1, max: 50 }, notes: { max: 500, optional: true }, language: { max: 5, def: "en" },
  });
  if (!validDate(b.date)) fail(422, [{ loc: ["body", "date"], msg: "Input should be a valid date" }]);
  const s = await getSettings();
  if (s.prelaunch) fail(503, "not_yet_open");
  const t = today();
  if (b.guests > s.max_party_size) fail(422, "party_too_large");
  if (b.date < t || b.date > addDays(t, s.booking_window_days)) fail(422, "date_out_of_range");
  if (!slotsFor(b.date, s).includes(b.time)) fail(422, "closed");
  if (`${b.date}T${b.time}:00` <= nowLocal()) fail(422, "in_past");
  if (freeSeats(await dayBookings(b.date), b.time, s) < b.guests) fail(409, "fully_booked");
  const [r] = await sql`insert into reservation ${sql({
    name: b.name, email: b.email.trim(), phone: b.phone, date: b.date, time: b.time, guests: b.guests, notes: b.notes,
    internal_note: null, language: b.language, source: "web", status: "pending", created_at: utcNow(),
  })} returning *`;
  await emails.reservationReceived(r);
  await emails.staffNewReservation(r);
  return c.json(r, 201);
});

api.post("/api/orders", async (c) => {
  const b = validate<any>(await json(c), {
    name: { min: 2, max: 120 }, email: { email: true, max: 320 }, phone: { min: 6, max: 40 }, pickup_at: {},
    items: { type: "list", min: 1 }, notes: { max: 500, optional: true }, language: { max: 5, def: "en" },
  });
  const s = await getSettings();
  if (s.prelaunch) fail(503, "not_yet_open");
  if (!s.ordering_enabled) fail(503, "ordering_disabled");
  const lines = [];
  let total = 0;
  for (const line of b.items) {
    const l = validate<any>(line, { item_id: {}, quantity: { type: "int", min: 1, max: 20 } });
    const [item] = await sql`select * from menuitem where id = ${l.item_id}`;
    if (!item || !item.available) fail(422, `unknown_item:${l.item_id}`);
    total += item.price * l.quantity;
    lines.push({ item_id: item.id, name: item.name_en, quantity: l.quantity, price: item.price });
  }
  const wall = String(b.pickup_at).replace(" ", "T").replace(/(Z|[+-]\d{2}:?\d{2})$/, "").slice(0, 19);
  if (isNaN(Date.parse(wall + "Z"))) fail(422, [{ loc: ["body", "pickup_at"], msg: "Input should be a valid datetime" }]);
  const soon = new Date(Date.parse(nowLocal() + "Z") + 30 * 60e3).toISOString().slice(0, 19);
  if (wall <= soon) fail(422, "pickup_too_soon");
  const [order] = await sql`insert into "order" ${sql({
    name: b.name, email: b.email.trim(), phone: b.phone, pickup_at: wall, items: sql.json(lines), total_cents: total,
    notes: b.notes, language: b.language, status: "pending", created_at: utcNow(),
  })} returning *`;
  await emails.orderMail(order, "received");
  await emails.staffNewOrder(order);
  return c.json(order, 201);
});

// --- Admin: reservations, orders, dashboard ----------------------------------------

const RES_WRITE = {
  name: { min: 1, max: 120 }, email: { max: 200, optional: true }, phone: { max: 40, def: "" }, date: {}, time: { re: HHMM },
  guests: { type: "int" as const, min: 1, max: 200 }, notes: { max: 500, optional: true }, internal_note: { max: 1000, optional: true },
  source: { def: "phone" }, status: { def: "confirmed" }, language: { max: 5, def: "en" }, notify_guest: { type: "bool" as const, def: true },
};
function resWrite(raw: unknown) {
  const b = validate<any>(raw, RES_WRITE);
  if (!validDate(b.date)) fail(422, [{ loc: ["body", "date"], msg: "Input should be a valid date" }]);
  if (!RES_STATUSES.includes(b.status)) fail(422, [{ loc: ["body", "status"], msg: `status must be one of ${RES_STATUSES}` }]);
  const { notify_guest, ...fields } = b;
  return { notify: notify_guest as boolean, fields };
}

async function warnings(r: any) {
  const s = await getSettings();
  const out = [];
  if (!slotsFor(r.date, s).includes(r.time)) out.push("outside_hours");
  if (!["cancelled", "no_show"].includes(r.status)) {
    if (peakSeated(await dayBookings(r.date), toMin(r.time), s.dining_minutes) > s.seats) out.push("over_capacity");
  }
  return out;
}

api.get("/api/admin/reservations", async (c) => {
  await requireRole(c, ...STAFF);
  const { start, end, status, q } = c.req.query();
  for (const [k, v] of [["start", start], ["end", end]]) if (v && !validDate(v)) fail(422, [{ loc: ["query", k], msg: "invalid date" }]);
  const where = [sql`true`];
  if (start) where.push(sql`"date" >= ${start}`);
  if (end) where.push(sql`"date" <= ${end}`);
  if (!start && !end) where.push(sql`"date" >= ${today()}`);
  if (status) where.push(sql`status = ${status}`);
  let rows = [...await sql`select * from reservation where ${where.reduce((a, b) => sql`${a} and ${b}`)} order by "date", "time"`];
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((r) => `${r.name} ${r.email || ""} ${r.phone}`.toLowerCase().includes(needle));
  }
  return c.json(rows);
});

api.post("/api/admin/reservations", async (c) => {
  await requireRole(c, ...STAFF);
  const { notify, fields } = resWrite(await json(c));
  const [r] = await sql`insert into reservation ${sql({ ...fields, created_at: utcNow() })} returning *`;
  if (notify) await emails.reservationStatusChanged(r, null);
  return c.json({ reservation: r, warnings: await warnings(r) }, 201);
});

api.put("/api/admin/reservations/:id", async (c) => {
  await requireRole(c, ...STAFF);
  const id = intParam(c.req.param("id"));
  const { notify, fields } = resWrite(await json(c));
  const [before] = await sql`select * from reservation where id = ${id}`;
  if (!before) fail(404, "not_found");
  const [r] = await sql`update reservation set ${sql(fields)} where id = ${id} returning *`;
  if (notify) {
    const moved = before.date !== r.date || before.time !== r.time || before.guests !== r.guests;
    // A confirmed booking that moved gets a fresh confirmation with the new details.
    await emails.reservationStatusChanged(r, moved && r.status === "confirmed" ? null : before.status);
  }
  return c.json({ reservation: r, warnings: await warnings(r) });
});

api.patch("/api/admin/reservations/:id", async (c) => {
  await requireRole(c, ...STAFF);
  const id = intParam(c.req.param("id"));
  const b = validate<any>(await json(c), { status: {}, notify: { type: "bool", def: true } });
  if (!RES_STATUSES.includes(b.status)) fail(422, "invalid_status");
  const [before] = await sql`select status from reservation where id = ${id}`;
  if (!before) fail(404, "not_found");
  const [r] = await sql`update reservation set status = ${b.status} where id = ${id} returning *`;
  if (b.notify) await emails.reservationStatusChanged(r, before.status);
  return c.json(r);
});

api.delete("/api/admin/reservations/:id", async (c) => {
  await requireRole(c, ...STAFF);
  const rows = await sql`delete from reservation where id = ${intParam(c.req.param("id"))} returning id`;
  if (!rows.length) fail(404, "not_found");
  return c.body(null, 204);
});

api.get("/api/admin/orders", async (c) => {
  await requireRole(c, ...STAFF);
  const status = c.req.query("status");
  return c.json(status
    ? await sql`select * from "order" where status = ${status} order by pickup_at desc`
    : await sql`select * from "order" order by pickup_at desc`);
});

api.patch("/api/admin/orders/:id", async (c) => {
  await requireRole(c, ...STAFF);
  const id = intParam(c.req.param("id"));
  const b = validate<any>(await json(c), { status: {}, notify: { type: "bool", def: true } });
  if (!ORDER_STATUSES.includes(b.status)) fail(422, "invalid_status");
  const [before] = await sql`select status from "order" where id = ${id}`;
  if (!before) fail(404, "not_found");
  const [o] = await sql`update "order" set status = ${b.status} where id = ${id} returning *`;
  if (b.notify && o.status === "ready" && before.status !== "ready") await emails.orderMail(o, "ready");
  return c.json(o);
});

api.get("/api/admin/stats", async (c) => {
  await requireRole(c, ...STAFF);
  const t = today();
  const rows = await sql`select * from reservation where "date" >= ${t} and "date" <= ${addDays(t, 13)}`;
  const live = rows.filter((r) => ACTIVE.includes(r.status));
  const todays = live.filter((r) => r.date === t).sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  const series = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(t, i);
    const day = live.filter((r) => r.date === d);
    return { date: d, reservations: day.length, covers: day.reduce((n, r) => n + r.guests, 0) };
  });
  const [{ pending }] = await sql`select count(*)::int as pending from reservation where status = 'pending' and "date" >= ${t}`;
  const [{ open }] = await sql`select count(*)::int as open from "order" where status in ('pending', 'confirmed', 'ready')`;
  const week = series.slice(0, 7);
  return c.json({
    today: { reservations: todays.length, covers: todays.reduce((n, r) => n + r.guests, 0) },
    week: { reservations: week.reduce((n, d) => n + d.reservations, 0), covers: week.reduce((n, d) => n + d.covers, 0) },
    pending, open_orders: open, series, upcoming_today: todays,
  });
});

// --- Admin: menu --------------------------------------------------------------------

const CAT_WRITE = { name_en: { min: 1, max: 80 }, name_nl: { min: 1, max: 80 }, note_en: { max: 200, optional: true }, note_nl: { max: 200, optional: true } };
const ITEM_WRITE = {
  category_id: {}, name_en: { min: 1, max: 120 }, name_nl: { min: 1, max: 120 }, description_en: { max: 400, def: "" },
  description_nl: { max: 400, def: "" }, price: { type: "int" as const, min: 0, max: 100_000 }, tags: { type: "list" as const, def: () => [] },
  image: { max: 300, optional: true }, available: { type: "bool" as const, def: true }, featured: { type: "bool" as const, def: false },
  badge: { optional: true },
};
function itemWrite(raw: unknown) {
  const b = validate<any>(raw, ITEM_WRITE);
  if (b.badge === "") b.badge = null;
  if (b.badge !== null && !BADGES.includes(b.badge)) fail(422, [{ loc: ["body", "badge"], msg: `badge must be one of ${BADGES}` }]);
  return { ...b, tags: sql.json(b.tags) };
}
const checkCategory = async (id: string) => {
  if (!(await sql`select 1 from category where id = ${id}`).length) fail(422, "unknown_category");
};
const nextItemPosition = async (cat: string) =>
  ((await sql`select max(position) as m from menuitem where category_id = ${cat}`)[0].m ?? -1) + 1;

api.get("/api/admin/menu", async (c) => {
  await requireRole(c, ...MANAGER);
  return c.json({
    categories: await sql`select * from category order by position`,
    items: await sql`select * from menuitem order by position`,
  });
});

api.get("/api/admin/menu/preview", async (c) => {
  await requireRole(c, ...MANAGER);
  return c.json(await publicMenu(true));
});

api.post("/api/admin/categories/reorder", async (c) => {
  await requireRole(c, ...MANAGER);
  const b = validate<any>(await json(c), { ids: { type: "list" } });
  for (let i = 0; i < b.ids.length; i++) await sql`update category set position = ${i} where id = ${String(b.ids[i])}`;
  return c.body(null, 204);
});

api.post("/api/admin/categories", async (c) => {
  await requireRole(c, ...MANAGER);
  const b = validate<any>(await json(c), CAT_WRITE);
  const [{ m }] = await sql`select max(position) as m from category`;
  const [cat] = await sql`insert into category ${sql({
    id: await uniqueId("category", slugifyId(b.name_en)), position: m === null ? 0 : m + 1, ...b,
  })} returning *`;
  return c.json(cat, 201);
});

api.put("/api/admin/categories/:id", async (c) => {
  await requireRole(c, ...MANAGER);
  const b = validate<any>(await json(c), CAT_WRITE);
  const [cat] = await sql`update category set ${sql(b)} where id = ${c.req.param("id")} returning *`;
  if (!cat) fail(404, "not_found");
  return c.json(cat);
});

api.delete("/api/admin/categories/:id", async (c) => {
  await requireRole(c, ...MANAGER);
  const id = c.req.param("id");
  if (!(await sql`select 1 from category where id = ${id}`).length) fail(404, "not_found");
  if ((await sql`select 1 from menuitem where category_id = ${id} limit 1`).length) fail(409, "category_not_empty");
  await sql`delete from category where id = ${id}`;
  return c.body(null, 204);
});

api.post("/api/admin/items/reorder", async (c) => {
  await requireRole(c, ...MANAGER);
  const b = validate<any>(await json(c), { ids: { type: "list" } });
  for (let i = 0; i < b.ids.length; i++) await sql`update menuitem set position = ${i} where id = ${String(b.ids[i])}`;
  return c.body(null, 204);
});

api.post("/api/admin/items", async (c) => {
  await requireRole(c, ...MANAGER);
  const b = itemWrite(await json(c));
  await checkCategory(b.category_id);
  const [item] = await sql`insert into menuitem ${sql({
    id: await uniqueId("menuitem", slugifyId(b.name_en)), position: await nextItemPosition(b.category_id), ...b,
  })} returning *`;
  return c.json(item, 201);
});

api.put("/api/admin/items/:id", async (c) => {
  await requireRole(c, ...MANAGER);
  const id = c.req.param("id");
  const b = itemWrite(await json(c));
  const [item] = await sql`select * from menuitem where id = ${id}`;
  if (!item) fail(404, "not_found");
  await checkCategory(b.category_id);
  const changes: Record<string, unknown> = { ...b };
  if (b.category_id !== item.category_id) changes.position = await nextItemPosition(b.category_id);
  const [row] = await sql`update menuitem set ${sql(changes)} where id = ${id} returning *`;
  return c.json(row);
});

api.delete("/api/admin/items/:id", async (c) => {
  await requireRole(c, ...MANAGER);
  const rows = await sql`delete from menuitem where id = ${c.req.param("id")} returning id`;
  if (!rows.length) fail(404, "not_found");
  return c.body(null, 204);
});

// Images: raw body upload; the admin app resizes to WebP before sending.
api.post("/api/admin/images", async (c) => {
  await requireRole(c, ...MANAGER);
  const type = (c.req.header("content-type") || "").split(";")[0].trim();
  if (!["image/webp", "image/jpeg", "image/png", "image/avif"].includes(type)) fail(415, "unsupported_type");
  const data = new Uint8Array(await c.req.arrayBuffer());
  if (!data.length) fail(422, "empty");
  if (data.length > config.MAX_IMAGE_BYTES) fail(413, "too_large");
  const id = (await sha256(data)).slice(0, 32);
  if (!(await sql`select 1 from image where id = ${id}`).length) {
    await sql`insert into image ${sql({ id, content_type: type, size: data.length, data, created_at: utcNow() })}`;
  }
  return c.json({ id, url: `/api/images/${id}` }, 201);
});

// --- Admin: settings & email ----------------------------------------------------------

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

api.get("/api/admin/settings", async (c) => {
  await requireRole(c, ...MANAGER);
  return c.json(await getSettings());
});

api.put("/api/admin/settings", async (c) => {
  await requireRole(c, ...MANAGER);
  const b = validate<any>(await json(c), {
    restaurant: { type: "dict" }, hours: { type: "list" }, seats: { type: "int", min: 1, max: 1000 },
    dining_minutes: { type: "int", min: 30, max: 360 }, slot_minutes: { type: "int", min: 10, max: 120 },
    last_seating_minutes: { type: "int", min: 0, max: 300 }, max_party_size: { type: "int", min: 1, max: 100 },
    booking_window_days: { type: "int", min: 1, max: 365 }, ordering_enabled: { type: "bool" },
    notifications: { type: "dict", def: () => ({}) }, prelaunch: { type: "bool", def: false }, opening_date: { def: "" },
  });
  const restaurant = validate<any>(b.restaurant, {
    name: { min: 1, max: 80 }, address: { max: 120 }, city: { max: 80 }, email: { max: 120 }, phone: { max: 40, def: "" },
  });
  const notifications = validate<any>(b.notifications, {
    guest_emails: { type: "bool", def: true }, staff_emails: { type: "bool", def: true }, staff_email: { max: 200, def: "" },
  });
  const opening = (b.opening_date || "").trim();
  if (opening && !/^\d{4}-\d{2}-\d{2}$/.test(opening)) fail(422, [{ loc: ["body", "opening_date"], msg: "opening_date must be YYYY-MM-DD or empty" }]);
  if (b.hours.length !== 7) fail(422, [{ loc: ["body", "hours"], msg: "hours needs 7 entries, Monday first" }]);
  for (const day of b.hours) {
    if (day === null) continue;
    if (!Array.isArray(day) || day.length !== 2 || !day.every((t: unknown) => typeof t === "string" && TIME.test(t)) || day[0] >= day[1]) {
      fail(422, [{ loc: ["body", "hours"], msg: "each open day needs [open, close] as HH:MM with open before close" }]);
    }
  }
  const values = { ...b, restaurant, notifications, opening_date: opening };
  await sql`insert into setting (key, value) values ('site', ${sql.json(values)})
    on conflict (key) do update set value = excluded.value`;
  return c.json(await getSettings());
});

api.get("/api/admin/email", async (c) => {
  await requireRole(c, ...MANAGER);
  const s = await getSettings();
  return c.json({
    enabled: emails.mailEnabled(), from: config.EMAIL_FROM, reply_to: config.EMAIL_REPLY_TO || s.restaurant.email,
    site_url: config.SITE_URL, log: await sql`select * from emaillog order by created_at desc limit 50`,
  });
});

api.post("/api/admin/email/test", async (c) => {
  const user = await requireRole(c, ...MANAGER);
  const b = validate<any>((await json(c)) ?? {}, { to: { optional: true } });
  return c.json(await emails.testEmail((b.to || user.email).trim()));
});

// --- App ---------------------------------------------------------------------------------

const app = new Hono();
for (const sub of [api, auth, blog, seo]) app.route("/", sub);

// Supabase serves the function under /<name>; Cloudflare forwards the original path after it.
const root = new Hono();
root.use("*", cors());
root.route("/yerevan", app);
root.route("/", app);
for (const a of [app, root]) {
  a.notFound((c) => c.json({ detail: "Not Found" }, 404));
  a.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ detail: err.detail }, err.status as 400);
    console.error(err);
    return c.json({ detail: "Internal Server Error" }, 500);
  });
}
Deno.serve({ port: Number(Deno.env.get("PORT") || 8000) }, root.fetch);
