const STRIPE_API_VERSION = '2026-02-25.clover';
const STRIPE_CHECKOUT_URL = 'https://api.stripe.com/v1/checkout/sessions';

const DEFAULT_BRANDING = {
  backgroundColor: '#fff8f4',
  borderStyle: 'rounded',
  buttonColor: '#f2592a',
  displayName: 'Commerce',
  fontFamily: 'inter',
  iconUrl: '',
  logoUrl: '',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function getBaseUrl(request, env) {
  const url = new URL(request.url);
  return env.BASE_URL || `${url.protocol}//${url.host}`;
}

function getBranding(env) {
  return {
    backgroundColor:
      env.CHECKOUT_BACKGROUND_COLOR || DEFAULT_BRANDING.backgroundColor,
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

function normalizeAmount(value) {
  const amount = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(amount) || amount < 100) return null;
  return amount;
}

function isAllowedAmount(amount) {
  const allowed = new Set([500, 1000, 2500, 5000, 10000]);
  return allowed.has(amount);
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse(
      { success: false, error: 'Stripe checkout is not configured.' },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid request.' }, 400);
  }

  const amount = normalizeAmount(body.amount);
  if (!amount || !isAllowedAmount(amount)) {
    return jsonResponse(
      { success: false, error: 'Choose a supported amount.' },
      400
    );
  }

  const baseUrl = getBaseUrl(request, env);
  const currency = String(env.STRIPE_CURRENCY || 'usd').toLowerCase();
  const params = new URLSearchParams();

  params.set('mode', 'payment');
  params.set('submit_type', 'pay');
  params.set('success_url', `${baseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${baseUrl}/?checkout=cancelled`);
  params.set('client_reference_id', String(body.reference || 'commerce-checkout').slice(0, 200));
  params.set('metadata[source]', String(body.source || 'site').slice(0, 80));
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', currency);
  params.set('line_items[0][price_data][unit_amount]', String(amount));
  params.set('line_items[0][price_data][product_data][name]', String(body.name || 'Checkout').slice(0, 120));

  appendBrandingSettings(params, getBranding(env));

  const response = await fetch(STRIPE_CHECKOUT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
    },
    body: params,
  });

  if (!response.ok) {
    const requestId = response.headers.get('request-id');
    const errorBody = await response.json().catch(() => null);
    return jsonResponse(
      {
        success: false,
        error: 'Stripe checkout is unavailable.',
        error_code: errorBody?.error?.code || errorBody?.error?.type || 'stripe_error',
        stripe_request_id: requestId || null,
      },
      502
    );
  }

  const session = await response.json();
  if (!session.url) {
    return jsonResponse(
      { success: false, error: 'Stripe checkout did not return a URL.' },
      502
    );
  }

  return jsonResponse({
    success: true,
    id: session.id,
    url: session.url,
  });
}
