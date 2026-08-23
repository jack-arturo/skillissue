---
name: clerk-cloudflare-commerce-bootstrap
description: Plan and implement a test-first Cloudflare commerce application with Clerk identity, Stripe Checkout, and explicit live-billing approval.
license: MIT
tags: [orchestrator, clerk, cloudflare, stripe, commerce, bootstrap]
agents: [codex]
category: commerce
metadata:
  version: "1.0.2"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Edit]
requires-secrets:
  - name: CLOUDFLARE_API_TOKEN
    description: Deployment token supplied by the operator's Cloudflare configuration.
    required: true
  - name: CLERK_SECRET_KEY
    description: Server-side Clerk credential managed outside the repository.
    required: true
  - name: STRIPE_SECRET_KEY
    description: Stripe credential managed outside the repository; test mode is the default.
    required: true
resources:
  - path: story.md
    type: file
---

# Clerk + Cloudflare + Stripe Commerce Bootstrap

This is an orchestration path for a Cloudflare commerce app with Clerk identity,
Stripe Checkout, webhooks, and preview isolation. It does not replace the
underlying deployment, identity, or billing skills; it sequences their shared
decisions.

## Start with a fit check

Before mutating anything, inspect the repository and classify it:

- `full-commerce`: needs identity, protected product access, Checkout, webhooks,
  persistent application state, and preview isolation.
- `auth-only`: needs sign-in or protected APIs but no paid flow.
- `lead-capture`: needs forms or admin notification, not account billing.
- `deploy-only`: needs hosting, bindings, or deployment hygiene.

Route non-commerce projects to the narrower skill and stop. Do not add Clerk
or Stripe merely because this skill was invoked.

## Test-first default

Use Stripe test mode for every initial end-to-end path. Production billing
mutations require explicit current-conversation approval that says `live` and
names the intended action. Existing production credentials do not grant that
approval.

Keep every provider value outside version control. Typical variable names are:

```text
CLERK_SECRET_KEY=<managed secret>
VITE_CLERK_PUBLISHABLE_KEY=<managed build variable>
STRIPE_SECRET_KEY=<managed secret>
STRIPE_WEBHOOK_SECRET=<managed secret>
STRIPE_PRICE_ID=<managed configuration value>
```

Use separate preview and production variable sets. Do not print values in logs,
reports, commit messages, or pull requests.

## Sequence

1. Inspect deployment model, existing Cloudflare resources, application data,
   auth surface, billing surface, and CI. Reuse matching resources rather than
   creating lookalikes.
2. Establish production and preview resource boundaries: Pages/Workers
   deployment, D1/KV bindings where needed, and migrations. Preserve one
   canonical deployment path.
3. Add Clerk using `clerk-cloudflare-auth`: client UI, edge verification, and
   an explicit mapping from verified identity to application data.
4. Add Stripe Checkout using `stripe-commerce-checkout` in test mode. Verify
   signed webhook handling, idempotency, and recovery from delayed delivery.
5. Supply preview and production environment variables through the provider
   configuration. Frontend build variables and runtime secrets can have
   different loading paths; validate both.
6. Test locally and in a preview deployment. Verify signed-out public pages,
   signed-in routes, Checkout creation, webhook state updates, and the return
   path before considering production.

## Live billing gate

After a user explicitly authorizes a scoped `live` action, confirm product,
price, currency, and webhook endpoint before creating or modifying live Stripe
objects. Apply only the approved provider configuration, verify the live
webhook signature, then report names and statuses—not secret values.

## Output contract

Report the selected fit, resources reused or created, environment-variable
names by preview/production scope, test results, skipped live work, and any
manual access step. A partial run still needs this report; silent stops are not
useful.

## Guardrails

- Never infer live-billing approval.
- Never register a domain or spend money without the required user approval.
- Never expose API tokens, signing secrets, or credential-store details.
- Keep identity, deployment, and billing concerns in their respective skills.
