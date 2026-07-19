import type { APIRoute } from 'astro';
// Astro 6 removed `locals.runtime.env`; worker bindings come from this module.
import { env as cfEnv } from 'cloudflare:workers';

// SSR endpoint — must run on the worker, never prerendered.
export const prerender = false;

interface Env {
  __D1_BINDING__: D1Database;
  RESEND_API_KEY: string; // Worker secret: `wrangler secret put RESEND_API_KEY`
  NOTIFY_FROM: string; // wrangler var, e.g. "__FROM_NAME__ <__FROM_EMAIL__>"
  NOTIFY_TO: string; // wrangler var, destination inbox for notifications
}

const env = cfEnv as unknown as Env;
const db = () => env.__D1_BINDING__;

const MAX = { name: 200, email: 254, organization: 200, message: 5000, honeypot: 100 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

// Best-effort notification. A send failure must NOT lose the saved lead.
async function notify(m: { name: string; email: string; organization: string; message: string }): Promise<void> {
  if (!env.RESEND_API_KEY || !env.NOTIFY_TO) return; // notification not configured — lead is still saved
  const rows = [
    `<p><strong>Name:</strong> ${escapeHtml(m.name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(m.email)}</p>`,
    m.organization ? `<p><strong>Organization:</strong> ${escapeHtml(m.organization)}</p>` : '',
    `<p><strong>Message:</strong></p><p>${escapeHtml(m.message).replace(/\n/g, '<br>')}</p>`,
  ].filter(Boolean).join('');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.NOTIFY_FROM || '__FROM_NAME__ <__FROM_EMAIL__>',
      to: [env.NOTIFY_TO],
      reply_to: m.email,
      subject: `New lead from ${m.name || m.email}`,
      html: `<h2>New lead</h2>${rows}`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const accept = request.headers.get('accept') || '';
  const wantsJson = accept.includes('application/json') || request.headers.get('x-requested-with') === 'fetch';

  // Parse JSON or form-encoded bodies.
  let data: Record<string, string> = {};
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = (await request.json()) as Record<string, string>;
    } else {
      const form = await request.formData();
      for (const [k, v] of form.entries()) data[k] = typeof v === 'string' ? v : '';
    }
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  // Honeypot: real users never fill the hidden "company" field.
  if (field(data.company, MAX.honeypot)) {
    return wantsJson ? json({ ok: true }, 200) : Response.redirect(new URL('?sent=1', request.url), 303);
  }

  const name = field(data.name, MAX.name);
  const email = field(data.email, MAX.email).toLowerCase();
  const organization = field(data.organization, MAX.organization);
  const message = field(data.message, MAX.message);
  if (!email || !EMAIL_RE.test(email) || !message) {
    return json({ ok: false, error: 'Please provide a valid email address and a message.' }, 400);
  }

  const now = new Date().toISOString();
  const ua = (request.headers.get('user-agent') || '').slice(0, 500);
  const ip = (clientAddress || request.headers.get('cf-connecting-ip') || '').slice(0, 60);
  const formId = field(data.form_id, 80) || 'contact';
  const source = field(data.source, 120) || formId;

  // 1. Persist the lead first — it is the system of record and must not be lost.
  //    Writes to the shared `contacts` + `submissions` tables (schema/lead-capture.sql),
  //    so the admin UI / CSV export see Astro-SSR leads too.
  try {
    await db()
      .prepare(
        `INSERT INTO contacts (email, name, organization, source, consent_status, consented_at, created_at, updated_at, metadata)
         VALUES (?, ?, ?, ?, 'subscribed', ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           name = COALESCE(NULLIF(excluded.name, ''), contacts.name),
           organization = COALESCE(NULLIF(excluded.organization, ''), contacts.organization),
           source = excluded.source,
           updated_at = excluded.updated_at`
      )
      .bind(email, name, organization, source, now, now, now, JSON.stringify({ ip, ua }))
      .run();

    const contact = await db().prepare('SELECT id FROM contacts WHERE email = ?').bind(email).first<{ id: number }>();
    await db()
      .prepare(
        `INSERT INTO submissions (form_id, contact_id, email, data, source, status, created_at, metadata)
         VALUES (?, ?, ?, ?, ?, 'new', ?, ?)`
      )
      .bind(formId, contact?.id ?? null, email, JSON.stringify({ name, organization, message }), source, now, JSON.stringify({ ip, ua }))
      .run();
  } catch (err) {
    console.error('contact: D1 insert failed', err);
    return json({ ok: false, error: 'Something went wrong saving your message. Please try again.' }, 500);
  }

  // 2. Notify by email — best-effort. A send failure must NOT lose the saved lead.
  try {
    await notify({ name, email, organization, message });
  } catch (err) {
    console.error('contact: notification failed (lead saved)', err);
  }

  return wantsJson ? json({ ok: true }, 200) : Response.redirect(new URL('?sent=1', request.url), 303);
};

// Anything other than POST is not allowed on this endpoint.
export const ALL: APIRoute = () => json({ ok: false, error: 'Method not allowed.' }, 405);
