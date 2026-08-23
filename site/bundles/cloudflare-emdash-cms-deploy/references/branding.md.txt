# Branding and white-labeling: emails, admin chrome, SEO

Read this when rebranding an EmDash install for a client — the admin panel,
system emails (invites/sign-in), and the public SEO surface use three
different knobs; do not conflate them.

## EmDash's own emails + site identity (invites, sign-in, verify)

EmDash sends its auth emails (admin invite, magic-link sign-in, email verification) through the **email pipeline** to whatever plugin registers the exclusive `email:deliver` hook (e.g. a Resend transport). Two things you'll want to brand:

**1. The name in them.** Subjects/bodies read `siteName = options['emdash:site_title'] || "EmDash"`, so a fresh install literally emails "You've been invited to EmDash". There's **no CLI/admin route** to change it post-setup (only the setup wizard writes it) → write D1 directly. **Option values are JSON-encoded**, so store a *quoted* string:

```bash
wrangler d1 execute <db> --remote --command \
 "INSERT INTO options (name,value) VALUES ('emdash:site_title','\"Your Site Name\"') \
  ON CONFLICT(name) DO UPDATE SET value = excluded.value;"
```

Reads are per-request, so it's **live immediately, no deploy**. Same option also drives the passkey `rpName` (display-only — safe to change). This is the one-knob fix; do it before fussing with templates.

**2. The look of them.** Rebrand in the **`email:deliver` transport handler**, *not* `email:beforeSend`. EmDash deliberately **bypasses** `email:beforeSend`/`email:afterSend` for `source === 'system'` (see `EmailPipeline.sendInner`: `isSystemEmail` short-circuits straight to the exclusive deliver hook). A `beforeSend` hook registers without error and simply **never fires for auth emails** — you'll watch the subject change but the HTML stay default-blue. In the deliver handler you get `{ message, source }`; when `source === 'system'`, swap `message.html` for your branded shell (extract the action URL from the original HTML, keep `to`/`subject`/`text`), and **pass through unchanged** when you can't safely rebrand so delivery never breaks. The branded HTML is a hand-rolled table+inline-style string (mirrors EmDash's own auth templates); React-Email lives in the contact path, owned by `cloudflare-lead-capture`.

## Admin chrome branding / white-labeling (the "still says EmDash" question)

**Admin white-labeling is first-class — but it's a build-time config block, NOT a D1 option.** This is the trap: grepping the `options` table / the `siteInfo` middleware (which only reads `emdash:site_title`/`_site_url`/`_locale`) makes it look unconfigurable. It isn't. The knob lives in `astro.config.mjs`:

```js
emdash({
  database: d1({ ... }),
  storage: r2({ ... }),
  admin: {
    logo: "/diocese-mark.svg",      // image path/URL → admin sidebar + login (replaces the EmDash lockup)
    siteName: "South & Ozarks",     // sidebar header + footer + browser tab
    favicon: "/favicon.svg",        // admin-panel favicon
  },
})
```

How it flows: the integration serializes `config.admin` (`astro/index.mjs`) → the manifest route `/_emdash/api/manifest` returns `locals.emdash.config.admin` → the admin SPA's `BrandLogo` renders `manifest.admin.logo` (and falls back to the hardcoded EmDash lockup only when `logo` is unset). All three fields optional; needs a **rebuild + deploy** (build-time, not runtime). `admin.logo` requires an actual image asset in `public/` — `siteName` alone won't remove the EmDash *logo*, only its text.

**Two separate identity surfaces — don't conflate:**
- `emdash({ admin: {...} })` → the **admin panel** (sidebar/login/favicon). Build-time.
- `emdash:site_title` D1 option (+ public site settings) → **emails, public-site SEO, passkey rpName**. Runtime, per-request. (See the email section above.)

Admin `logo` / `siteName` / `favicon` have shipped since **0.19.0**. Always resolve current line with `npm view emdash version` (do **not** assume a number in this skill is latest). Ignore npm `emdash@1.0.0` as current — older publish. Further login-page white-labeling beyond logo/name/favicon is still limited upstream.

**Lesson:** for admin branding, look at the `config.admin` → `/_emdash/api/manifest` → SPA path, not D1 options. Two passes wrongly concluded "no knob" by inspecting only the options/siteInfo path.

### Client demos: white-label Studio (scare the WordPress operator)

When the audience is a WP agency / membership operator (e.g. MemberFix / Vic), **do not ship default EmDash chrome**. Treat admin white-label as part of the product pitch:

1. **Product name, not CMS name** — `siteName: "<Client> Studio"` (sidebar, login title, browser tab). Avoid leaving "EmDash" visible in the shell.
2. **Dark-friendly logo assets** — WP header PNGs often wash out on the admin SPA. Ship dedicated SVG:
   - `public/admin-lockup.svg` — horizontal mark + wordmark (+ optional accent pill) for login/sidebar (`object-fit: contain`)
   - `public/admin-mark.svg` — square favicon
   Point `admin.logo` / `admin.favicon` at those paths.
3. **D1 title matches** — after setup, set `emdash:site_title` to the same Studio string (JSON-quoted) so invites/passkey RP name don't say "EmDash".
4. **System emails match** — rebrand in `email:deliver` with the Studio name (see above).
5. **Public footer badge** — quiet flex: `"<Client> Studio · no WordPress runtime"` beats `"Powered by EmDash"`.
6. **Seed `meta.name` / `settings.title`** — setup wizard "Template: …" line should already say Studio, not the generic CMS.

Reference implementation: `verygoodplugins/memberfix-site` (`docs/admin-branding.md`, `public/admin-lockup.svg`). Rebuild+deploy after `admin.*` changes; D1 title is live without redeploy.

What you *cannot* theme yet (as of 0.29): admin CSS tokens / full login page layout beyond logo+name+favicon. Do the rest on the public site + email shell.

### Studio verify checklist (do not claim branded admin until all green)

```bash
# Assets must be 200 on the *public* host (admin SPA loads them as absolute paths)
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" https://<site>/admin-lockup.svg
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" https://<site>/admin-mark.svg
# Manifest is auth-gated (401 without session) — still check assets; then open login in a browser
# D1 site title (emails / passkey RP name)
wrangler d1 execute <db> --remote --command \
  "SELECT value FROM options WHERE name='emdash:site_title';"
# expect: "\"<Client> Studio\""
```

If the login shows **text-only** siteName with no lockup image: (1) asset 404, (2) deploy predates `public/` SVGs, or (3) `admin.logo` path wrong. Fix assets + redeploy — D1 title alone never puts a logo on the login screen.

### Public SEO stack (pair with Studio)

Port SAO: `src/lib/seo.ts` (`SITE_NAME` public brand, **not** Studio) + `src/components/SeoHead.astro` + Layout `slot="head"` + `public/og-default.svg`. Wire `getSeoMeta` + featured_image → `og:image`. Public name ≠ admin Studio name.

## Verifying email branding

```bash
# EmDash auth-email branding: send a real invite to a +tag you control, then read it back from the provider.
curl -sS -X POST "https://<site>.<zone>/_emdash/api/auth/invite" \
  -H "Authorization: Bearer $EMDASH_TOKEN" -H "content-type: application/json" \
  -d '{"email":"you+invite-test@gmail.com"}'                          # 200 {"data":{"success":true,...}}
resend emails list -q | ...                                          # subject shows your site_title, HTML carries your brand
```
