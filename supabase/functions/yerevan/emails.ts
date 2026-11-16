// Transactional emails through Resend; every attempt is written to the email log (port of emails.py + mailer.py).
import { config, esc, getSettings, sql, utcNow } from "./lib.ts";

const BURGUNDY = "#531C21", IVORY = "#F8EFEA", INK = "#2A1215", MUTED = "#67474B";
const DAYS: Record<string, string[]> = {
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  nl: ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"],
};
const MONTHS: Record<string, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  nl: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"],
};
const T: Record<string, Record<string, string>> = {
  en: {
    received_subject: "We received your request for {date}",
    received_title: "Thank you, {name}.",
    received_body: "We have your table request below. We will confirm it shortly by email.",
    confirmed_subject: "Your table is confirmed: {date} at {time}",
    confirmed_title: "See you soon, {name}.",
    confirmed_body: "Your table is confirmed. We hold it for fifteen minutes. The calendar invite is attached.",
    cancelled_subject: "Your reservation for {date}",
    cancelled_title: "We’re sorry, {name}.",
    cancelled_body: "We can’t welcome you at the time below. Reply to this email or call us and we’ll gladly find another moment.",
    date: "Date", time: "Time", guests: "Guests", notes: "Your notes",
    change: "Need to change something? Simply reply to this email{phone}.",
    or_call: " or call us on {phone}",
    order_subject: "Order #{id} received",
    order_title: "Thank you, {name}.",
    order_body: "We’ve received your takeaway order. We’ll let you know when it’s ready.",
    ready_subject: "Order #{id} is ready for pickup",
    ready_title: "Ready when you are, {name}.",
    ready_body: "Your order is ready at Kampstraat 22. You pay when you collect.",
    pickup: "Pickup", total: "Total",
    footer: "Armenian restaurant · {address}, {city}",
  },
  nl: {
    received_subject: "We hebben je aanvraag voor {date} ontvangen",
    received_title: "Dank je wel, {name}.",
    received_body: "Hieronder staat je aanvraag. We bevestigen hem zo snel mogelijk per e-mail.",
    confirmed_subject: "Je tafel is bevestigd: {date} om {time}",
    confirmed_title: "Tot snel, {name}.",
    confirmed_body: "Je tafel is bevestigd. We houden hem vijftien minuten voor je vast. De agenda-uitnodiging zit in de bijlage.",
    cancelled_subject: "Je reservering voor {date}",
    cancelled_title: "Het spijt ons, {name}.",
    cancelled_body: "Op het onderstaande moment kunnen we je helaas niet ontvangen. Beantwoord deze e-mail of bel ons, dan zoeken we graag een ander moment.",
    date: "Datum", time: "Tijd", guests: "Personen", notes: "Je opmerkingen",
    change: "Iets wijzigen? Beantwoord gewoon deze e-mail{phone}.",
    or_call: " of bel ons op {phone}",
    order_subject: "Bestelling #{id} ontvangen",
    order_title: "Dank je wel, {name}.",
    order_body: "We hebben je afhaalbestelling ontvangen. We laten je weten wanneer hij klaarstaat.",
    ready_subject: "Bestelling #{id} staat klaar",
    ready_title: "Hij staat klaar, {name}.",
    ready_body: "Je bestelling staat klaar aan de Kampstraat 22. Je betaalt bij het afhalen.",
    pickup: "Afhalen", total: "Totaal",
    footer: "Armeens restaurant · {address}, {city}",
  },
};

const f = (tpl: string, vars: Record<string, unknown>) => tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
const lang = (code?: string | null) => ((code || "").toLowerCase().startsWith("nl") ? "nl" : "en");
const dateText = (d: string, l: string) => {
  const dt = new Date(d.slice(0, 10) + "T00:00:00Z");
  return `${DAYS[l][(dt.getUTCDay() + 6) % 7]} ${dt.getUTCDate()} ${MONTHS[l][dt.getUTCMonth()]}`;
};
const euro = (cents: number) =>
  "€ " + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "X").replace(".", ",").replace(/X/g, ".");
const first = (name: string) => (name || "").split(" ")[0] || name;

type Row = [string, string];

function layout(title: string, intro: string, rows: Row[], s: any, l: string, after = "", button?: [string, string]) {
  const r = s.restaurant;
  const detailRows = rows.map(([k, v]) =>
    `<tr><td style="padding:6px 0;color:${MUTED};font-size:14px;width:38%">${esc(k)}</td>` +
    `<td style="padding:6px 0;color:${INK};font-size:15px">${v}</td></tr>`).join("");
  const details = rows.length
    ? `<table role="presentation" width="100%" style="border-collapse:collapse;border-top:1px solid #EADBD6;border-bottom:1px solid #EADBD6;margin:24px 0">${detailRows}</table>`
    : "";
  const btn = button
    ? `<p style="margin:28px 0"><a href="${esc(button[1])}" style="background:${BURGUNDY};color:${IVORY};text-decoration:none;padding:12px 22px;border-radius:4px;font-size:15px;display:inline-block">${esc(button[0])}</a></p>`
    : "";
  const footer = f(T[l].footer, { address: esc(r.address), city: esc(r.city) });
  const site = config.SITE_URL;
  return `<!doctype html>
<html lang="${l}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${IVORY};font-family:'Jost',Helvetica,Arial,sans-serif;color:${INK}">
<table role="presentation" width="100%" style="background:${IVORY};border-collapse:collapse"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;border-collapse:collapse">
<tr><td style="background:${BURGUNDY};padding:28px 32px;text-align:center">
<div style="font-family:'Bodoni Moda',Didot,Georgia,serif;color:${IVORY};font-size:30px;letter-spacing:6px">YEREVAN</div>
<div style="font-family:'Bodoni Moda',Didot,Georgia,serif;color:${IVORY};font-size:15px;letter-spacing:1px;margin-top:2px">restaurant</div>
</td></tr>
<tr><td style="background:#ffffff;padding:36px 32px">
<h1 style="font-family:'Bodoni Moda',Didot,Georgia,serif;font-weight:400;color:${BURGUNDY};font-size:28px;line-height:1.2;margin:0 0 14px">${esc(title)}</h1>
<p style="font-size:16px;line-height:1.6;margin:0;color:${INK}">${intro}</p>
${details}${btn}${after}
</td></tr>
<tr><td style="padding:20px 32px;text-align:center;color:${MUTED};font-size:13px;line-height:1.6">
${footer}<br><a href="${esc(site)}" style="color:${MUTED}">${esc(site.replace("https://", ""))}</a>
</td></tr></table></td></tr></table></body></html>`;
}

function text(title: string, intro: string, rows: [string, unknown][], after: string, s: any, l: string) {
  const r = s.restaurant;
  const lines = [title, "", intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), ...(after ? ["", after] : [])];
  lines.push("", "—", f(T[l].footer, { address: r.address, city: r.city }), config.SITE_URL);
  return lines.join("\n");
}

const replyTo = (s: any) => config.EMAIL_REPLY_TO || s.restaurant.email || null;
const staffAddress = (s: any) => s.notifications.staff_email || s.restaurant.email || null;

export const mailEnabled = () => !!config.RESEND_API_KEY;

type Message = {
  to: string; subject: string; html: string; text: string; template: string;
  related?: string | null; reply_to?: string | null; attachments?: { filename: string; content: string; content_type: string }[];
};

/** Never throws: a failed email must not fail the booking or order that caused it. */
export async function send(msg: Message, idempotencyKey?: string) {
  const entry: Record<string, unknown> = {
    to: msg.to, subject: msg.subject, template: msg.template, related: msg.related ?? null,
    status: "skipped", provider_id: null, error: null, created_at: utcNow(),
  };
  if (!mailEnabled()) entry.error = "RESEND_API_KEY not set";
  else {
    const payload: Record<string, unknown> = {
      from: config.EMAIL_FROM, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text,
      tags: [{ name: "template", value: msg.template }],
    };
    if (msg.reply_to) payload.reply_to = msg.reply_to;
    if (msg.attachments?.length) payload.attachments = msg.attachments;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "yerevan-restaurant/1.0",
    };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey.slice(0, 256);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
      });
      const body = await res.text();
      if (res.ok) {
        entry.status = "sent";
        try { entry.provider_id = JSON.parse(body || "{}").id ?? null; } catch { /* ignore */ }
      } else {
        entry.status = "failed";
        entry.error = `${res.status}: ${body.slice(0, 400)}`;
      }
    } catch (e) {
      entry.status = "failed";
      entry.error = String(e).slice(0, 400);
    }
  }
  if (entry.status === "failed") console.warn(`email ${msg.template} to ${msg.to} failed: ${entry.error}`);
  const [row] = await sql`insert into emaillog ${sql(entry)} returning *`;
  return row;
}

// --- Reservations -------------------------------------------------------------

async function reservationMail(r: any, kind: string) {
  const s = await getSettings();
  if (!r.email || !s.notifications.guest_emails) return;
  const l = lang(r.language), t = T[l];
  const date = dateText(r.date, l);
  const phone = s.restaurant.phone;
  const change = f(t.change, { phone: phone ? f(t.or_call, { phone }) : "" });
  const rows: Row[] = [[t.date, esc(date)], [t.time, esc(r.time)], [t.guests, String(r.guests)]];
  if (r.notes) rows.push([t.notes, esc(r.notes)]);
  const title = f(t[`${kind}_title`], { name: first(r.name) });
  const intro = t[`${kind}_body`];
  const attachments = kind === "confirmed"
    ? [{ filename: `yerevan-${r.date}.ics`, content: btoa(unescape(encodeURIComponent(ics(r, s)))), content_type: "text/calendar" }]
    : [];
  await send({
    to: r.email,
    subject: f(t[`${kind}_subject`], { date, time: r.time }),
    html: layout(title, esc(intro), rows, s, l, `<p style="font-size:14px;color:${MUTED};margin:0">${esc(change)}</p>`),
    text: text(title, intro, [[t.date, date], [t.time, r.time], [t.guests, r.guests], ...(r.notes ? [[t.notes, r.notes] as [string, unknown]] : [])], change, s, l),
    template: `reservation_${kind}`, related: `reservation:${r.id}`, reply_to: replyTo(s), attachments,
  }, `reservation-${r.id}-${kind}-${r.date}-${r.time}`);
}

export const reservationReceived = (r: any) => reservationMail(r, "received");

export async function reservationStatusChanged(r: any, previous: string | null) {
  if (r.status === previous) return;
  if (r.status === "confirmed") await reservationMail(r, "confirmed");
  else if (r.status === "cancelled" && previous !== null && previous !== "cancelled") await reservationMail(r, "cancelled");
}

export async function staffNewReservation(r: any) {
  const s = await getSettings();
  const to = staffAddress(s);
  if (!to || !s.notifications.staff_emails) return;
  const date = dateText(r.date, "en");
  const rows: Row[] = [["Guest", esc(r.name)], ["When", `${esc(date)}, ${esc(r.time)}`], ["Guests", String(r.guests)],
    ["Phone", esc(r.phone || "—")], ["Email", esc(r.email || "—")]];
  if (r.notes) rows.push(["Notes", esc(r.notes)]);
  const link = `${config.SITE_URL}/admin/reservations`;
  await send({
    to, subject: `New booking request · ${r.guests}p · ${date} ${r.time}`,
    html: layout("New booking request", "A guest booked through the website. Confirm or decline it in the admin.", rows, s, "en", "", ["Open reservations", link]),
    text: text("New booking request", `Confirm or decline it in the admin: ${link}`,
      [["Guest", r.name], ["When", `${date}, ${r.time}`], ["Guests", r.guests], ["Phone", r.phone]], "", s, "en"),
    template: "staff_new_reservation", related: `reservation:${r.id}`, reply_to: r.email,
  }, `staff-reservation-${r.id}`);
}

function ics(r: any, s: any) {
  const start = `${r.date.replace(/-/g, "")}T${r.time.replace(":", "")}00`;
  const [h, m] = r.time.split(":").map(Number);
  const endDate = new Date(Date.parse(`${r.date}T00:00:00Z`) + ((h + 2) * 60 + m) * 60000);
  const end = endDate.toISOString().slice(0, 19).replace(/[-:]/g, "");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z";
  const rest = s.restaurant;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Yerevan Restaurant//Reservations//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:reservation-${r.id}@yerevanrestaurant.nl`, `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/Amsterdam:${start}`, `DTEND;TZID=Europe/Amsterdam:${end}`,
    `SUMMARY:${rest.name} · ${r.guests} ${lang(r.language) === "nl" ? "personen" : "guests"}`,
    `LOCATION:${rest.address}\\, ${rest.city}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n") + "\r\n";
}

// --- Orders -------------------------------------------------------------------

function orderRows(o: any, l: string): Row[] {
  const rows: Row[] = (o.items || []).map((line: any) => [`${line.quantity} × ${line.name}`, euro(line.price * line.quantity)]);
  rows.push([T[l].total, `<strong>${euro(o.total_cents)}</strong>`]);
  rows.push([T[l].pickup, esc(`${dateText(o.pickup_at, l)}, ${o.pickup_at.slice(11, 16)}`)]);
  return rows;
}

export async function orderMail(o: any, kind: string) {
  const s = await getSettings();
  if (!o.email || !s.notifications.guest_emails) return;
  const l = lang(o.language), t = T[l];
  const key = kind === "received" ? "order" : "ready";
  const title = f(t[`${key}_title`], { name: first(o.name) });
  const rows = orderRows(o, l);
  await send({
    to: o.email, subject: f(t[`${key}_subject`], { id: o.id }),
    html: layout(title, esc(t[`${key}_body`]), rows, s, l),
    text: text(title, t[`${key}_body`], rows.map(([k, v]) => [k, v.replace("<strong>", "").replace("</strong>", "")]), "", s, l),
    template: `order_${kind}`, related: `order:${o.id}`, reply_to: replyTo(s),
  }, `order-${o.id}-${kind}`);
}

export async function staffNewOrder(o: any) {
  const s = await getSettings();
  const to = staffAddress(s);
  if (!to || !s.notifications.staff_emails) return;
  const link = `${config.SITE_URL}/admin/orders`;
  const rows: Row[] = [["Guest", esc(o.name)], ["Phone", esc(o.phone)], ...orderRows(o, "en")];
  await send({
    to, subject: `New takeaway order #${o.id} · ${euro(o.total_cents)}`,
    html: layout(`New order #${o.id}`, "Accept it in the admin so the guest knows it’s coming.", rows, s, "en", "", ["Open orders", link]),
    text: text(`New order #${o.id}`, link, [["Guest", o.name], ["Phone", o.phone], ["Total", euro(o.total_cents)]], "", s, "en"),
    template: "staff_new_order", related: `order:${o.id}`, reply_to: o.email,
  }, `staff-order-${o.id}`);
}

// --- Accounts -------------------------------------------------------------------

export async function accountLink(user: any, link: string, purpose: string) {
  const s = await getSettings();
  let subject, title, intro, button;
  if (purpose === "invite") {
    subject = "You’ve been added to the Yerevan admin";
    title = `Welcome, ${first(user.name)}.`;
    intro = `You now have access to the Yerevan restaurant admin as ${user.role}. Choose a password to sign in with ${esc(user.email)}.`;
    button = "Choose your password";
  } else {
    subject = "Reset your Yerevan admin password";
    title = `Hi ${first(user.name)},`;
    intro = "Someone (hopefully you) asked to reset your password. If that wasn’t you, you can ignore this email.";
    button = "Choose a new password";
  }
  const note = `This link works once and expires in ${config.PASSWORD_LINK_HOURS} hours.`;
  const entry = await send({
    to: user.email, subject,
    html: layout(title, intro, [], s, "en", `<p style="font-size:13px;color:${MUTED};margin:0">${note}<br>${esc(link)}</p>`, [button, link]),
    text: text(title, intro.replace(/&#x27;/g, "'"), [], `${button}: ${link}\n${note}`, s, "en"),
    template: `account_${purpose}`, related: `user:${user.id}`,
  });
  return entry.status === "sent";
}

export async function testEmail(to: string) {
  const s = await getSettings();
  const intro = "If you can read this, email from the Yerevan website is working.";
  return send({
    to, subject: "Test email from the Yerevan website",
    html: layout("It works.", intro, [["Sent from", esc(config.EMAIL_FROM)], ["Reply-to", esc(replyTo(s) || "—")]], s, "en"),
    text: text("It works.", intro, [["Sent from", config.EMAIL_FROM]], "", s, "en"),
    template: "test",
  });
}
