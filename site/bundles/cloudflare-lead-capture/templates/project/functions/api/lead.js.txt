import { sendTemplateEmail } from '../lib/lead-capture/email.js';
import { clean, cleanLong, getDb, getTurnstileToken, isValidEmail, jsonResponse, parseRequestBody, pickUtm, stripPrivateFields } from '../lib/lead-capture/http.js';
import { validateTurnstile } from '../lib/lead-capture/turnstile.js';

function parseFormSchema(row) {
  try {
    return row && row.schema ? JSON.parse(row.schema) : { required: ['email'] };
  } catch {
    return { required: ['email'] };
  }
}

function valueForRequired(field, body, data, email) {
  if (field === 'email') return email;
  return data[field] ?? body[field];
}

export async function onRequestPost({ request, env }) {
  try {
    const db = getDb(env);
    if (!db) return jsonResponse({ success: false, error: 'Lead database is unavailable.' }, 500);

    const body = await parseRequestBody(request);
    const formId = clean(body.form_id || body.form || 'lead', 80) || 'lead';
    const email = clean(body.email, 320).toLowerCase();
    const name = clean(body.name);
    const organization = clean(body.organization);
    const source = clean(body.source || formId, 120) || formId;
    const rawData = body.fields && typeof body.fields === 'object' ? { ...body.fields } : stripPrivateFields(body);
    const data = stripPrivateFields({ ...rawData, name, organization, form_id: formId });

    if (!isValidEmail(email)) {
      return jsonResponse({ success: false, error: 'Enter a valid email address.' }, 400);
    }

    const form = await db.prepare('SELECT * FROM forms WHERE id = ?').bind(formId).first();
    const formSchema = parseFormSchema(form);
    for (const field of formSchema.required || ['email']) {
      const value = valueForRequired(field, body, data, email);
      if (!cleanLong(value, 4000)) {
        return jsonResponse({ success: false, error: `Missing required field: ${field}` }, 400);
      }
    }

    const turnstile = await validateTurnstile({ request, env, token: getTurnstileToken(body) });
    if (!turnstile.success) {
      return jsonResponse({ success: false, error: 'Verification failed. Please try again.' }, 400);
    }

    const now = new Date().toISOString();
    const metadata = JSON.stringify({ turnstile_configured: turnstile.configured, user_agent: cleanLong(request.headers.get('user-agent'), 500) });

    await db
      .prepare(
        `INSERT INTO contacts (email, name, organization, source, consent_status, consented_at, created_at, updated_at, metadata)
         VALUES (?, ?, ?, ?, 'subscribed', ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           name = COALESCE(NULLIF(excluded.name, ''), contacts.name),
           organization = COALESCE(NULLIF(excluded.organization, ''), contacts.organization),
           source = excluded.source,
           consent_status = CASE WHEN contacts.consent_status = 'unsubscribed' THEN contacts.consent_status ELSE 'subscribed' END,
           consented_at = COALESCE(contacts.consented_at, excluded.consented_at),
           updated_at = excluded.updated_at,
           metadata = excluded.metadata`
      )
      .bind(email, name || null, organization || null, source, now, now, now, metadata)
      .run();

    const contact = await db.prepare('SELECT id, email, name, consent_status FROM contacts WHERE email = ?').bind(email).first();
    const utm = pickUtm(request, body);
    const submissionResult = await db
      .prepare(
        `INSERT INTO submissions
          (form_id, contact_id, email, data, source, utm_source, utm_medium, utm_campaign, utm_term, utm_content, status, created_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`
      )
      .bind(formId, contact?.id || null, email, JSON.stringify(data), source, utm.utm_source, utm.utm_medium, utm.utm_campaign, utm.utm_term, utm.utm_content, now, metadata)
      .run();

    const submissionId = submissionResult?.meta?.last_row_id || null;
    const leadEmail = contact?.consent_status !== 'unsubscribed'
      ? await sendTemplateEmail({
          db,
          request,
          env,
          to: email,
          templateKey: clean(body.template_key || form?.email_template_key || 'lead-confirmation', 120),
          variables: { name, formId },
          data,
          contactId: contact?.id || null,
          submissionId,
        })
      : { configured: false, sent: false };

    let notifyEmail = { configured: false, sent: false };
    if (env.LEAD_NOTIFY_EMAIL) {
      notifyEmail = await sendTemplateEmail({
        db,
        request,
        env,
        to: env.LEAD_NOTIFY_EMAIL,
        templateKey: clean(form?.notify_template_key || 'internal-notification', 120),
        variables: { name, formId, email },
        data,
        contactId: contact?.id || null,
        submissionId,
      });
    }

    return jsonResponse({
      success: true,
      message: 'Lead captured.',
      contact_id: contact?.id || null,
      submission_id: submissionId,
      email_configured: leadEmail.configured,
      email_sent: leadEmail.sent,
      notification_sent: notifyEmail.sent,
    });
  } catch {
    return jsonResponse({ success: false, error: 'Lead submission failed. Please try again.' }, 500);
  }
}
