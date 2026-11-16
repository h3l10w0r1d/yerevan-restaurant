// Accounts: sessions, roles, login and password flows, team management (port of deps.py, accounts.py, auth.py, team.py).
import { Hono, Context } from "npm:hono@4.6.14";
import {
  addMs, config, fail, hashPassword, hashToken, newToken, sql, Sql, tempPassword, utcNow, validate, verifyPassword,
} from "./lib.ts";
import { accountLink, mailEnabled } from "./emails.ts";

const ROLES = ["owner", "manager", "staff"];
const USER_COLS = ["id", "email", "name", "role", "active", "created_at", "last_login_at"];
export const userRead = (u: any) => Object.fromEntries(USER_COLS.map((k) => [k, u[k]]));

const bearer = (c: Context) => {
  const h = c.req.header("authorization") || "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : null;
};

export async function currentUser(c: Context) {
  const token = bearer(c);
  if (!token) fail(401, "not_authenticated");
  const [auth] = await sql`select user_id from authsession
    where token_hash = ${await hashToken(token!)} and expires_at >= (now() at time zone 'utc')`;
  if (!auth) fail(401, "session_expired");
  const [user] = await sql`select * from "user" where id = ${auth.user_id}`;
  if (!user || !user.active) fail(401, "account_disabled");
  return user;
}

export async function requireRole(c: Context, ...roles: string[]) {
  const user = await currentUser(c);
  if (!roles.includes(user.role)) fail(403, "forbidden");
  return user;
}
export const STAFF = ["owner", "manager", "staff"], MANAGER = ["owner", "manager"];

// --- Links ----------------------------------------------------------------------

async function issueLink(user: any, purpose: string) {
  await sql`delete from passwordtoken where user_id = ${user.id} and used_at is null`;
  const token = newToken();
  await sql`insert into passwordtoken ${sql({
    token_hash: await hashToken(token), user_id: user.id, purpose,
    expires_at: addMs(utcNow(), config.PASSWORD_LINK_HOURS * 3600e3), used_at: null,
  })}`;
  return `${config.SITE_URL}/admin/set-password?token=${token}`;
}

async function sendLink(user: any, purpose: string) {
  if (!mailEnabled()) return false;
  return accountLink(user, await issueLink(user, purpose), purpose);
}

async function validToken(token: string): Promise<[any, any]> {
  const [row] = await sql`select * from passwordtoken where token_hash = ${await hashToken(token || "")}
    and used_at is null and expires_at >= (now() at time zone 'utc')`;
  if (!row) return [null, null];
  const [user] = await sql`select * from "user" where id = ${row.user_id}`;
  if (!user || !user.active) return [null, null];
  return [row, user];
}

const endSessions = (db: Sql, userId: number) => db`delete from authsession where user_id = ${userId}`;
const json = (c: Context) => c.req.json().catch(() => null);
const EMAIL = { min: 3, max: 320, email: true };

export const auth = new Hono();

auth.post("/api/auth/login", async (c) => {
  const b = validate<any>(await json(c), { email: {}, password: {} });
  const [user] = await sql`select * from "user" where email = ${b.email.trim().toLowerCase()}`;
  if (!user || !(await verifyPassword(b.password, user.password_hash))) fail(401, "invalid_credentials");
  if (!user.active) fail(403, "account_disabled");
  const token = newToken();
  const now = utcNow();
  await sql`insert into authsession ${sql({
    token_hash: await hashToken(token), user_id: user.id, created_at: now, expires_at: addMs(now, config.SESSION_DAYS * 864e5),
  })}`;
  const [fresh] = await sql`update "user" set last_login_at = ${now} where id = ${user.id} returning *`;
  return c.json({ token, user: userRead(fresh) });
});

auth.post("/api/auth/logout", async (c) => {
  const token = bearer(c);
  if (token) await sql`delete from authsession where token_hash = ${await hashToken(token)}`;
  return c.body(null, 204);
});

auth.get("/api/auth/me", async (c) => c.json(userRead(await currentUser(c))));

auth.put("/api/auth/me", async (c) => {
  const user = await currentUser(c);
  const b = validate<any>(await json(c), { name: { min: 1, max: 80 }, email: EMAIL });
  const email = b.email.trim().toLowerCase();
  const [clash] = await sql`select id from "user" where email = ${email} and id != ${user.id}`;
  if (clash) fail(409, "email_taken");
  const [row] = await sql`update "user" set name = ${b.name.trim()}, email = ${email} where id = ${user.id} returning *`;
  return c.json(userRead(row));
});

auth.post("/api/auth/password", async (c) => {
  const user = await currentUser(c);
  const b = validate<any>(await json(c), { current_password: {}, new_password: { min: 8, max: 200 } });
  if (!(await verifyPassword(b.current_password, user.password_hash))) fail(400, "wrong_password");
  const current = await hashToken(bearer(c) || "");
  await sql.begin(async (db: any) => {
    await db`update "user" set password_hash = ${await hashPassword(b.new_password)} where id = ${user.id}`;
    await db`delete from authsession where user_id = ${user.id} and token_hash != ${current}`; // sign out other sessions
  });
  return c.body(null, 204);
});

auth.post("/api/auth/forgot", async (c) => {
  // Always 204 so the form can't be used to discover which emails have accounts.
  const b = validate<any>(await json(c), { email: {} });
  const [user] = await sql`select * from "user" where email = ${b.email.trim().toLowerCase()}`;
  if (!user || !user.active) return c.body(null, 204);
  const cutoff = addMs(utcNow(), config.PASSWORD_LINK_HOURS * 3600e3 - 120e3);
  const [recent] = await sql`select 1 from passwordtoken where user_id = ${user.id} and purpose = 'reset' and expires_at > ${cutoff}`;
  if (!recent) await sendLink(user, "reset"); // one link per two minutes is plenty
  return c.body(null, 204);
});

auth.get("/api/auth/token", async (c) => {
  const token = c.req.query("token");
  if (token === undefined) fail(422, [{ loc: ["query", "token"], msg: "Field required" }]);
  const [row, user] = await validToken(token!);
  if (!row) fail(410, "link_expired");
  return c.json({ name: user.name, email: user.email, purpose: row.purpose });
});

auth.post("/api/auth/reset", async (c) => {
  const b = validate<any>(await json(c), { token: {}, password: { min: 8, max: 200 } });
  const [row, user] = await validToken(b.token);
  if (!row) fail(410, "link_expired");
  await sql.begin(async (db: any) => {
    await db`update "user" set password_hash = ${await hashPassword(b.password)} where id = ${user.id}`;
    await db`update passwordtoken set used_at = ${utcNow()} where token_hash = ${row.token_hash}`;
    await endSessions(db, user.id);
  });
  return c.json({ email: user.email });
});

// --- Team (owner only) ------------------------------------------------------------

const owners = async () => (await sql`select count(*)::int as n from "user" where role = 'owner' and active = true`)[0].n;
const uidParam = (c: Context) => {
  const v = c.req.param("uid");
  if (!/^\d+$/.test(v)) fail(422, [{ loc: ["path", "uid"], msg: "Input should be a valid integer" }]);
  return Number(v);
};

auth.get("/api/admin/team", async (c) => {
  await requireRole(c, "owner");
  return c.json((await sql`select * from "user" order by created_at`).map(userRead));
});

auth.post("/api/admin/team", async (c) => {
  await requireRole(c, "owner");
  const b = validate<any>(await json(c), { name: { min: 1, max: 80 }, email: EMAIL, role: { def: "staff" } });
  if (!ROLES.includes(b.role)) fail(422, "invalid_role");
  const email = b.email.trim().toLowerCase();
  if ((await sql`select 1 from "user" where email = ${email}`).length) fail(409, "email_taken");
  const password = tempPassword();
  const [user] = await sql`insert into "user" ${sql({
    email, name: b.name.trim(), role: b.role, password_hash: await hashPassword(password), active: true, created_at: utcNow(),
  })} returning *`;
  // With email set up the invite goes by email; otherwise the temporary password is returned once.
  const emailed = await sendLink(user, "invite");
  return c.json({ user: userRead(user), emailed, temporary_password: emailed ? null : password }, 201);
});

auth.patch("/api/admin/team/:uid", async (c) => {
  const me = await requireRole(c, "owner");
  const uid = uidParam(c);
  const b = validate<any>(await json(c), {
    name: { min: 1, max: 80, optional: true }, role: { optional: true }, active: { type: "bool", optional: true },
  });
  const [user] = await sql`select * from "user" where id = ${uid}`;
  if (!user) fail(404, "not_found");
  const losingOwner = user.role === "owner" && ((b.role && b.role !== "owner") || b.active === false);
  if (losingOwner && (await owners()) <= 1) fail(409, "last_owner");
  const changes: Record<string, unknown> = {};
  if (b.role !== null) {
    if (!ROLES.includes(b.role)) fail(422, "invalid_role");
    changes.role = b.role;
  }
  if (b.name !== null) changes.name = b.name.trim();
  if (b.active !== null) {
    if (user.id === me.id && !b.active) fail(409, "cannot_disable_self");
    changes.active = b.active;
    if (!b.active) await endSessions(sql, user.id);
  }
  const [row] = Object.keys(changes).length
    ? await sql`update "user" set ${sql(changes)} where id = ${uid} returning *`
    : [user];
  return c.json(userRead(row));
});

auth.post("/api/admin/team/:uid/reset-password", async (c) => {
  await requireRole(c, "owner");
  const [user] = await sql`select * from "user" where id = ${uidParam(c)}`;
  if (!user) fail(404, "not_found");
  if (await sendLink(user, "reset")) return c.json({ emailed: true, temporary_password: null });
  const password = tempPassword();
  await sql`update "user" set password_hash = ${await hashPassword(password)} where id = ${user.id}`;
  await endSessions(sql, user.id);
  return c.json({ emailed: false, temporary_password: password });
});

auth.delete("/api/admin/team/:uid", async (c) => {
  const me = await requireRole(c, "owner");
  const [user] = await sql`select * from "user" where id = ${uidParam(c)}`;
  if (!user) fail(404, "not_found");
  if (user.id === me.id) fail(409, "cannot_remove_self");
  if (user.role === "owner" && (await owners()) <= 1) fail(409, "last_owner");
  await sql.begin(async (db: any) => {
    await endSessions(db, user.id);
    await db`delete from passwordtoken where user_id = ${user.id}`;
    await db`delete from "user" where id = ${user.id}`;
  });
  return c.body(null, 204);
});
