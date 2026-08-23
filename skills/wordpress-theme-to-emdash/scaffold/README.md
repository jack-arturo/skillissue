# EmDash Theme Scaffold

This is an **existing EmDash workspace template**, not a standalone starter. It demonstrates correct patterns for:

- **Site settings** - Use `getSiteSettings()` for title, tagline, logo - never hard-code
- **Menus** - Use `getMenu()` for navigation - never hard-code links
- **Image fields** - Always access `.src` and `.alt`, never the field directly
- **Taxonomy terms** - Use `getEntryTerms()` without a db parameter
- **PortableText** - Use the `<PortableText>` component from `emdash/ui`

## Critical: No Hard-Coded Content

The theme is a shell that displays CMS content. Never hard-code:

- Site title or tagline (use `settings.title`, `settings.tagline`)
- Navigation links (use `getMenu("primary")`)
- Logo or favicon (use `settings.logo`, `settings.favicon`)
- Footer content (use site settings or widget areas)

## Usage

When porting a WordPress theme:

1. Copy this scaffold into an EmDash workspace that already provides the `emdash` package.
2. Rename the package and update the workspace configuration from the monorepo root.
3. Run `pnpm install` from the workspace root.
4. Verify it builds: `pnpm --filter your-theme build`.

It intentionally uses `"emdash": "workspace:*"`; do not copy this package manifest into an unrelated standalone repository. For a standalone site, start from the installed EmDash package's current setup instructions instead.

## Key Patterns

### Image Fields

```astro
import { Image } from "emdash/ui";

{/* CORRECT - check .src exists */}
{post.data.featured_image?.src && (
  <Image
    src={post.data.featured_image.src}
    alt={post.data.featured_image.alt || post.data.title}
  />
)}

{/* WRONG - passing the field object directly instead of its src */}
<Image src={post.data.featured_image} alt={post.data.title} />
```

### Taxonomy Terms

```astro
{/* CORRECT - no db parameter */}
const categories = await getEntryTerms("posts", post.id, "categories");

{/* WRONG - db is not a parameter */}
const categories = await getEntryTerms("posts", post.id, "categories", db);
```

### Seed File Images

```json
{
	"featured_image": {
		"$media": {
			"url": "https://example.com/image.jpg",
			"alt": "Description",
			"filename": "image.jpg"
		}
	}
}
```

At runtime, this becomes `{ src: "...", alt: "..." }`.

## Files

```
scaffold/
├── package.json           # Working dependency versions
├── astro.config.mjs       # Minimal config
├── tsconfig.json
├── src/
│   ├── env.d.ts
│   ├── live.config.ts     # Collection loader setup
│   ├── styles/global.css  # Minimal styles with comments
│   ├── layouts/Base.astro # Header, footer, menus
│   ├── components/
│   │   └── PostCard.astro # Image field handling example
│   └── pages/
│       ├── index.astro
│       ├── 404.astro
│       ├── posts/
│       │   ├── index.astro
│       │   └── [slug].astro  # Taxonomy terms example
│       ├── pages/[slug].astro
│       ├── categories/[slug].astro
│       └── tags/[slug].astro
├── public/
│   └── favicon.svg
└── .emdash/
```

This scaffold does **not** bundle a seed file. Add one for the specific migration only after the content model and media mapping are known.
