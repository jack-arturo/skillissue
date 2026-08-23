# CMS configuration: content, collections, menus, endpoints

Read this when working with EmDash content after the site is deployed and set
up: rendering the data model correctly, adding a new collection to an
already-live site, wiring menus/widgets/scheduled publishing, adding custom
API routes, or reading a plugin's own D1 table.

## Rendering CMS content (deploy-time symptoms)

Two rendering bugs commonly surface right after a deploy — they live here because that's *when* you hit them, but the full rendering model (entry envelopes, `<Image>` with no `.src`, `Astro.cache`/`cacheHint`) is owned by the **`building-emdash-site`** skill. Read that for the model; use the two symptom rows below to unblock a deploy.

- **Blank post (title/body empty but the slug/URL works):** `getEmDashCollection`/`getEmDashEntry` (from `emdash`) return an **entry envelope** `{ id, slug, status, data, cacheHint, edit }` — the field values are under **`.data`**. Read `entry.data.title`, not `entry.title` (unwrap once with `const posts = entries.map(e => e.data ?? e)`). Reading the envelope directly renders empty while the link still works, which masquerades as a CMS/data bug but is a template bug.
- **Admin "preview" / permalink 404s:** the collection's **`url_pattern`** is null, so EmDash defaults to `/<collection>/{slug}` (e.g. `/posts/...`). Set it to your real route (e.g. `/blog/{slug}`, placeholders `{slug}`/`{id}`) in `seed/seed.json` *and* the live `_emdash_collections` row.

## Adding a new collection to a live site (a 2nd content type)

`seed/seed.json` applies on **first boot only** (or an explicit `emdash seed`) — it will **not** retro-add a collection to an already-seeded live DB. To add a second content type (e.g. `events` alongside `posts`) to a running site, provision it on the live DB with the **EmDash CLI**, then ship the templates:

```bash
export EMDASH_TOKEN=$(grep '^EMDASH_TOKEN=' .env | cut -d= -f2-)
ec() { node node_modules/emdash/dist/cli/index.mjs "$@"; }   # or: npx emdash
URL=https://<site>.<zone>

ec schema create events --label "Events" --label-singular "Event" --url "$URL"
ec schema add-field events title      --type string       --label "Title" --required --url "$URL"
ec schema add-field events event_date --type datetime     --label "Start" --required --url "$URL"
ec schema add-field events location   --type string       --label "Location"          --url "$URL"
ec schema add-field events description --type portableText --label "Description"        --url "$URL"
#   field types: string text number integer boolean datetime image reference portableText json
ec content create events --file ev.json --slug <slug> --url "$URL"   # auto-publishes
```

Gotchas, in the order they bite:

- **`schema create` makes an EMPTY collection** — no implicit `title`. Add every field (including `title`) via `add-field`.
- **`url_pattern` defaults to `/<collection>/{slug}`.** A collection named `events` with routes at `src/pages/events/[slug].astro` needs **no** override — admin preview/permalinks resolve out of the box. (Contrast `posts` → `/blog/{slug}`, which *does* need the override; see Rendering CMS content above.)
- **Provision the collection in the live DB BEFORE deploying templates that call `getEmDashCollection('<slug>')`.** `astro build` does **not** execute SSR pages, so the build passes even when the collection doesn't exist yet — the failure surfaces only at runtime as a 500. Create the schema first, then `wrangler deploy`.
- **`datetime` field validator is `z.string().datetime().or(z.string().date())`** — accepts ISO-with-`Z` (`2026-08-09T15:30:00.000Z`) **or** a bare `YYYY-MM-DD`, and **rejects `±HH:MM` offsets** (`...-05:00` → `event_date: Invalid input`). Store UTC `Z`; format for display in the page (`toLocaleString('en-US', { timeZone: 'America/Chicago' })`), and render bare all-day dates with `timeZone: 'UTC'` so the day doesn't slip backward when the worker runs in UTC. **For content spanning timezones, don't hardcode one display zone** — add a per-record IANA `timezone` string field (e.g. `America/Phoenix`), format with `timeZone: data.timezone || '<default>'`, and pass `timeZoneName: 'short'` so the abbreviation shows (`11:00 AM MST` vs `9:00 AM CDT`) and removes the ambiguity.
- **Don't `orderBy` a custom field.** `getEmDashCollection`'s `orderBy` is reliable for system columns (`published_at`); a custom field like `event_date` isn't guaranteed orderable. Fetch with a generous `limit` and sort/split in JS.
- **portableText fields auto-convert markdown.** Pass `description` to `content create` as a markdown **string** → EmDash stores PT; the render path (and `content get --raw`) returns the **PT array** for `<PortableText value={data.description}>`, while a plain `content get` shows the round-trip markdown source (looks like "it didn't convert" — it did). Pass an **array** to send raw PT (custom blocks).
- **Mirror the collection into `seed/seed.json`** (collection def + a sample item) for fresh-install parity, even though it won't auto-apply to the live DB.
- **Route-scoped CSS:** copy the `blog.css` + `BlogHead.astro` pattern — a `public/<name>.css` injected via the Layout `head` slot on those routes only. A plain linked stylesheet **cannot** use Astro `:global(...)`; that's scoped-`<style>`-only syntax and browsers silently drop the rule.

## Menus, widgets & scheduled publishing (live-provision, like collections)

Like a 2nd collection: provision the **live** D1/config first, deploy the template that reads it, then mirror into `seed/seed.json` (seed only seeds *fresh* installs — it never touches the existing live DB).

- **Live menu — `ec menu` has only `list`/`get`, NO `create`.** Insert directly (or use the admin UI). `getMenu('primary')` returns `Menu { items: MenuItem[] }` with nested **`children: MenuItem[]`**; `MenuItem.url` comes from `custom_url` for `type='custom'`. Tables: `_emdash_menus(id TEXT pk, name, label, locale='en', …)`, `_emdash_menu_items(id TEXT pk, menu_id, parent_id, sort_order, type, custom_url, label, css_classes, target, …)` — a non-null `parent_id` makes a dropdown child.
  ```bash
  npx wrangler d1 execute <db> --remote --command "
   INSERT INTO _emdash_menus (id,name,label,locale) VALUES ('menu-primary','primary','Primary Navigation','en');
   INSERT INTO _emdash_menu_items (id,menu_id,parent_id,sort_order,type,custom_url,label,css_classes) VALUES
    ('mi-home','menu-primary',NULL,0,'custom','/','Home',NULL),
    ('mi-ch','menu-primary',NULL,2,'custom','/churches','Churches',NULL),
    ('mi-ch-al','menu-primary','mi-ch',0,'custom','/churches#alabama','Alabama',NULL);"
  ```
  `SeedMenuItem` supports `children?: SeedMenuItem[]` — nest dropdowns in the seed too, or seed/live drift (count `items` recursively, not just top-level).
- **Footer widget area:** `getWidgetArea('footer')` → `{ widgets: Widget[] }` (`type` ∈ content|menu|component). Live tables `_emdash_widget_areas` / `_emdash_widgets`; seed shape `widgetAreas:[{name,label,widgets:[…]}]`. Guard null in the template (`area?.widgets ?? []`).
- **Scheduled publishing needs `triggers.crons`.** `@emdash-cms/cloudflare/worker` ships a `scheduled()` handler, but nothing runs it without `"triggers": { "crons": ["*/15 * * * *"] }` in `wrangler.jsonc`. `ec content schedule <coll> <id> --at <ISO-Z>` → status `scheduled`; the sweep publishes on the next cron tick past that time (UTC `Z` only).

## Rendering & CSS-scoping gotchas (homepage / structured pages → CMS)

- **`getEmDashEntry(type,id)` returns `{ entry, cacheHint }`** — fields under `entry.data`, click-to-edit spreads under `entry.edit` (NOT the bare envelope). Destructure: `const { entry, cacheHint } = await getEmDashEntry('homepage','home')`. For a singleton-style page, model it as a one-entry collection queried by a fixed slug (`'home'`); there is no native singleton.
- **Page CSS appended to a shared `style.css` can redefine global element-classes** (e.g. `.btn`, `.btn-ghost`) and silently restyle every other page. Scope page-specific rules to a wrapper/prefix (`.fp-btn*`, `.frontispiece .x`). A single-page screenshot won't catch the cross-page regression — verify the other pages too.
- **A plugin needs the *native* format for direct D1 access.** A standard/sandboxed plugin's `ctx` exposes only `ctx.content` (EmDash collections) + scoped `ctx.storage`/`ctx.kv` — it can't read a raw custom D1 table (e.g. `contact_messages`).

## Adding custom endpoints (forms, APIs)

To add a server route (contact form, webhook, JSON API) to an EmDash/Astro worker:

- Create `src/pages/api/<name>.ts` exporting `GET`/`POST`, with `export const prerender = false`.
- Access bindings via `import { env } from "cloudflare:workers"`. **Astro 6 removed `Astro.locals.runtime.env`** — using it throws `...has been removed in Astro v6`, which surfaces as an **empty HTTP 500** (not your JSON error path). `env.DB` (D1), `env.<SECRET>` (Worker secrets via `wrangler secret put`), `env.<VAR>` (non-secret `vars` in wrangler.jsonc).
- For a contact form / lead capture (D1 + Resend), the full pattern is owned by **`cloudflare-lead-capture`** (its Astro SSR / Workers variant: D1-first, honeypot, send-only Resend key, `<ContactForm>`). This skill owns only the binding/runtime mechanics above (`cloudflare:workers` import, `prerender = false`) — don't re-derive the lead flow here.
- **Typed feeds/downloads from a collection** (`.ics`, RSS/XML, JSON) use Astro's **extension routing**: the filename's pre-`.ts` suffix becomes a literal path segment. `src/pages/events/[slug].ics.ts` serves `/events/<slug>.ics`; `src/pages/events/rss.xml.ts` serves `/events/rss.xml`. Each is a `prerender = false` endpoint exporting `GET` that calls `getEmDashEntry`/`getEmDashCollection` and returns a `new Response(body, { headers: { 'Content-Type': ... } })`. For `.ics`, flatten the Portable Text body to plain text and emit UTC `DTSTART`/`DTEND` (`VALUE=DATE` for all-day); for RSS, mirror the blog feed and use the collection's own date field as `<pubDate>`.

## Contact leads admin (D1 `contact_messages`)

Sandboxed plugins **cannot** read app D1. Ship a **trusted** local plugin (see `memberfix-site/plugins/contact-inbox/`) that:

- Registers in `astro.config.mjs` `plugins: []` with `adminPages: [{ path: '/leads', label: 'Leads' }]`
- Uses `import('cloudflare:workers').then(m => m.env.DB)` for `SELECT`/`UPDATE` on `contact_messages`
- Exposes Block Kit admin table + mark-handled routes

Apply `migrations/0002_contact_status.sql` (status column) on remote D1. Full recipe lives next to the plugin README; skillify separately as `emdash-contact-inbox` when packaging for AutoVault.
