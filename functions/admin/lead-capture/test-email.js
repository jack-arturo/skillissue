import { sendTemplateEmail } from '../../lib/lead-capture/email.js';
import { clean, getDb, isAuthorizedAdmin, isValidEmail, jsonResponse, parseRequestBody } from '../../lib/lead-capture/http.js';

export async function onRequestPost({ request, env }) {
  if (!isAuthorizedAdmin(request, env)) return new Response('Unauthorized', { status: 401 });
  const db = getDb(env);
  if (!db) return jsonResponse({ success: false, error: 'D1 binding not found.' }, 500);
  const body = await parseRequestBody(request);
  const to = clean(body.to, 320).toLowerCase();
  const templateKey = clean(body.template_key || 'test-email', 120);
  if (!isValidEmail(to)) return jsonResponse({ success: false, error: 'Enter a valid recipient email.' }, 400);
  const result = await sendTemplateEmail({
    db,
    request,
    env,
    to,
    templateKey,
    variables: body.variables && typeof body.variables === 'object' ? body.variables : {},
    data: { form_id: 'test-email' },
  });
  return jsonResponse({ success: result.sent, email_configured: result.configured, email_sent: result.sent, provider_id: result.provider_id || null });
}
