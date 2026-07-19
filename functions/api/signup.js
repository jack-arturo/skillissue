import { sendTemplateEmail } from '../lib/lead-capture/email.js';
import { clean, cleanLong, getDb, getTurnstileToken, isValidEmail, jsonResponse, parseRequestBody, pickUtm, stripPrivateFields } from '../lib/lead-capture/http.js';
import { validateTurnstile } from '../lib/lead-capture/turnstile.js';

export async function onRequestPost({ request, env }) {
  try {
    const db = getDb(env);
    if (!db) return jsonResponse({ success: false, error: 'Lead database is unavailable.' }, 500);

    const body = await parseRequestBody(request);
    const email = clean(body.email, 320).toLowerCase();
    const name = clean(body.name);
    const organization = clean(body.organization);
    const source = clean(body.source || 'signup', 120) || 'signup';

    if (!isValidEmail(email)) {
      return jsonResponse({ success: false, error: 'Enter a valid email address.' }, 400);
    }

    const turnstile = await validateTurnstile({ request, env, token: getTurnstileToken(body) });
    if (!turnstile.success) {
      return jsonResponse({ success: false, error: 'Verification failed. Please try again.' }, 400);
    }

    const now = new Date().toISOString();
    const consentStatus = body.consent === false || body.consent === 'false' ? 'pending' : 'subscribed';
    const metadata = JSON.stringify({ turnstile_configured: turnstile.configured, user_agent: cleanLong(request.headers.get('user-agent'), 500) });

    await db
      .prepare(
        `INSERT INTO contacts (email, name, organization, source, consent_status, consented_at, created_at, updated_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           name = COALESCE(NULLIF(excluded.name, ''), contacts.name),
           organization = COALESCE(NULLIF(excluded.organization, ''), contacts.organization),
           source = excluded.source,
           consent_status = excluded.consent_status,
           consented_at = COALESCE(excluded.consented_at, contacts.consented_at),
           unsubscribed_at = CASE WHEN excluded.consent_status = 'subscribed' THEN NULL ELSE contacts.unsubscribed_at END,
           updated_at = excluded.updated_at,
           metadata = excluded.metadata`
      )
      .bind(email, name || null, organization || null, source, consentStatus, consentStatus === 'subscribed' ? now : null, now, now, metadata)
      .run();

    const contact = await db.prepare('SELECT id, email, name FROM contacts WHERE email = ?').bind(email).first();
    const data = stripPrivateFields({ ...body, form_id: 'signup' });
    const utm = pickUtm(request, body);
    const submissionResult = await db
      .prepare(
        `INSERT INTO submissions
          (form_id, contact_id, email, data, source, utm_source, utm_medium, utm_campaign, utm_term, utm_content, status, created_at, metadata)
         VALUES ('signup', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`
      )
      .bind(contact?.id || null, email, JSON.stringify(data), source, utm.utm_source, utm.utm_medium, utm.utm_campaign, utm.utm_term, utm.utm_content, now, metadata)
      .run();

    const emailResult = consentStatus === 'subscribed'
      ? await sendTemplateEmail({
          db,
          request,
          env,
          to: email,
          templateKey: clean(body.template_key || 'welcome', 120),
          variables: { name, formId: 'signup' },
          data,
          contactId: contact?.id || null,
          submissionId: submissionResult?.meta?.last_row_id || null,
        })
      : { configured: false, sent: false };

    return jsonResponse({
      success: true,
      message: 'Signup captured.',
      contact_id: contact?.id || null,
      submission_id: submissionResult?.meta?.last_row_id || null,
      email_configured: emailResult.configured,
      email_sent: emailResult.sent,
    });
  } catch {
    return jsonResponse({ success: false, error: 'Signup failed. Please try again.' }, 500);
  }
}
