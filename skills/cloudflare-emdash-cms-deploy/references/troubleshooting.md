# Troubleshooting

## Symptom → diagnosis

- Root URL prompts to **download a text file** / `/wrangler.jsonc` returns `application/octet-stream` → the Pages project has **no build step** and is serving raw source. It needs a Worker, not Pages.
- `/` 404s on a fresh deploy but worked before → a static→Astro migration with stale Pages build config (`build_command: ''`, output dir = repo root).
- **Every page redirects to `/_emdash/admin/setup` even after setup is complete** (D1 `options` shows `emdash:setup_complete = true`, `users` > 0) → prerendered pages were built before setup and froze a redirect (see Common mistakes: prerender-before-setup).
- **CMS posts render with an empty title/body (only the slug/URL works)** → `getEmDashCollection`/`getEmDashEntry` return an **entry envelope** `{ id, slug, status, data, … }`; the fields live under `.data`. Read `entry.data.title`, not `entry.title` (see `references/cms-configuration.md` → Rendering CMS content).
- **An admin "preview"/"view on site" link 404s** → the collection's `url_pattern` is null, so EmDash defaults to `/<collection>/{slug}` (e.g. `/posts/...`). Set `url_pattern` to your real route, e.g. `/blog/{slug}`.
- **A custom API route returns an empty HTTP 500** → `Astro.locals.runtime.env has been removed in Astro v6`; use `import { env } from "cloudflare:workers"` (see `references/cms-configuration.md` → Adding custom endpoints).
- Deploy fails `code 10042 Please enable R2` → R2 not enabled on the account (see `references/project-setup.md` → Preflight).
- Agent blocks mid-build "which D1 can I delete?" → account is at the 10-database D1 free-tier cap.
- **A GitHub `pages build and deployment` check fails on every push** (Jekyll errors: `Invalid YAML front matter in .../about.astro`, `YAML Exception reading .../*.astro`) → **vestigial GitHub Pages**, not Cloudflare. GitHub Pages was left enabled (legacy/Jekyll mode) and Jekyll-builds the `.astro` source on each push, choking on the `---` frontmatter fences. It is unrelated to the live Worker. Confirm with `gh api repos/<owner>/<repo>/pages` (`status: errored`, `build_type: legacy`); fix by disabling it — `gh api -X DELETE repos/<owner>/<repo>/pages` (see `references/deploy.md` → Auto-deploy on merge).

## Verify

```bash
curl -sI "https://<site>.<zone>/"                                   # 200; redirects to /_emdash/admin/setup pre-setup
curl -so /dev/null -w '%{http_code}\n' "https://<site>.<zone>/_emdash/admin/setup"   # 200 = wizard live
# AFTER setup: a content page must render its real title, not a 335-byte setup redirect:
curl -sL "https://<site>.<zone>/about?cb=$RANDOM" | grep -i '<title>'
# A CMS post must render its real title (proves entry.data is read correctly):
curl -sL "https://<site>.<zone>/blog/<post-slug>?cb=$RANDOM" | grep -i '<title>'
```

For verifying rebranded system emails (invite/sign-in), see `references/branding.md` → Verifying email branding.

## Common mistakes

| Mistake | Reality |
|---|---|
| Deploying EmDash/Astro to Cloudflare **Pages** | `@astrojs/cloudflare` v13 is Workers-only; Pages serves raw source. Use `wrangler deploy`. |
| Declaring `assets`/`SESSION`/`IMAGES` in wrangler.jsonc | The adapter injects them at build; declaring by hand can conflict. Keep wrangler.jsonc minimal. |
| `prerender = true` on CMS content pages | Built before setup, EmDash bakes a `/_emdash/admin/setup` redirect into each static page; on Workers the static asset shadows the live worker, so pages keep redirecting post-setup. Make them SSR (omit prerender). |
| Reading `post.title` from getEmDashCollection/getEmDashEntry | Those return `{ id, slug, status, data, … }`; fields are under `.data`. Use `entry.data.title`/`entry.data.content`. Only `slug` is on the envelope, so the post renders empty while the link still works. |
| Leaving a collection's `url_pattern` null | Admin preview/permalink defaults to `/<collection>/{slug}`, which 404s when your route differs (e.g. `/blog/{slug}`). Set it in the seed + `_emdash_collections`. |
| `Astro.locals.runtime.env` in an endpoint | Removed in Astro 6 — throws an empty 500. Use `import { env } from "cloudflare:workers"`. |
| Skipping the R2/D1 preflight | Deploy dies on `10042` (R2 not enabled) or stalls at the 10-DB cap mid-run. Check enablement first. |
| Using wrangler's stored OAuth token | Often lacks R2 scope (`Authentication error 10000`). Export a scoped `CLOUDFLARE_API_TOKEN`. |
| Trying to script the admin setup | First admin is a browser wizard + a credential the owner must hold. Hand it off. |
| `wrangler pages deploy` on a git-connected Pages project | Split-brain deploys. For EmDash the answer is a Worker, not Pages at all. |
| Branding EmDash's system emails via `email:beforeSend` | `source==='system'` emails bypass beforeSend/afterSend entirely (`EmailPipeline.sendInner`) — the hook registers but never fires for invites. Rebrand in the exclusive `email:deliver` transport handler instead. |
| Writing `emdash:site_title` (or any option) as a raw string in D1 | Option values are JSON-encoded — store `'"Name"'` (quoted). A bare string makes `OptionsRepository.get` throw on `JSON.parse`. |
| Adding a 2nd collection by only editing `seed/seed.json` on a live site | The seed applies on first boot only. Provision the live DB with `emdash schema create` + `add-field`, then deploy the templates (and mirror into the seed for fresh installs). |
| Deploying `getEmDashCollection('<new>')` templates before the collection exists in the live DB | The build passes (SSR pages aren't executed at build) but the route 500s at runtime. Create the schema first, then `wrangler deploy`. |
| `orderBy` on a custom field in `getEmDashCollection` | Reliable only for system columns (`published_at`). Fetch with a `limit` and sort in JS for custom fields like `event_date`. |
| A `datetime` field value with a `±HH:MM` offset | The validator is `z.string().datetime().or(z.string().date())` — accepts `...Z` or bare `YYYY-MM-DD`, rejects offsets (`Invalid input`). Store UTC `Z`. |
| `:global(...)` in a plain linked `public/*.css` | Scoped-`<style>`-only syntax; browsers drop the rule. Use a normal selector in route stylesheets. |
| `getEmDashEntry` / `getEmDashCollection` return shape | Returns `{ entry, cacheHint }` (or array of envelopes); fields under `.data`, click-to-edit under `.edit`. (Not the envelope directly at root.) |
| `ec menu` create | No `ec menu create`; provision via `wrangler d1 execute --remote` INSERTs into `_emdash_menus` + `_emdash_menu_items` (id/parent_id/sort_order for nesting) or the admin UI. Mirror children in seed if supported. |
| Scheduled publishing | Worker re-exports `scheduled()` but it is never invoked unless `wrangler.jsonc` has `"triggers": { "crons": ["*/15 * * * *"] }`. Schedule posts with `ec content schedule ... --at <UTC-Z>`. |
| Schema field types via CLI | `schema add-field --type` supports only: string/text/number/integer/boolean/datetime/image/reference/portableText/json. No repeater/select/url/slug — use flat fields or finish modeling in admin UI. |
| Shared style.css + page-specific rules | Appending homepage styles can clobber global `.btn` etc. Scope page-specific buttons (`.fp-btn*`, `.hero .btn`). |
| EmDash plugins + direct D1 | Sandboxed plugins only see `ctx.content` + scoped storage. Direct D1 (e.g. contact_messages table) requires a **native** plugin (listed in project `plugins/`, full host context with DB binding). |

## Real-world impact

`southandozarks.org` diocese site: a static→Astro+EmDash migration left it on a Pages project serving raw source (root URL downloaded `wrangler.jsonc`). Re-deployed as a Worker at `southandozarks.autojack.ai` once R2 was enabled — all five bindings resolved on the first `wrangler deploy`. Post-setup, pages redirected to setup because they were prerendered before setup (fixed by dropping `prerender`). A contact form was added as `src/pages/api/contact.ts` (D1 + Resend) — the first cut 500'd on `locals.runtime.env` until switched to `import { env } from "cloudflare:workers"`. The seeded blog post rendered blank because the templates read `post.title` instead of `post.data.title`, and the admin preview 404'd because the collection `url_pattern` was null — both fixed. Later, branding the diocese's own admin invites needed two moves: set `emdash:site_title` in D1 (invites had said "You've been invited to EmDash") and rebrand the body in the `email:deliver` transport — a first cut put the rebrand in `email:beforeSend`, which silently no-op'd because system emails bypass that pipeline. Verified by sending a real invite and reading the delivered HTML back from Resend. Later still, a second content type — an `events` collection (Diocesan Calendar) — was added to the **already-live** site with `emdash schema create events` + seven `add-field` calls against the live URL, then `/events` + `/events/[slug]` SSR routes and a homepage "Upcoming" block were deployed; the collection had to be provisioned *before* deploy (the build passes without it, but the SSR route 500s at runtime), `event_date` had to be stored as UTC `Z` (a `-05:00` offset threw `Invalid input`), and the date list was sorted/split in JS because `orderBy` isn't dependable on a custom field. A follow-up pass added a third collection (`churches`, the same recipe — provisioned live, seeded, `/churches` + `/churches/[slug]` + the homepage preview wired to it as the single source of truth), wired the homepage's hardcoded news to the live `posts`, and hardened the calendar: a per-record IANA `timezone` field so events display in their own zone with the abbreviation shown (`11:00 AM MST` for a Tucson ordination vs `9:00 AM CDT` for a Branson synod), plus `.ics` download and RSS endpoints via Astro extension routing (`[slug].ics.ts`, `rss.xml.ts`).
