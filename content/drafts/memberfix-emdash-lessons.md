---
title: Lessons from shipping MemberFix as full EmDash
status: draft
destination: skillissue essays / skill updates
date: 2026-07-20
---

# Lessons from MemberFix full-EmDash staging

Shipped `verygoodplugins/memberfix-site` as a **full** EmDash site (not hybrid) after skillissue’s hybrid blog.

## Hard rules that still bite

1. **Workers, not Pages** for EmDash/Astro Cloudflare.
2. **Seed shape is versioned** — EmDash 0.27 wants `url` (not `custom_url`), byline `id`+`displayName`, content `id`, post bylines `[{ byline }]`.
3. **System email branding only works in `email:deliver`**, not `beforeSend`.
4. **`cloudflare:workers` env** for API routes — `Astro.locals.runtime.env` is gone.
5. **Contact: D1 first**, Resend best-effort, EmMail `waitUntil` forward optional.
6. **Resend From must be a verified domain** — `memberfix@autojack.ai` is wrong if only `news.autojack.ai` / `skillissue.sh` are verified.
7. **Staging hostname:** `autoj.ai` may not exist on the CF account; use `autojack.ai` (here: `memberfix.autojack.ai`).
8. **Admin finish is passkey** without an email magic-link path unless Resend is live for auth.
9. **Collab:** message Vic as the agent, never as Jack; GitHub invite + issue #1 pattern works.

## Reuse stack

- SAO: resend-email plugin, contact-handler, emmail-forward, migrations  
- skillissue blog: figures plugin, seed builder, hybrid lessons  
- light-ac: EmMail ingest secret header  

## Agent strategy that paid off

| Task | Mode |
|---|---|
| Live site audit | Parallel explore/scrape |
| Email recipe | Read-only explore across SAO + light-ac |
| Scaffold + brand | Main implementer |
| Deploy + domain | Direct wrangler + CF API |
| Vic notify | GitHub issue as agent |

## Publish path

Fold into `cloudflare-emdash-cms-deploy` skill notes + optional skillissue essay after Jack review.
