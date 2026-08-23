const encoder = new TextEncoder();

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function getDb(env) {
  return env.__D1_BINDING__ || env.LEAD_DB || env.D1 || env.DB;
}

export function getBaseUrl(request, env) {
  const url = new URL(request.url);
  return env.BASE_URL || `${url.protocol}//${url.host}`;
}

export function getFrom(env) {
  const fromEmail = env.FROM_EMAIL || '__FROM_EMAIL__';
  const fromName = env.FROM_NAME || '__FROM_NAME__';
  return `${fromName} <${fromEmail}>`;
}

export function isEmailConfigured(env) {
  return Boolean(env.RESEND_API_KEY) && String(env.SEND_LEAD_CAPTURE_EMAIL || 'true').toLowerCase() !== 'false';
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

export function clean(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

export function cleanLong(value, maxLength = 4000) {
  return String(value || '').trim().slice(0, maxLength);
}

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function parseRequestBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await request.json();
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(await request.text());
    return Object.fromEntries(params.entries());
  }
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const body = {};
    for (const [key, value] of form.entries()) {
      body[key] = typeof value === 'string' ? value : value.name;
    }
    return body;
  }
  return {};
}

export function getTurnstileToken(body) {
  return clean(body.turnstileToken || body['cf-turnstile-response'] || '', 2048);
}

export function pickUtm(request, body = {}) {
  const url = new URL(request.url);
  const get = key => clean(body[key] || url.searchParams.get(key) || '', 120) || null;
  return {
    utm_source: get('utm_source'),
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    utm_term: get('utm_term'),
    utm_content: get('utm_content'),
  };
}

export function stripPrivateFields(value) {
  const blocked = new Set(['turnstileToken', 'cf-turnstile-response', 'password', 'token', 'secret']);
  const output = {};
  for (const [key, raw] of Object.entries(value || {})) {
    if (blocked.has(key)) continue;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      output[key] = stripPrivateFields(raw);
    } else if (Array.isArray(raw)) {
      output[key] = raw.map(item => cleanLong(item, 1000)).slice(0, 25);
    } else {
      output[key] = cleanLong(raw, 4000);
    }
  }
  return output;
}

export function summarizeData(data = {}) {
  return Object.entries(data)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('\n')
    .slice(0, 4000);
}

function constantTimeEqual(a, b) {
  const left = encoder.encode(String(a || ''));
  const right = encoder.encode(String(b || ''));
  const length = Math.max(left.length, right.length);
  let mismatch = left.length === right.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] || 0) ^ (right[index] || 0);
  }
  return mismatch === 0;
}

export function getAdminToken(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return new URL(request.url).searchParams.get('token') || '';
}

export function isAuthorizedAdmin(request, env) {
  const expected = env.ADMIN_TOKEN || '';
  const provided = getAdminToken(request);
  return Boolean(expected && provided && constantTimeEqual(provided, expected));
}

export function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
