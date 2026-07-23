import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();
const P = "/make-server-b938ffa6";

app.use('*', logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const newUid = () => crypto.randomUUID();
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function hashPw(password: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + password));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
}

function makeInviteCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(3))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function getSession(c: any): Promise<{ userId: string; fleetId: string } | null> {
  const t = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!t) return null;
  return await kv.get(`session:${t}`);
}

function safeUser(u: any) {
  const { passwordHash: _, salt: __, ...rest } = u;
  return rest;
}

// ─── Health ───────────────────────────────────────────────────────────────────

app.get(`${P}/health`, c => c.json({ status: "ok" }));

// ─── Signup ───────────────────────────────────────────────────────────────────

app.post(`${P}/auth/signup`, async c => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid request body.' }, 400);

  const { username, email, password, inviteCode, fleetName } = body;

  if (!username || !email || !password)
    return c.json({ error: 'Username, email, and password are required.' }, 400);
  if (!validEmail(email))
    return c.json({ error: 'Please enter a valid email address.' }, 400);
  if (password.length < 6)
    return c.json({ error: 'Password must be at least 6 characters.' }, 400);
  if (username.length < 2)
    return c.json({ error: 'Username must be at least 2 characters.' }, 400);
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return c.json({ error: 'Username may only contain letters, numbers, and underscores.' }, 400);

  const emailKey = `email:${email.toLowerCase()}`;
  const usernameKey = `username:${username.toLowerCase()}`;

  if (await kv.get(emailKey)) return c.json({ error: 'An account with this email already exists.' }, 409);
  if (await kv.get(usernameKey)) return c.json({ error: 'That username is already taken.' }, 409);

  let fleetId: string;
  let role: 'admin' | 'driver';

  if (inviteCode) {
    // Join existing fleet as driver
    const fid = await kv.get(`invite:${inviteCode.trim().toUpperCase()}`);
    if (!fid) return c.json({ error: 'Invalid fleet invite code. Check with your admin.' }, 400);
    fleetId = fid;
    role = 'driver';
  } else {
    // Create new fleet as admin
    fleetId = newUid();
    const ic = makeInviteCode();
    const fleet = { id: fleetId, name: fleetName?.trim() || 'My Fleet', inviteCode: ic, createdAt: new Date().toISOString() };
    await kv.set(`fleet:${fleetId}`, fleet);
    await kv.set(`invite:${ic}`, fleetId);
    await kv.set(`fleet:${fleetId}:vehicles`, []);
    await kv.set(`fleet:${fleetId}:templates`, null); // client uses defaults
    await kv.set(`fleet:${fleetId}:submissions`, []);
    await kv.set(`fleet:${fleetId}:maintenance`, []);
    await kv.set(`fleet:${fleetId}:members`, []);
    role = 'admin';
  }

  const salt = randHex(16);
  const passwordHash = await hashPw(password, salt);
  const userId = newUid();
  const user = {
    id: userId, username, email: email.toLowerCase(),
    passwordHash, salt, name: username,
    role, fleetId, createdAt: new Date().toISOString(),
  };

  await kv.set(`user:${userId}`, user);
  await kv.set(emailKey, userId);
  await kv.set(usernameKey, userId);

  const members: string[] = await kv.get(`fleet:${fleetId}:members`) ?? [];
  await kv.set(`fleet:${fleetId}:members`, [...members, userId]);

  const sessionToken = randHex(32);
  await kv.set(`session:${sessionToken}`, { userId, fleetId });

  return c.json({ token: sessionToken, user: safeUser(user) });
});

// ─── Login ────────────────────────────────────────────────────────────────────

app.post(`${P}/auth/login`, async c => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid request body.' }, 400);

  const { email, password } = body;
  if (!email || !password) return c.json({ error: 'Email and password are required.' }, 400);

  const userId = await kv.get(`email:${email.toLowerCase()}`);
  if (!userId) return c.json({ error: 'Invalid email or password.' }, 401);

  const user = await kv.get(`user:${userId}`);
  if (!user) return c.json({ error: 'Invalid email or password.' }, 401);

  const hash = await hashPw(password, user.salt);
  if (hash !== user.passwordHash) return c.json({ error: 'Invalid email or password.' }, 401);

  const sessionToken = randHex(32);
  await kv.set(`session:${sessionToken}`, { userId, fleetId: user.fleetId });

  return c.json({ token: sessionToken, user: safeUser(user) });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

app.delete(`${P}/auth/logout`, async c => {
  const t = c.req.header('Authorization')?.replace('Bearer ', '');
  if (t) await kv.del(`session:${t}`);
  return c.json({ ok: true });
});

// ─── Update my profile ────────────────────────────────────────────────────────

app.put(`${P}/me`, async c => {
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Unauthorized.' }, 401);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid request body.' }, 400);

  const user = await kv.get(`user:${session.userId}`);
  if (!user) return c.json({ error: 'User not found.' }, 404);

  const updates: any = {};

  if (body.name?.trim()) updates.name = body.name.trim();

  if (body.email && body.email.toLowerCase() !== user.email) {
    if (!validEmail(body.email)) return c.json({ error: 'Invalid email address.' }, 400);
    if (await kv.get(`email:${body.email.toLowerCase()}`)) return c.json({ error: 'Email already in use.' }, 409);
    await kv.del(`email:${user.email}`);
    await kv.set(`email:${body.email.toLowerCase()}`, session.userId);
    updates.email = body.email.toLowerCase();
  }

  if (body.password) {
    if (body.password.length < 6) return c.json({ error: 'Password must be at least 6 characters.' }, 400);
    const salt = randHex(16);
    updates.salt = salt;
    updates.passwordHash = await hashPw(body.password, salt);
  }

  const updated = { ...user, ...updates };
  await kv.set(`user:${session.userId}`, updated);

  return c.json({ user: safeUser(updated) });
});

// ─── Fleet info ───────────────────────────────────────────────────────────────

app.get(`${P}/fleet/:id`, async c => {
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Unauthorized.' }, 401);

  const fleet = await kv.get(`fleet:${c.req.param('id')}`);
  if (!fleet) return c.json({ error: 'Fleet not found.' }, 404);

  const memberIds: string[] = await kv.get(`fleet:${c.req.param('id')}:members`) ?? [];
  const members = (await Promise.all(memberIds.map(id => kv.get(`user:${id}`)))).filter(Boolean).map(safeUser);

  return c.json({ fleet, members });
});

// ─── Add admin account ────────────────────────────────────────────────────────

app.post(`${P}/fleet/:id/admins`, async c => {
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Unauthorized.' }, 401);

  const me = await kv.get(`user:${session.userId}`);
  if (me?.role !== 'admin') return c.json({ error: 'Forbidden.' }, 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid request.' }, 400);

  const { username, email, password } = body;
  if (!username || !email || !password) return c.json({ error: 'All fields required.' }, 400);
  if (!validEmail(email)) return c.json({ error: 'Invalid email.' }, 400);
  if (password.length < 6) return c.json({ error: 'Password must be at least 6 characters.' }, 400);
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return c.json({ error: 'Username may only contain letters, numbers, and underscores.' }, 400);

  if (await kv.get(`email:${email.toLowerCase()}`)) return c.json({ error: 'Email already in use.' }, 409);
  if (await kv.get(`username:${username.toLowerCase()}`)) return c.json({ error: 'Username taken.' }, 409);

  const salt = randHex(16);
  const passwordHash = await hashPw(password, salt);
  const userId = newUid();
  const fleetId = c.req.param('id');
  const user = { id: userId, username, email: email.toLowerCase(), passwordHash, salt, name: username, role: 'admin', fleetId, createdAt: new Date().toISOString() };

  await kv.set(`user:${userId}`, user);
  await kv.set(`email:${email.toLowerCase()}`, userId);
  await kv.set(`username:${username.toLowerCase()}`, userId);

  const members: string[] = await kv.get(`fleet:${fleetId}:members`) ?? [];
  await kv.set(`fleet:${fleetId}:members`, [...members, userId]);

  return c.json({ user: safeUser(user) });
});

// ─── Remove fleet member ──────────────────────────────────────────────────────

app.delete(`${P}/fleet/:id/members/:memberId`, async c => {
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Unauthorized.' }, 401);

  const me = await kv.get(`user:${session.userId}`);
  if (me?.role !== 'admin') return c.json({ error: 'Forbidden.' }, 403);
  if (c.req.param('memberId') === session.userId) return c.json({ error: 'You cannot remove yourself.' }, 400);

  const fleetId = c.req.param('id');
  const members: string[] = await kv.get(`fleet:${fleetId}:members`) ?? [];
  await kv.set(`fleet:${fleetId}:members`, members.filter(id => id !== c.req.param('memberId')));

  const removed = await kv.get(`user:${c.req.param('memberId')}`);
  if (removed) {
    await kv.del(`user:${c.req.param('memberId')}`);
    await kv.del(`email:${removed.email}`);
    await kv.del(`username:${removed.username?.toLowerCase()}`);
  }

  return c.json({ ok: true });
});

// ─── Regenerate invite code ────────────────────────────────────────────────────

app.post(`${P}/fleet/:id/regenerate-invite`, async c => {
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Unauthorized.' }, 401);

  const me = await kv.get(`user:${session.userId}`);
  if (me?.role !== 'admin') return c.json({ error: 'Forbidden.' }, 403);

  const fleetId = c.req.param('id');
  const fleet = await kv.get(`fleet:${fleetId}`);
  if (!fleet) return c.json({ error: 'Fleet not found.' }, 404);

  if (fleet.inviteCode) await kv.del(`invite:${fleet.inviteCode}`);
  const ic = makeInviteCode();
  await kv.set(`invite:${ic}`, fleetId);
  await kv.set(`fleet:${fleetId}`, { ...fleet, inviteCode: ic });

  return c.json({ inviteCode: ic });
});

// ─── Fleet data (vehicles, templates, submissions, maintenance) ───────────────

for (const entity of ['vehicles', 'templates', 'submissions', 'maintenance']) {
  app.get(`${P}/fleet/:id/${entity}`, async c => {
    const session = await getSession(c);
    if (!session) return c.json({ error: 'Unauthorized.' }, 401);
    const data = await kv.get(`fleet:${c.req.param('id')}:${entity}`);
    return c.json(data ?? []);
  });

  app.put(`${P}/fleet/:id/${entity}`, async c => {
    const session = await getSession(c);
    if (!session) return c.json({ error: 'Unauthorized.' }, 401);
    const body = await c.req.json();
    await kv.set(`fleet:${c.req.param('id')}:${entity}`, body);
    return c.json({ ok: true });
  });
}

Deno.serve(app.fetch);
