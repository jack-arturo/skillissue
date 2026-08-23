---
name: clerk-cloudflare-auth
visibility: public
provenance: house
featured: false
title: "Clerk + Cloudflare Auth"
summary: >-
  A public integration guide for adding Clerk identity to Cloudflare Pages or Workers without leaking deployment credentials.
category: auth
tags: [clerk, cloudflare, auth]
related: [cloudflare-commerce-deploy, stripe-commerce-checkout]
first_used: 2026-08
---

## Why

Identity code gets tangled quickly when frontend state, edge verification, and billing records each invent their own user model.

## How

Keep Clerk responsible for identity, verify sessions at the edge, and keep provider values in environment variables managed outside the repository.

## Related

Use [Cloudflare Commerce Deploy](../cloudflare-commerce-deploy/story.md) for deployment wiring and [Stripe Commerce Checkout](../stripe-commerce-checkout/story.md) for billing.
