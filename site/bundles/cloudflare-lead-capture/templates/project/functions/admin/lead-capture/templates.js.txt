import { clean, getDb, isAuthorizedAdmin, jsonResponse, parseRequestBody } from '../../lib/lead-capture/http.js';

const CHANNELS = new Set(['subject', 'html', 'text']);

export async function onRequestGet({ request, env }) {
  if (!isAuthorizedAdmin(request, env)) return new Response('Unauthorized', { status: 401 });
  const db = getDb(env);
  if (!db) return jsonResponse({ success: false, error: 'D1 binding not found.' }, 500);
  const { results } = await db
    .prepare('SELECT key, channel, name, body, updated_at FROM email_templates ORDER BY key, channel')
    .all();
  return jsonResponse({ success: true, templates: results || [] });
}

export async function onRequestPost({ request, env }) {
  if (!isAuthorizedAdmin(request, env)) return new Response('Unauthorized', { status: 401 });
  const db = getDb(env);
  if (!db) return jsonResponse({ success: false, error: 'D1 binding not found.' }, 500);
  const body = await parseRequestBody(request);
  const key = clean(body.key, 120);
  const channel = clean(body.channel, 20);
  const name = clean(body.name || `${key} ${channel}`, 160);
  const templateBody = String(body.body || '').slice(0, 20000);
  if (!key || !CHANNELS.has(channel) || !templateBody) {
    return jsonResponse({ success: false, error: 'Template key, channel, and body are required.' }, 400);
  }
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO email_templates (key, channel, name, body, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key, channel) DO UPDATE SET name = excluded.name, body = excluded.body, updated_at = excluded.updated_at`
    )
    .bind(key, channel, name, templateBody, now)
    .run();
  return jsonResponse({ success: true, key, channel, updated_at: now });
}
