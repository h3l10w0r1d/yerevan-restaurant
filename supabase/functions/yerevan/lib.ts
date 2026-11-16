// Shared helpers for the Yerevan API on Supabase Edge Functions (a port of backend/app).
import postgres from "npm:postgres@3.4.5";

export const env = (k: string, d = "") => (Deno.env.get(k) ?? d).trim();

export const config = {
  ADMIN_EMAIL: env("ADMIN_EMAIL", "admin@yerevanrestaurant.nl").toLowerCase(),
  SESSION_DAYS: Number(env("SESSION_DAYS", "14")),
  RESEND_API_KEY: env("RESEND_API_KEY"),
  EMAIL_FROM: env("EMAIL_FROM", "Yerevan Restaurant <reserveringen@yerevanrestaurant.nl>"),
  EMAIL_REPLY_TO: env("EMAIL_REPLY_TO"),
  SITE_URL: env("SITE_URL", "https://www.yerevanrestaurant.nl").replace(/\/+$/, ""),
  PASSWORD_LINK_HOURS: 72,
  MAX_IMAGE_BYTES: 3 * 1024 * 1024,
};

export const DEFAULT_SETTINGS = () => ({
  restaurant: { name: "Yerevan", address: "Kampstraat 22", city: "Hilversum", email: "info@yerevanrestaurant.nl", phone: "" },
  hours: [null, ["17:00", "22:00"], ["17:00", "22:00"], ["17:00", "22:00"], ["17:00", "23:00"], ["16:00", "23:00"], ["16:00", "22:00"]],
  seats: Number(env("SEATS", "50")),
  dining_minutes: Number(env("DINING_MINUTES", "120")),
  slot_minutes: 30,
  last_seating_minutes: 90,
  max_party_size: 12,
  booking_window_days: 90,
  ordering_enabled: env("ORDERING_ENABLED", "false").toLowerCase() === "true",
  prelaunch: env("PRELAUNCH", "false").toLowerCase() === "true",
  opening_date: "",
  notifications: { guest_emails: true, staff_emails: true, staff_email: "" },
});

// Timestamps are naive UTC in the database; keep them as ISO strings like the Python API returned.
export const sql = postgres(env("DATABASE_URL"), {
  prepare: false, // Neon's pooler is PgBouncer
  max: 4,
  idle_timeout: 20,
  connect_timeout: 10,
  transform: { undefined: null },
  types: {
    date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    ts: { to: 1114, from: [1114], serialize: (x: string) => x, parse: (x: string) => x.replace(" ", "T").replace(/\.(\d{1,5})$/, (_, f) => "." + f.padEnd(6, "0")) },
  },
});
export type Sql = typeof sql;

export class HttpError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : "error");
  }
}
export const fail = (status: number, detail: unknown): never => {
  throw new HttpError(status, detail);
};

// --- Time -----------------------------------------------------------------

export const utcNow = () => new Date().toISOString().slice(0, 23); // naive UTC, like datetime.utcnow()
export const addMs = (iso: string, ms: number) => new Date(new Date(iso + "Z").getTime() + ms).toISOString().slice(0, 23);

export function nowLocal(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
export const today = () => nowLocal().slice(0, 10);
export const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
export const weekday = (d: string) => (new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
export const validDate = (d: unknown): d is string =>
  typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d;

/** Parse an incoming datetime; aware values become naive UTC, naive ones are kept as given. */
export function toUtcNaive(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") fail(422, [{ loc: ["body"], msg: "invalid datetime" }]);
  const s = (v as string).trim().replace(" ", "T");
  const d = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : s + "Z");
  if (isNaN(d.getTime())) fail(422, [{ loc: ["body"], msg: "invalid datetime" }]);
  return d.toISOString().slice(0, 23);
}

// --- Crypto ---------------------------------------------------------------

const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));
const ITERATIONS = 240_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256));
}
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2_sha256$${ITERATIONS}$${hex(salt)}$${await pbkdf2(password, salt, ITERATIONS)}`;
}
export async function verifyPassword(password: string, stored: string) {
  const parts = (stored || "").split("$");
  if (parts.length !== 4) return false;
  try {
    const digest = await pbkdf2(password, fromHex(parts[2]), Number(parts[1]));
    let diff = digest.length ^ parts[3].length;
    for (let i = 0; i < digest.length; i++) diff |= digest.charCodeAt(i) ^ (parts[3].charCodeAt(i) || 0);
    return diff === 0;
  } catch {
    return false;
  }
}
export const sha256 = async (data: string | Uint8Array) =>
  hex(await crypto.subtle.digest("SHA-256", (typeof data === "string" ? enc.encode(data) : data) as BufferSource));
export const hashToken = (t: string) => sha256(t);
export function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const tempPassword = () => [0, 1, 2].map(() => hex(crypto.getRandomValues(new Uint8Array(2)))).join("-");
export const uuidHex = () => crypto.randomUUID().replace(/-/g, "");

// --- Small validation kit (stands in for pydantic) --------------------------

type Rule = { type?: "str" | "int" | "bool" | "list" | "dict" | "any"; min?: number; max?: number; optional?: boolean; def?: unknown; re?: RegExp; email?: boolean };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validate<T = Record<string, any>>(body: unknown, schema: Record<string, Rule>): T {
  if (!body || typeof body !== "object" || Array.isArray(body)) fail(422, [{ loc: ["body"], msg: "Input should be an object" }]);
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const errors: unknown[] = [];
  for (const [key, r] of Object.entries(schema)) {
    let v = src[key];
    const err = (msg: string) => errors.push({ loc: ["body", key], msg, type: "value_error" });
    if (v === undefined || (v === null && r.optional)) {
      if (r.def !== undefined) out[key] = typeof r.def === "function" ? (r.def as () => unknown)() : r.def;
      else if (r.optional) out[key] = null;
      else err("Field required");
      continue;
    }
    const t = r.type ?? "str";
    if (t === "str") {
      if (typeof v !== "string") { err("Input should be a valid string"); continue; }
      if (r.min !== undefined && v.length < r.min) err(`String should have at least ${r.min} characters`);
      if (r.max !== undefined && v.length > r.max) err(`String should have at most ${r.max} characters`);
      if (r.re && !r.re.test(v)) err("String should match pattern");
      if (r.email && !EMAIL.test(v.trim())) err("value is not a valid email address");
    } else if (t === "int") {
      if (typeof v === "string" && /^-?\d+$/.test(v)) v = Number(v);
      if (typeof v !== "number" || !Number.isInteger(v)) { err("Input should be a valid integer"); continue; }
      if (r.min !== undefined && v < r.min) err(`Input should be greater than or equal to ${r.min}`);
      if (r.max !== undefined && v > r.max) err(`Input should be less than or equal to ${r.max}`);
    } else if (t === "bool") {
      if (typeof v !== "boolean") { err("Input should be a valid boolean"); continue; }
    } else if (t === "list") {
      if (!Array.isArray(v)) { err("Input should be a valid list"); continue; }
      if (r.min !== undefined && v.length < r.min) err(`List should have at least ${r.min} items`);
    } else if (t === "dict") {
      if (!v || typeof v !== "object" || Array.isArray(v)) { err("Input should be a valid dictionary"); continue; }
    }
    out[key] = v;
  }
  if (errors.length) fail(422, errors);
  return out as T;
}

// --- Settings & booking rules -----------------------------------------------

export async function getSettings(db: Sql = sql) {
  const merged: Record<string, any> = DEFAULT_SETTINGS();
  const [row] = await db`select value from setting where key = 'site'`;
  if (row?.value) {
    for (const [k, v] of Object.entries(row.value as Record<string, any>)) {
      if (v && typeof v === "object" && !Array.isArray(v) && merged[k] && typeof merged[k] === "object" && !Array.isArray(merged[k])) {
        Object.assign(merged[k], v);
      } else merged[k] = v;
    }
  }
  return merged;
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
};
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function slotsFor(day: string, s: Record<string, any>): string[] {
  const hours = s.hours[weekday(day)];
  if (!hours) return [];
  const out: string[] = [];
  const end = toMin(hours[1]) - s.last_seating_minutes;
  for (let m = toMin(hours[0]); m <= end; m += s.slot_minutes) out.push(fmt(m));
  return out;
}

export async function dayBookings(day: string, excludeId?: number, db: Sql = sql): Promise<[number, number][]> {
  const rows = await db`select "time", guests, id from reservation
    where "date" = ${day} and status not in ('cancelled', 'no_show')`;
  return rows.filter((r) => !excludeId || r.id !== excludeId).map((r) => [toMin(r.time), r.guests]);
}

export function peakSeated(bookings: [number, number][], start: number, dining: number) {
  const moments = [start, ...bookings.map(([b]) => b).filter((b) => start < b && b < start + dining)];
  return Math.max(...moments.map((m) => bookings.reduce((n, [b, g]) => n + (b <= m && m < b + dining ? g : 0), 0)));
}
export const freeSeats = (bookings: [number, number][], time: string, s: Record<string, any>) =>
  s.seats - peakSeated(bookings, toMin(time), s.dining_minutes);

// --- Menu -----------------------------------------------------------------

export const slugifyId = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";

export async function uniqueId(table: "category" | "menuitem", base: string) {
  let candidate = base, n = 2;
  while ((await sql`select 1 from ${sql(table)} where id = ${candidate}`).length) candidate = `${base}-${n++}`;
  return candidate;
}

export async function publicMenu(includeUnavailable = false) {
  const cats = await sql`select * from category order by position`;
  const items = await sql`select * from menuitem order by position`;
  const out = [];
  for (const cat of cats) {
    const entries = items
      .filter((i) => i.category_id === cat.id && (includeUnavailable || i.available))
      .map((i) => ({
        id: i.id,
        name: { en: i.name_en, nl: i.name_nl },
        description: { en: i.description_en, nl: i.description_nl },
        price: i.price,
        tags: i.tags || [],
        featured: !!i.featured,
        ...(i.badge ? { badge: i.badge } : {}),
        ...(i.image ? { image: i.image } : {}),
        ...(includeUnavailable ? { available: i.available } : {}),
      }));
    const entry: Record<string, unknown> = { id: cat.id, name: { en: cat.name_en, nl: cat.name_nl }, items: entries };
    if (cat.note_en || cat.note_nl) entry.note = { en: cat.note_en || "", nl: cat.note_nl || "" };
    if (entries.length || includeUnavailable) out.push(entry);
  }
  return { currency: "EUR", categories: out };
}

// --- HTML ---------------------------------------------------------------------

export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
