const encoder = new TextEncoder();

function toBase64Url(value) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return atob(padded);
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeHexEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  const length = Math.max(left.length, right.length);
  let mismatch = left.length === right.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

async function getKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(String(secret || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function createToken(email, secret, ttlSeconds = 60 * 60 * 24 * 30) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${String(email).toLowerCase()}.${exp}`;
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${toBase64Url(payload)}.${toHex(sig)}`;
}

export async function verifyToken(token, secret) {
  try {
    const lastDot = String(token || '').lastIndexOf('.');
    if (lastDot === -1 || !secret) return null;
    const b64 = token.slice(0, lastDot);
    const sigHex = token.slice(lastDot + 1);
    const payload = fromBase64Url(b64);
    const payloadDot = payload.lastIndexOf('.');
    if (payloadDot === -1) return null;
    const email = payload.slice(0, payloadDot);
    const exp = Number.parseInt(payload.slice(payloadDot + 1), 10);
    if (!email || !Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
    const key = await getKey(secret);
    const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(`${email}.${exp}`));
    return timingSafeHexEqual(toHex(expected), sigHex) ? email : null;
  } catch {
    return null;
  }
}
