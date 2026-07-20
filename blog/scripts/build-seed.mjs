#!/usr/bin/env node
/**
 * Build seed/seed.json from skillissue essay markdown + chart SVGs.
 * Portable Text: standard blocks + figureSvg (emdash-plugin-figures).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(blogRoot, '..');

function key(s) {
  return createHash('sha1').update(String(s)).digest('hex').slice(0, 10);
}

function parseFrontmatter(text) {
  if (!text.startsWith('---')) return { fm: {}, body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { fm: {}, body: text };
  const raw = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\n/, '');
  const fm = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    fm[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return { fm, body };
}

function inlineMarks(text) {
  // Minimal: emit plain span; EmDash admin can re-edit for rich marks.
  // Split **bold** into separate spans.
  const children = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) {
      children.push({
        _type: 'span',
        _key: `s${i++}`,
        text: text.slice(last, m.index),
      });
    }
    if (m[1]) {
      children.push({
        _type: 'span',
        _key: `s${i++}`,
        text: m[1],
        marks: ['strong'],
      });
    } else if (m[2]) {
      children.push({
        _type: 'span',
        _key: `s${i++}`,
        text: m[2],
        marks: ['code'],
      });
    } else if (m[3] && m[4]) {
      const markKey = `link${i}`;
      children.push({
        _type: 'span',
        _key: `s${i++}`,
        text: m[3],
        marks: [markKey],
      });
      // markDefs added on parent block later — stash on span temp
      children[children.length - 1]._href = m[4];
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    children.push({
      _type: 'span',
      _key: `s${i++}`,
      text: text.slice(last),
    });
  }
  if (!children.length) {
    children.push({ _type: 'span', _key: 's0', text: text });
  }
  return children;
}

function makeBlock(style, text, listItem) {
  const children = inlineMarks(text);
  const markDefs = [];
  for (const c of children) {
    if (c._href) {
      const mk = c.marks[0];
      markDefs.push({
        _type: 'link',
        _key: mk,
        href: c._href,
      });
      delete c._href;
    }
  }
  const block = {
    _type: 'block',
    _key: key(style + text.slice(0, 40) + Math.random()),
    style: style || 'normal',
    markDefs,
    children: children.map(({ _type, _key, text: t, marks }) => ({
      _type,
      _key,
      text: t,
      ...(marks ? { marks } : {}),
    })),
  };
  if (listItem) block.listItem = listItem;
  return block;
}

function loadChartSvg(name) {
  const p = path.join(blogRoot, 'public/charts', name);
  if (!fs.existsSync(p)) {
    // fall back to content/assets
    const alt = path.join(repoRoot, 'content/assets/charts', name);
    if (!fs.existsSync(alt)) return null;
    return fs.readFileSync(alt, 'utf8');
  }
  return fs.readFileSync(p, 'utf8');
}

function figureSvg(svg, alt, caption) {
  return {
    _type: 'figureSvg',
    _key: key(alt + caption),
    svg,
    alt: alt || caption || '',
    caption: caption || '',
  };
}

function mdToPortableText(md) {
  const lines = md.split('\n');
  const blocks = [];
  let inCode = false;
  let codeBuf = [];
  let inBq = false;
  let bqBuf = [];

  const flushBq = () => {
    if (!inBq) return;
    blocks.push(makeBlock('blockquote', bqBuf.join(' ')));
    inBq = false;
    bqBuf = [];
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      flushBq();
      if (!inCode) {
        inCode = true;
        codeBuf = [];
      } else {
        blocks.push({
          _type: 'code',
          _key: key(codeBuf.join('\n').slice(0, 40)),
          language: 'text',
          code: codeBuf.join('\n'),
        });
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) {
      flushBq();
      const alt = img[1];
      const src = img[2];
      const chartName = src.split('/').pop();
      if (chartName?.endsWith('.svg')) {
        const svg = loadChartSvg(chartName);
        if (svg) {
          blocks.push(figureSvg(svg, alt, alt));
          continue;
        }
      }
      // Fallback: plain paragraph with path note
      blocks.push(makeBlock('normal', `[Figure: ${alt}]`));
      continue;
    }

    if (/^> /.test(line) || line === '>') {
      if (!inBq) inBq = true;
      bqBuf.push(line.replace(/^>\s?/, ''));
      continue;
    }
    if (inBq) flushBq();

    if (/^### /.test(line)) {
      blocks.push(makeBlock('h3', line.slice(4)));
    } else if (/^## /.test(line)) {
      blocks.push(makeBlock('h2', line.slice(3)));
    } else if (/^# /.test(line)) {
      // skip H1 — title field owns it
      continue;
    } else if (/^[-*] /.test(line)) {
      blocks.push(makeBlock('normal', line.slice(2), 'bullet'));
    } else if (/^\d+\.\s/.test(line)) {
      blocks.push(makeBlock('normal', line.replace(/^\d+\.\s/, ''), 'number'));
    } else if (/^---+$/.test(line.trim())) {
      // skip hr — not all PT renderers have it
    } else if (!line.trim()) {
      // skip blank
    } else if (line.startsWith('|')) {
      // tables → plain text lines for seed; editor can upgrade later
      blocks.push(makeBlock('normal', line));
    } else {
      blocks.push(makeBlock('normal', line));
    }
  }
  flushBq();
  return blocks;
}

// --- main ---
const essayPath = path.join(
  repoRoot,
  'content/essays/skills-are-the-new-mcp-bloat.md'
);
const raw = fs.readFileSync(essayPath, 'utf8');
const { fm, body } = parseFrontmatter(raw);
const content = mdToPortableText(body);

const seed = {
  $schema: 'https://emdashcms.com/seed.schema.json',
  version: '1',
  meta: {
    name: 'skillissue essays',
    description: 'Hybrid EmDash blog for skillissue.sh essays',
    author: 'Jack Arturo',
  },
  settings: {
    title: 'skillissue essays',
    tagline: 'Skills, MCP, and context discipline',
    language: 'en',
  },
  collections: [
    {
      slug: 'posts',
      label: 'Essays',
      labelSingular: 'Essay',
      description: 'Long-form writing for skillissue.sh',
      supports: ['drafts', 'revisions', 'search', 'seo'],
      urlPattern: '/essays/{slug}',
      commentsEnabled: false,
      fields: [
        {
          slug: 'title',
          label: 'Title',
          type: 'string',
          required: true,
          searchable: true,
        },
        { slug: 'featured_image', label: 'Featured Image', type: 'image' },
        {
          slug: 'excerpt',
          label: 'Excerpt',
          type: 'text',
          searchable: true,
        },
        {
          slug: 'content',
          label: 'Content',
          type: 'portableText',
          searchable: true,
        },
      ],
    },
  ],
  taxonomies: [
    {
      name: 'tag',
      label: 'Tags',
      labelSingular: 'Tag',
      hierarchical: false,
      collections: ['posts'],
      terms: [
        { slug: 'mcp', label: 'MCP' },
        { slug: 'skills', label: 'Skills' },
        { slug: 'autohub', label: 'AutoHub' },
        { slug: 'autovault', label: 'AutoVault' },
      ],
    },
  ],
  bylines: [
    {
      slug: 'jack-arturo',
      name: 'Jack Arturo',
      bio: 'Builder of AutoHub, AutoMem, AutoVault, and skillissue.sh.',
    },
  ],
  menus: [
    {
      name: 'primary',
      label: 'Primary',
      items: [
        { type: 'custom', label: 'Essays', custom_url: '/essays' },
        {
          type: 'custom',
          label: 'Skills catalog',
          custom_url: 'https://skillissue.sh/skills/',
        },
        {
          type: 'custom',
          label: 'Install',
          custom_url: 'https://skillissue.sh/install/',
        },
      ],
    },
  ],
  content: {
    posts: [
      {
        slug: 'skills-are-the-new-mcp-bloat',
        status: 'published',
        data: {
          title: fm.title || 'Skills Are the New MCP Bloat',
          excerpt:
            fm.description ||
            'Progressive disclosure fixes skill bodies. It does not fix skill catalogs.',
          content,
        },
        bylines: ['jack-arturo'],
        taxonomies: {
          tag: ['mcp', 'skills', 'autohub', 'autovault'],
        },
      },
    ],
  },
};

const out = path.join(blogRoot, 'seed/seed.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(seed, null, 2) + '\n');
console.log(
  `Wrote ${out} (${content.length} blocks, figureSvg count=${content.filter((b) => b._type === 'figureSvg').length})`
);
