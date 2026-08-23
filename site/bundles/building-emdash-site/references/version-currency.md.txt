# EmDash CMS version currency

Canonical repo: **[emdash-cms/emdash](https://github.com/emdash-cms/emdash)**
npm: `emdash`, `@emdash-cms/cloudflare`, `@emdash-cms/admin`, …

**Not the same product:** [generalaction/emdash](https://github.com/generalaction/emdash) (agentic IDE).

## Always resolve latest before scaffolding

```bash
npm view emdash version
npm view @emdash-cms/cloudflare version
npm view emdash dist-tags
gh release list -R emdash-cms/emdash --limit 10
```

Pin **`emdash` and `@emdash-cms/cloudflare` to the same minor** (e.g. both `^0.29.0`). Do not copy versions from an older sibling repo unless the user freezes the line.

## New-project ritual

1. **Latest** — commands above → `to_version`
2. **Baseline** — AutoMem + last project `package.json` → `from_version`
3. **Delta** — `gh release view emdash@X.Y.Z -R emdash-cms/emdash` for each tag in `(from, to]`
4. **Summary** — write `docs/emdash-version-delta.md` (breaking / adopt / defer / security)
5. **Decide**
   - default: latest pin + propose adoptable features
   - full autonomy: adopt low-risk upgrades, ship, store AutoMem, patch skills if contracts changed

## Reading release tags

GitHub tags are monorepo-style: `emdash@0.29.0`, `@emdash-cms/cloudflare@0.29.0`, not `v0.29.0`.

## After upgrade / first deploy on a new line

Store memory (bare tags: `emdash`, project slug, `decision`):

> EmDash CMS baseline 0.29.0 on &lt;project&gt;. Adopted: … Deferred: …

If seed shape, admin branding, Worker deploy, or plugin hooks changed, update `building-emdash-site` + `cloudflare-emdash-cms-deploy` in the same session.
