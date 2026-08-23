import { escapeHtml, getDb, htmlResponse } from './lib/lead-capture/http.js';
import { verifyToken } from './lib/lead-capture/tokens.js';

function page(title, message) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin:0; padding:48px 20px; background:#0f1720; color:#edf4ef; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align:center; }
      main { max-width:560px; margin:0 auto; border:1px solid #2d3b47; padding:32px; background:#151f2a; }
      h1 { margin:0 0 12px; font-size:28px; }
      p { margin:0; color:#c9d8d1; line-height:1.55; }
    </style>
  </head>
  <body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main></body>
</html>`;
}

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const secret = env.CONFIRM_SECRET || env.ADMIN_TOKEN || env.RESEND_API_KEY || '';
  const email = await verifyToken(token, secret);
  if (!email) {
    return htmlResponse(page('Invalid link', 'This unsubscribe link is invalid or expired.'), 400);
  }

  const db = getDb(env);
  if (!db) return htmlResponse(page('Unavailable', 'The contact database is unavailable.'), 500);

  try {
    const now = new Date().toISOString();
    await db
      .prepare("UPDATE contacts SET consent_status = 'unsubscribed', unsubscribed_at = ?, updated_at = ? WHERE email = ?")
      .bind(now, now, email.toLowerCase())
      .run();
    return htmlResponse(page('Unsubscribed', `${email} has been removed from the list.`));
  } catch {
    return htmlResponse(page('Unsubscribe failed', 'Please try the link again in a moment.'), 500);
  }
}
