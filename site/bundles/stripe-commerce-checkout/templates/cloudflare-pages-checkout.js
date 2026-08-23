const STRIPE_API_VERSION = '2026-02-25.clover';
const STRIPE_CHECKOUT_URL = 'https://api.stripe.com/v1/checkout/sessions';

const DEFAULT_BRANDING = {
  backgroundColor: '#fff8f4', borderStyle: 'rounded', buttonColor: '#f2592a',
  displayName: 'Commerce', fontFamily: 'inter', iconUrl: '', logoUrl: '',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

function getBaseUrl(request, env) {
  const url = new URL(request.url);
  return env.BASE_URL || `${url.protocol}//${url.host}`;
}

function getBranding(env) {
  return {
    backgroundColor: env.CHECKOUT_BACKGROUND_COLOR || DEFAULT_BRANDING.backgroundColor,
    borderStyle: env.CHECKOUT_BORDER_STYLE || DEFAULT_BRANDING.borderStyle,
    buttonColor: env.CHECKOUT_BUTTON_COLOR || DEFAULT_BRANDING.buttonColor,
    displayName: env.CHECKOUT_DISPLAY_NAME || DEFAULT_BRANDING.displayName,
    fontFamily: env.CHECKOUT_FONT_FAMILY || DEFAULT_BRANDING.fontFamily,
    iconUrl: env.CHECKOUT_ICON_URL || DEFAULT_BRANDING.iconUrl,
    logoUrl: env.CHECKOUT_LOGO_URL || DEFAULT_BRANDING.logoUrl,
  };
}

function appendBrandingSettings(params, branding) {
  params.set('branding_settings[background_color]', branding.backgroundColor);
  params.set('branding_settings[border_style]', branding.borderStyle);
  params.set('branding_settings[button_color]', branding.buttonColor);
  params.set('branding_settings[display_name]', branding.displayName);
  params.set('branding_settings[font_family]', branding.fontFamily);
  if (branding.iconUrl) {
    params.set('branding_settings[icon][type]', 'url');
    params.set('branding_settings[icon][url]', branding.iconUrl);
  }
  if (branding.logoUrl) {
    params.set('branding_settings[logo][type]', 'url');
    params.set('branding_settings[logo][url]', branding.logoUrl);
  }
}

// Replace this adapter with the application's verified session lookup. It must
// derive identity from a signed server-side session/cookie, never request JSON.
async function getAuthenticatedUserId(_request, _env) {
  return null;
}

function resolveOffer(offerId, env) {
  const offers = {
    starter: { priceId: env.STRIPE_PRICE_STARTER, metadata: { offer: 'starter' } },
    professional: { priceId: env.STRIPE_PRICE_PROFESSIONAL, metadata: { offer: 'professional' } },
  };
  const offer = offers[offerId];
  return offer?.priceId ? offer : null;
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) return jsonResponse({ success: false, error: 'Stripe checkout is not configured.' }, 503);

  let body;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Invalid request.' }, 400); }
  if (!body || typeof body.offerId !== 'string' || Object.keys(body).some((key) => key !== 'offerId')) {
    return jsonResponse({ success: false, error: 'Submit one supported offer identifier.' }, 400);
  }

  const offer = resolveOffer(body.offerId, env);
  if (!offer) return jsonResponse({ success: false, error: 'Choose a supported offer.' }, 400);

  const userId = await getAuthenticatedUserId(request, env);
  if (!userId || typeof userId !== 'string') return jsonResponse({ success: false, error: 'Authentication is required.' }, 401);

  const baseUrl = getBaseUrl(request, env);
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('submit_type', 'pay');
  params.set('success_url', `${baseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${baseUrl}/?checkout=cancelled`);
  params.set('client_reference_id', userId);
  params.set('line_items[0][price]', offer.priceId);
  params.set('line_items[0][quantity]', '1');
  for (const [key, value] of Object.entries(offer.metadata)) params.set(`metadata[${key}]`, value);
  appendBrandingSettings(params, getBranding(env));

  const response = await fetch(STRIPE_CHECKOUT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': STRIPE_API_VERSION },
    body: params,
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    return jsonResponse({ success: false, error: 'Stripe checkout is unavailable.', error_code: errorBody?.error?.code || errorBody?.error?.type || 'stripe_error' }, 502);
  }
  const session = await response.json();
  if (!session.url) return jsonResponse({ success: false, error: 'Stripe checkout did not return a URL.' }, 502);
  return jsonResponse({ success: true, id: session.id, url: session.url });
}
