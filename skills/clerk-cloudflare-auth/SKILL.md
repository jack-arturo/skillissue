---
name: clerk-cloudflare-auth
description: Add Clerk authentication to Cloudflare Pages or Workers apps with protected APIs, session-aware UI, and optional application-side user mapping.
license: MIT
tags: [clerk, cloudflare, auth, pages, workers, vite, d1]
agents: [codex]
category: auth
metadata:
  version: "1.1.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Edit]
requires-secrets:
  - name: CLERK_SECRET_KEY
    description: Server-side Clerk credential, configured through the deployment platform.
    required: true
  - name: VITE_CLERK_PUBLISHABLE_KEY
    description: Browser-safe Clerk key supplied to the frontend build.
    required: true
resources:
  - path: story.md
    type: file
---

# Clerk + Cloudflare Auth

Use this skill when a Cloudflare Pages or Workers application needs Clerk login,
session-aware UI, protected API routes, account records, or billing-linked user
mapping. Clerk should own identity; the application should own its domain data
and any billing records.

## Secret boundary

Keep provider values in the platform's environment-variable or secret manager.
Do not commit them, paste them into chat, or invent a local credential-store
format. A typical deployment needs these names:

```text
CLERK_SECRET_KEY=<managed server secret>
VITE_CLERK_PUBLISHABLE_KEY=<managed build variable>
```

The publishable key is intended for the browser but should still be supplied by
the build environment. `CLERK_SECRET_KEY` belongs only in server-side runtime
configuration. For local development, use ignored environment files and do not
read or print their contents unless the user explicitly asks.

## Integration shape

1. Inspect the application: framework, Pages Functions or Workers entry point,
   existing session model, public/protected routes, and application records
   keyed to users or accounts.
2. Add Clerk's framework package in the client and Clerk's server package where
   the edge runtime verifies tokens. Follow current official Clerk and
   Cloudflare documentation for the package-specific initialization API.
3. Initialize the client from `VITE_CLERK_PUBLISHABLE_KEY`. Render a clear
   signed-out fallback if it is absent in a local build.
4. Verify the session token at every protected Pages Function or Worker route;
   never treat client-side visibility as authorization.
5. Map the verified Clerk user or organization ID to D1/application records
   only where the product needs internal data. Keep Stripe customer and
   subscription truth in the billing layer rather than duplicating it in
   identity claims.

## Frontend rules

- Prefer the framework's reactive Clerk APIs over polling global state.
- Request a fresh token immediately before authenticated API calls.
- Guard against a late anonymous response replacing a newer signed-in state.
- Configure Clerk appearance through its supported configuration object, not
  brittle global CSS overrides.
- Keep static marketing pages static; add identity only where it is needed.

## Edge authorization

At the server boundary, extract and verify the Clerk session token using the
official backend SDK. Return `401` for a missing/invalid session and `403` for
an authenticated user without the required application entitlement. Make route
policy explicit so public webhooks and health endpoints do not accidentally
inherit account-only checks.

## Verification

Before deployment, test:

- Signed-out visitors can reach public pages and cannot call protected APIs.
- A signed-in test user receives the expected account data.
- Expired or malformed tokens are rejected by the edge route.
- Local and preview builds receive the appropriate Clerk environment values.
- Any D1 user mapping is idempotent and uses the verified Clerk identifier.

Use [Cloudflare Commerce Deploy](../cloudflare-commerce-deploy/story.md) for
provider configuration and [Stripe Commerce Checkout](../stripe-commerce-checkout/story.md)
when authentication gates paid product access.
