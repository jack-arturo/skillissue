import { csvEscape, getDb, isAuthorizedAdmin, jsonResponse } from '../lib/lead-capture/http.js';

function csvResponse(rows) {
  const csv = [
    'Kind,ID,Email,Name,Organization,Form,Source,Status,Consent,Created At,Data',
    ...rows.map(row => [
      row.kind,
      row.id,
      row.email,
      row.name,
      row.organization,
      row.form_id,
      row.source,
      row.status,
      row.consent_status,
      row.created_at,
      row.data,
    ].map(csvEscape).join(',')),
  ].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="lead-capture.csv"',
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequestGet({ request, env }) {
  if (!isAuthorizedAdmin(request, env)) return new Response('Unauthorized', { status: 401 });
  const db = getDb(env);
  if (!db) return jsonResponse({ success: false, error: 'D1 binding not found.' }, 500);

  const url = new URL(request.url);
  const limit = Math.min(Number.parseInt(url.searchParams.get('limit') || '250', 10) || 250, 1000);

  const stats = await db.prepare('SELECT * FROM lead_capture_stats').first();
  const contacts = await db
    .prepare('SELECT id, email, name, organization, source, consent_status, created_at, updated_at FROM contacts ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all();
  const submissions = await db
    .prepare(`SELECT s.id, s.form_id, s.email, c.name, c.organization, s.source, s.status, c.consent_status, s.created_at, s.data
              FROM submissions s
              LEFT JOIN contacts c ON c.id = s.contact_id
              ORDER BY s.created_at DESC
              LIMIT ?`)
    .bind(limit)
    .all();

  if (url.searchParams.get('format') === 'csv') {
    const rows = [
      ...(contacts.results || []).map(row => ({ kind: 'contact', ...row, form_id: '', status: '', data: '' })),
      ...(submissions.results || []).map(row => ({ kind: 'submission', organization: row.organization || '', ...row })),
    ];
    return csvResponse(rows);
  }

  return jsonResponse({
    success: true,
    stats,
    contacts: contacts.results || [],
    submissions: submissions.results || [],
  });
}
