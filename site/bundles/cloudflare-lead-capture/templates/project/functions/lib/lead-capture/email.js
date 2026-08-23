import { createToken } from './tokens.js';
import { escapeHtml, getBaseUrl, getFrom, isEmailConfigured, summarizeData } from './http.js';

const DEFAULT_TEMPLATES = {
  welcome: {
    subject: 'Welcome to {{appName}}',
    html: '<h1>You are on the list.</h1><p>Thanks{{namePhrase}}. We will follow up soon.</p><p><a href="{{baseUrl}}">Visit {{appName}}</a></p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>',
    text: 'Welcome to {{appName}}.\n\nThanks{{namePhrase}}. We will follow up soon.\n\nSite: {{baseUrl}}\nUnsubscribe: {{unsubscribeUrl}}',
  },
  'lead-confirmation': {
    subject: 'We received your note',
    html: '<h1>Your note is in.</h1><p>Thanks{{namePhrase}}. We received your message and will follow up with the next practical step.</p><p><a href="{{baseUrl}}">Visit {{appName}}</a></p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>',
    text: 'Your note is in.\n\nThanks{{namePhrase}}. We received your message and will follow up with the next practical step.\n\nSite: {{baseUrl}}\nUnsubscribe: {{unsubscribeUrl}}',
  },
  'internal-notification': {
    subject: 'New {{formId}} lead from {{email}}',
    html: '<h1>New {{formId}} lead</h1><p><strong>Email:</strong> {{email}}</p><p><strong>Name:</strong> {{name}}</p><pre>{{dataSummary}}</pre>',
    text: 'New {{formId}} lead\n\nEmail: {{email}}\nName: {{name}}\n\n{{dataSummary}}',
  },
  'test-email': {
    subject: '{{appName}} test email',
    html: '<h1>{{appName}} test email</h1><p>If you received this, Resend is configured.</p>',
    text: '{{appName}} test email\n\nIf you received this, Resend is configured.',
  },
};

function render(template, variables, html = false) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const value = variables[key] ?? '';
    return html ? escapeHtml(value) : String(value);
  });
}

async function getTemplateSet(db, key) {
  const fallback = DEFAULT_TEMPLATES[key] || DEFAULT_TEMPLATES['lead-confirmation'];
  const set = { ...fallback };
  if (!db) return set;
  try {
    const { results } = await db
      .prepare('SELECT channel, body FROM email_templates WHERE key = ?')
      .bind(key)
      .all();
    for (const row of results || []) {
      set[row.channel] = row.body;
    }
  } catch {
    return set;
  }
  return set;
}

async function recordEmailEvent(db, event) {
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT INTO email_events
          (contact_id, submission_id, template_key, provider, provider_id, to_email, status, error, created_at)
         VALUES (?, ?, ?, 'resend', ?, ?, ?, ?, ?)`
      )
      .bind(
        event.contactId || null,
        event.submissionId || null,
        event.templateKey || null,
        event.providerId || null,
        event.to,
        event.status,
        event.error || null,
        new Date().toISOString()
      )
      .run();
  } catch {
    // Email event logging should not block lead capture.
  }
}

function buildVariables({ request, env, to, variables = {}, data = {}, unsubscribeUrl }) {
  const appName = env.FROM_NAME || '__FROM_NAME__';
  const baseUrl = getBaseUrl(request, env);
  const name = variables.name || data.name || '';
  return {
    appName,
    baseUrl,
    email: to,
    name,
    namePhrase: name ? `, ${name}` : '',
    formId: variables.formId || data.form_id || data.formId || 'lead',
    dataSummary: variables.dataSummary || summarizeData(data),
    unsubscribeUrl,
    ...variables,
  };
}

export async function sendTemplateEmail({ db, request, env, to, templateKey, variables = {}, data = {}, contactId = null, submissionId = null }) {
  if (!isEmailConfigured(env)) {
    return { configured: false, sent: false };
  }

  const secret = env.CONFIRM_SECRET || env.ADMIN_TOKEN || env.RESEND_API_KEY;
  const baseUrl = getBaseUrl(request, env);
  const unsubscribeToken = secret ? await createToken(to, secret) : '';
  const unsubscribeUrl = unsubscribeToken ? `${baseUrl}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}` : `${baseUrl}/unsubscribe`;
  const template = await getTemplateSet(db, templateKey);
  const renderedVariables = buildVariables({ request, env, to, variables, data, unsubscribeUrl });
  const subject = render(template.subject, renderedVariables, false).slice(0, 200);
  const html = render(template.html, renderedVariables, true);
  const text = render(template.text, renderedVariables, false);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getFrom(env),
        to: [to],
        subject,
        html,
        text,
      }),
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    await recordEmailEvent(db, {
      contactId,
      submissionId,
      templateKey,
      providerId: payload.id || null,
      to,
      status: response.ok ? 'sent' : 'failed',
      error: response.ok ? null : JSON.stringify(payload).slice(0, 500),
    });

    return { configured: true, sent: response.ok, provider_id: payload.id || null };
  } catch (error) {
    await recordEmailEvent(db, {
      contactId,
      submissionId,
      templateKey,
      to,
      status: 'failed',
      error: error && error.message ? error.message.slice(0, 500) : 'Email send failed',
    });
    return { configured: true, sent: false };
  }
}
