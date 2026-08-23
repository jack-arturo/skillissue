---
name: stripe-commerce-checkout
description: Build a Stripe Checkout endpoint with restricted keys, branded sessions, webhooks, and a test-first operating model.
license: MIT
tags: [stripe, commerce, checkout, payments, branding, webhooks]
agents: [claude-code, codex, cursor]
category: payments
metadata:
  version: "1.1.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Edit]
requires-secrets:
  - name: STRIPE_SECRET_KEY
    description: Server-side Stripe restricted or secret key, supplied through the deployment environment.
    required: true
  - name: STRIPE_WEBHOOK_SECRET
    description: Webhook signing secret, supplied through the deployment environment when webhooks are enabled.
    required: false
resources:
  - path: story.md
    type: file
  - path: templates/cloudflare-pages-checkout.js
    type: file
  - path: templates/stripe-app.json
    type: file
---

# Stripe Commerce Checkout

Use this skill for a server endpoint that creates Stripe-hosted Checkout Sessions. Start in **test mode**. Live products, prices, webhooks, and sessions require an explicit current-conversation instruction authorizing the specific live mutation.

## Secrets and scope

Supply `STRIPE_SECRET_KEY` and, where applicable, `STRIPE_WEBHOOK_SECRET` through the host's secret manager or local environment. Never request them in chat, put them in a repository, pass them on a command line, or print them. Prefer a project-scoped restricted key over an account-wide key.

The Stripe CLI is useful for test-mode provisioning. Keep its credentials separate from application configuration; a CLI login key is not an application secret. Set environment variables in the deployment platform and use `.dev.vars` or an equivalent ignored local file for local work.

## Build the endpoint

1. Decide whether the offer is one-time, subscription, donation, or deposit.
2. Accept only a documented `offerId` from the browser. Resolve its Stripe Price ID, product display data, quantity, and metadata from a server-side allowlist; never accept amounts, price IDs, product names, quantities, client reference IDs, or arbitrary metadata from the browser.
3. Start from `templates/cloudflare-pages-checkout.js`; wire its fail-closed authenticated-user adapter to the application's server-side session, then configure its server-side offer map. It creates a Checkout Session using `STRIPE_SECRET_KEY` and returns `{ id, url }` for the newly created session.
4. Apply non-secret branding through `branding_settings`. Session branding does not replace account-level legal, receipt, Link, or portal branding; verify those in the Stripe Dashboard.
5. For subscriptions, add a verified webhook and a user-return reconciliation path. The webhook remains the source of truth; reconciliation is only a fast path after a user returns from Checkout.
6. Verify a new test-mode session after every endpoint or branding change. Existing session URLs are not a reliable test of a new deployment.

## Webhooks and portal

Verify the Stripe signature using `STRIPE_WEBHOOK_SECRET` before changing entitlement or subscription state. Make handlers idempotent. On a Checkout return, retrieve the session server-side and verify that its client reference or metadata belongs to the authenticated user; never trust a browser-submitted customer or subscription ID.

Billing Portal branding is account-level, unlike Checkout Session branding. A distinct product may need a distinct Stripe account if the portal must have separate global branding.

## Stripe App route

Stripe does not offer an API that mints new API keys. If installed accounts need a project-scoped key, use a reviewed Stripe App configuration such as `templates/stripe-app.json`, request the narrowest permissions possible, and let the account owner approve the install. Do not automate credential creation outside Stripe's supported flow.

## Safety rules

- Default all mutations to test mode.
- Treat a configured live key as configuration, not authorization.
- Never expose a secret key or webhook secret in client code, logs, commits, or reports.
- Validate server-side ownership before granting access after Checkout.
- Report secret names and test evidence, never secret values.
