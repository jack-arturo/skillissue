export async function validateTurnstile({ request, env, token }) {
  if (!env.TURNSTILE_SECRET_KEY) {
    return { configured: false, success: true };
  }

  if (!token) {
    return { configured: true, success: false, error: 'Missing verification token.' };
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: request.headers.get('CF-Connecting-IP') || undefined,
        idempotency_key: crypto.randomUUID(),
      }),
    });
    const result = await response.json();
    return {
      configured: true,
      success: Boolean(result.success),
      error: Array.isArray(result['error-codes']) ? result['error-codes'].join(', ') : null,
    };
  } catch {
    return { configured: true, success: false, error: 'Verification failed.' };
  }
}
