#!/usr/bin/env node
/**
 * Merge vault-index + content/skills/*.md → site/
 * --strict fails if any public skill lacks uniqueness gate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const strict = process.argv.includes("--strict");
const siteDir = path.join(root, "site");
const contentSkills = path.join(root, "content/skills");
const contentStory = path.join(root, "content/story");
const assetsSrc = path.join(root, "site/assets");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseMd(text) {
  if (!text.startsWith("---")) return { fm: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { fm: {}, body: text };
  const raw = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\n/, "");
  const fm = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (val === ">" || val === ">-") continue;
    if (val.startsWith("[") && val.endsWith("]")) {
      fm[key] = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else if (val.startsWith('"') || val.startsWith("'")) {
      fm[key] = val.replace(/^["']|["']$/g, "");
    } else {
      fm[key] = val.trim();
    }
  }
  // folded summary lines immediately after summary: >-
  if (raw.includes("summary:")) {
    const sm = raw.match(/summary:\s*>-?\s*\n((?:\s+.+\n?)+)/);
    if (sm) fm.summary = sm[1].split("\n").map((l) => l.trim()).filter(Boolean).join(" ");
  }
  return { fm, body };
}

function mdToHtml(md) {
  const lines = md.split("\n");
  const html = [];
  let inList = false;
  let inCode = false;
  let codeBuf = [];
  const flushList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };
  for (const line of lines) {
    if (line.startsWith("```")) {
      if (!inCode) {
        flushList();
        inCode = true;
        codeBuf = [];
      } else {
        html.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    if (/^### /.test(line)) {
      flushList();
      html.push(`<h3>${esc(line.slice(4))}</h3>`);
    } else if (/^## /.test(line)) {
      flushList();
      html.push(`<h2>${esc(line.slice(3))}</h2>`);
    } else if (/^# /.test(line)) {
      flushList();
      html.push(`<h2>${esc(line.slice(2))}</h2>`);
    } else if (/^[-*] /.test(line)) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (!line.trim()) {
      flushList();
    } else {
      flushList();
      html.push(`<p>${inline(line)}</p>`);
    }
  }
  flushList();
  if (inCode) html.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
  return html.join("\n");
}

function inline(s) {
  let t = esc(s);
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(
    /\[([^\]]+)\]\((https?:[^)]+)\)/g,
    '<a href="$2" rel="noopener">$1</a>'
  );
  return t;
}

function loadDenylist() {
  const p = path.join(root, "catalog/denylist.txt");
  if (!fs.existsSync(p)) return new Set();
  return new Set(
    fs
      .readFileSync(p, "utf8")
      .split("\n")
      .map((l) => l.replace(/#.*$/, "").trim())
      .filter(Boolean)
  );
}

function shellLayout({ title, description, path: pagePath, body, active }) {
  const nav = [
    ["/", "home", "home"],
    ["/skills/", "skills", "skills"],
    ["/install/", "install", "install"],
    ["/about/", "about", "about"],
  ]
    .map(
      ([href, id, label]) =>
        `<a href="${href}"${active === id ? ' aria-current="page"' : ""}>${label}</a>`
    )
    .join("\n        ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="https://skillissue.sh${esc(pagePath)}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta name="theme-color" content="#0a0c0f">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="https://skillissue.sh/assets/og.png">
<meta property="og:url" content="https://skillissue.sh${esc(pagePath)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/site.css">
<link rel="alternate" type="application/json" href="/skills.json" title="Skills catalog">
</head>
<body>
  <header class="top" id="topbar">
    <div class="wrap top-inner">
      <a class="brand" href="/">
        <span class="brand-mark" aria-hidden="true">$</span>
        <span>skillissue.sh</span>
      </a>
      <nav class="links" aria-label="Primary">
        ${nav}
        <a href="/skills.json">skills.json</a>
        <a href="https://github.com/jack-arturo/skillissue" rel="noopener">github</a>
      </nav>
    </div>
  </header>
  <main>
${body}
  </main>
  <footer>
    <div class="wrap foot-inner">
      <div>
        <span class="foot-mono">skillissue.sh</span>
        · MIT ·
        <a href="https://autovault.dev">AutoVault</a> ·
        <a href="https://automem.ai">AutoMem</a> ·
        <a href="/skills.json">skills.json</a>
      </div>
      <div class="foot-mono">also answers on skilissue.sh</div>
    </div>
  </footer>
  <script>
    (function(){
      var t=document.getElementById('topbar');
      if(!t)return;
      var on=function(){t.classList.toggle('scrolled',window.scrollY>8)};
      window.addEventListener('scroll',on,{passive:true});on();
      document.addEventListener('click',async function(e){
        var b=e.target.closest('[data-copy]');if(!b)return;
        try{await navigator.clipboard.writeText(b.getAttribute('data-copy'));
          var p=b.textContent;b.textContent='copied';b.classList.add('copied');
          setTimeout(function(){b.textContent=p;b.classList.remove('copied')},1200);
        }catch(_){b.textContent='failed'}
      });
    })();
  </script>
</body>
</html>
`;
}

// --- load data ---
const vaultPath = path.join(root, "catalog/vault-index.json");
// CI/Pages has no ~/.autovault — commit vault-index.json from local `npm run inventory`.
let vault = { count: 0, skills: [] };
if (fs.existsSync(vaultPath)) {
  vault = JSON.parse(fs.readFileSync(vaultPath, "utf8"));
} else {
  console.warn("WARN: catalog/vault-index.json missing — building from content only");
}
const byName = new Map((vault.skills || []).map((s) => [s.name, s]));
const deny = loadDenylist();

const contentFiles = fs.existsSync(contentSkills)
  ? fs.readdirSync(contentSkills).filter((f) => f.endsWith(".md") && !f.startsWith("_"))
  : [];

const publicSkills = [];
const errors = [];
const report = { public: 0, internal: 0, missingNarrative: [], denied: [] };

for (const file of contentFiles) {
  const raw = fs.readFileSync(path.join(contentSkills, file), "utf8");
  const { fm, body } = parseMd(raw);
  const name = fm.name || file.replace(/\.md$/, "");
  if (deny.has(name)) {
    report.denied.push(name);
    continue;
  }
  const visibility = fm.visibility || "internal";
  if (visibility !== "public") {
    report.internal++;
    continue;
  }
  const vaultSkill = byName.get(name) || {};
  const provenance = fm.provenance || "house";
  const bodyTrim = body.trim();
  const hasNarrative =
    bodyTrim.length > 80 &&
    (/##\s+Why/i.test(body) ||
      /##\s+History/i.test(body) ||
      /##\s+How/i.test(body) ||
      /##\s+Origin/i.test(body));
  if (!hasNarrative && provenance === "house") {
    report.missingNarrative.push(name);
    if (strict) errors.push(`public house skill lacks narrative: ${name}`);
  }
  if (!hasNarrative && provenance !== "house" && !/origin|upstream|source/i.test(body)) {
    report.missingNarrative.push(name);
    if (strict) errors.push(`public upstream skill lacks origin note: ${name}`);
  }

  const skill = {
    name,
    title: fm.title || name,
    summary: fm.summary || vaultSkill.description || "",
    description: fm.summary || vaultSkill.description || "",
    category: fm.category || vaultSkill.category || "uncategorized",
    version: fm.version_pin || vaultSkill.version || "?",
    tags: fm.tags || vaultSkill.tags || [],
    agents: vaultSkill.agents || [],
    featured: fm.featured === true || fm.featured === "true",
    provenance,
    related: fm.related || [],
    first_used: fm.first_used || "",
    bodyHtml: mdToHtml(body),
    body,
  };
  publicSkills.push(skill);
  report.public++;
}

publicSkills.sort((a, b) => {
  if (!!b.featured - !!a.featured) return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  return a.name.localeCompare(b.name);
});

if (strict && errors.length) {
  console.error("STRICT FAIL:\n" + errors.map((e) => " - " + e).join("\n"));
  process.exit(1);
}

// preserve assets
const keepAssets = fs.existsSync(assetsSrc)
  ? null
  : null;

// clean generated pages but keep assets
for (const ent of fs.readdirSync(siteDir, { withFileTypes: true })) {
  if (ent.name === "assets") continue;
  const p = path.join(siteDir, ent.name);
  if (ent.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
  else if (ent.name !== ".gitkeep") fs.unlinkSync(p);
}

// CSS — write site.css if missing (build always overwrites from template)
const cssPath = path.join(siteDir, "assets/site.css");
fs.mkdirSync(path.join(siteDir, "assets"), { recursive: true });

// --- skills.json ---
const skillsJson = {
  name: "skillissue",
  url: "https://skillissue.sh",
  description:
    "Jack Arturo's personal/agent skills collection — skills that earn their keep across Claude Code, Codex, Cursor, and AutoHub.",
  updated: new Date().toISOString().slice(0, 10),
  vaultSkillsKnown: vault.count,
  publicCount: publicSkills.length,
  install: {
    autovault: "autovault add <skill> --sync-profiles",
    skills_cli: "npx skills find <query>",
  },
  featured: publicSkills.filter((s) => s.featured).map((s) => s.name),
  skills: publicSkills.map((s) => ({
    name: s.name,
    title: s.title,
    category: s.category,
    description: s.summary,
    version: s.version,
    tags: s.tags,
    agents: s.agents,
    featured: !!s.featured,
    provenance: s.provenance,
    url: `https://skillissue.sh/skills/${s.name}/`,
  })),
};
fs.writeFileSync(path.join(siteDir, "skills.json"), JSON.stringify(skillsJson, null, 2) + "\n");

// --- per-skill pages ---
for (const s of publicSkills) {
  const dir = path.join(siteDir, "skills", s.name);
  fs.mkdirSync(dir, { recursive: true });
  const related = (s.related || [])
    .filter((n) => publicSkills.some((p) => p.name === n))
    .map(
      (n) =>
        `<a class="tag" href="/skills/${esc(n)}/">${esc(n)}</a>`
    )
    .join(" ");
  const tags = (s.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join(" ");
  const installCmd = `npx skills find ${s.name}`;
  const body = `
    <section class="hero skill-hero">
      <div class="wrap">
        <div class="prompt"><span class="dot"></span> skill · v${esc(s.version)} · ${esc(s.provenance)}</div>
        <h1><span class="path">${esc(s.name)}</span></h1>
        <p class="lede">${esc(s.summary)}</p>
        <div class="meta" style="margin-bottom:1.25rem">${tags}
          <span class="badge">${esc(s.provenance)}</span>
          ${s.featured ? '<span class="badge">featured</span>' : ""}
        </div>
        <div class="cta-row">
          <button type="button" class="btn btn-primary" data-copy="${esc(installCmd)}">Copy find command</button>
          <a class="btn btn-ghost" href="/skills/">All skills</a>
          <a class="btn btn-ghost" href="https://autovault.dev">AutoVault</a>
        </div>
        <div class="term" style="max-width:42rem">
          <div class="term-bar"><i></i><i></i><i></i><span class="term-title">install</span></div>
          <div class="term-body">
            <div><span class="dim">$</span> <span class="cmd">${esc(installCmd)}</span></div>
            <div class="dim"># package lives in AutoVault; this page is the public story</div>
          </div>
        </div>
      </div>
    </section>
    <section>
      <div class="wrap prose">
        ${s.bodyHtml}
        ${related ? `<h2>Related</h2><div class="meta">${related}</div>` : ""}
        <h2>In the vault</h2>
        <p class="muted">Category <code>${esc(s.category)}</code>
        ${s.agents?.length ? ` · agents: ${esc(s.agents.join(", "))}` : ""}
        ${s.first_used ? ` · first used ${esc(s.first_used)}` : ""}</p>
      </div>
    </section>`;
  fs.writeFileSync(
    path.join(dir, "index.html"),
    shellLayout({
      title: `${s.name} — skillissue.sh`,
      description: s.summary,
      path: `/skills/${s.name}/`,
      body,
      active: "skills",
    })
  );
}

// --- catalog /skills/ ---
fs.mkdirSync(path.join(siteDir, "skills"), { recursive: true });
const cards = publicSkills
  .map((s) => {
    const tags = (s.tags || [])
      .slice(0, 4)
      .map((t) => `<span class="tag">${esc(t)}</span>`)
      .join("");
    return `<a class="card${s.featured ? " featured" : ""}" href="/skills/${esc(s.name)}/">
  <div class="card-top"><h3>${esc(s.name)}</h3>
  ${s.featured ? '<span class="badge">featured</span>' : `<span class="tag">${esc(s.category)}</span>`}
  </div>
  <p>${esc(s.summary)}</p>
  <div class="meta">${tags}<span class="tag">v${esc(s.version)}</span></div>
</a>`;
  })
  .join("\n");

const catalogBody = `
    <section class="hero" style="padding-bottom:1.5rem">
      <div class="wrap">
        <div class="prompt"><span class="dot"></span> ${publicSkills.length} public · ${vault.count} in vault</div>
        <h1>Skills</h1>
        <p class="lede">Only skills with a real story ship here. The rest stay in the vault until they earn a page.</p>
        <div class="search-row"><input class="search" id="q" type="search" placeholder="filter…" autocomplete="off" spellcheck="false"></div>
        <div class="filters" id="filters"></div>
      </div>
    </section>
    <section style="padding-top:0">
      <div class="wrap">
        <div class="grid" id="grid">${cards}</div>
        <div class="empty" id="empty">No skills match.</div>
      </div>
    </section>
    <script>
    (function(){
      var cards=[].slice.call(document.querySelectorAll('#grid .card'));
      var cats={};cards.forEach(function(c){
        var t=c.querySelector('.tag'); if(t) cats[t.textContent]=1;
      });
      var filters=document.getElementById('filters');
      var active='all';
      function paint(){
        filters.innerHTML=['all'].concat(Object.keys(cats).sort()).map(function(c){
          return '<button type="button" class="chip'+(c===active?' active':'')+'" data-cat="'+c+'">'+c+'</button>';
        }).join('');
      }
      paint();
      filters.addEventListener('click',function(e){
        var b=e.target.closest('[data-cat]'); if(!b)return; active=b.getAttribute('data-cat'); paint(); filter();
      });
      var q=document.getElementById('q');
      function filter(){
        var qq=(q.value||'').toLowerCase(); var n=0;
        cards.forEach(function(c){
          var text=c.textContent.toLowerCase();
          var catEl=c.querySelector('.tag'); var cat=catEl?catEl.textContent:'';
          var ok=(active==='all'||cat===active)&&(!qq||text.indexOf(qq)>=0);
          c.style.display=ok?'':'none'; if(ok)n++;
        });
        document.getElementById('empty').classList.toggle('show',n===0);
      }
      q.addEventListener('input',filter);
    })();
    </script>`;
fs.writeFileSync(
  path.join(siteDir, "skills/index.html"),
  shellLayout({
    title: "Skills — skillissue.sh",
    description: "Jack Arturo's public agent skills catalog.",
    path: "/skills/",
    body: catalogBody,
    active: "skills",
  })
);

// --- home ---
const featured = publicSkills.filter((s) => s.featured).slice(0, 8);
const featCards = featured
  .map(
    (s) => `<a class="card featured" href="/skills/${esc(s.name)}/">
  <div class="card-top"><h3>${esc(s.name)}</h3><span class="badge">featured</span></div>
  <p>${esc(s.summary)}</p>
</a>`
  )
  .join("\n");

const homeBody = `
    <section class="hero">
      <div class="wrap">
        <div class="prompt"><span class="dot"></span> live · ${publicSkills.length} public skills · ${vault.count} in vault</div>
        <h1><span class="path">skillissue</span>.sh<span class="cursor" aria-hidden="true"></span></h1>
        <p class="lede">
          Jack Arturo’s personal/agent skills collection —
          the ones that <strong>earn their keep</strong> across Claude Code, Codex, Cursor, and AutoHub.
          Not a marketplace. A public window onto skills that survived real use.
        </p>
        <div class="cta-row">
          <a class="btn btn-primary" href="/skills/">Browse skills</a>
          <a class="btn btn-ghost" href="/install/">Install</a>
          <a class="btn btn-ghost" href="/about/">The story</a>
        </div>
        <div class="term" aria-label="Example terminal session">
          <div class="term-bar"><i></i><i></i><i></i><span class="term-title">zsh · skillissue</span></div>
          <div class="term-body">
            <div><span class="dim">$</span> <span class="cmd">npx skills find cloudflare</span></div>
            <div class="dim"># packages live in AutoVault; stories live here</div>
            <div class="ok">✓ ${publicSkills.length} public narratives · vault knows ${vault.count}</div>
            <div class="amber"># if your agent still can't ship… skill issue</div>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><b>${publicSkills.length}</b><span>public skill pages</span></div>
          <div class="stat"><b>${vault.count}</b><span>skills in the vault</span></div>
          <div class="stat"><b>${featured.length}</b><span>featured</span></div>
        </div>
      </div>
    </section>
    <section id="featured">
      <div class="wrap">
        <div class="section-head"><h2>Featured</h2><div class="section-note">house skills that pull weight</div></div>
        <div class="grid">${featCards}</div>
      </div>
    </section>
    <section id="newsletter">
      <div class="wrap">
        <div class="section-head"><h2>Get drops</h2><div class="section-note">occasional · no spam</div></div>
        <div class="panel" style="max-width:36rem">
          <h3>Skills that earn their keep</h3>
          <p>Occasional notes when a new skill ships or an old one levels up. Unsubscribe anytime.</p>
          <form class="signup" id="signup" action="/api/signup" method="POST">
            <input type="email" name="email" required placeholder="you@example.com" autocomplete="email" class="search" style="margin-bottom:0.6rem">
            <input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
            <input type="hidden" name="source" value="skillissue-hub">
            <button type="submit" class="btn btn-primary">Subscribe</button>
            <p class="form-msg" id="signup-msg" hidden></p>
          </form>
        </div>
      </div>
    </section>
    <section>
      <div class="wrap about" style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:1.25rem">
        <div>
          <h2>Why this exists</h2>
          <p class="muted">AutoVault holds the packages. AutoMem holds the memory. skillissue.sh is the public shelf — what Jack actually runs, with history and install paths, without pretending it's a global registry.</p>
          <p><a href="/about/">Read the full stack story →</a></p>
        </div>
        <div class="callout">
          <h3>$ whoami</h3>
          <p>Jack Arturo — Very Good Plugins, AutoHub, AutoMem, AutoVault. These skills are personal tooling made public where useful.</p>
        </div>
      </div>
    </section>
    <script>
    (function(){
      var f=document.getElementById('signup'); if(!f)return;
      f.addEventListener('submit',async function(e){
        e.preventDefault();
        var msg=document.getElementById('signup-msg');
        var fd=new FormData(f);
        var body=Object.fromEntries(fd.entries());
        try{
          var r=await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'fetch'},body:JSON.stringify(body)});
          var j={}; try{j=await r.json()}catch(_){}
          msg.hidden=false;
          msg.textContent=r.ok?(j.message||'Check your inbox to confirm.'):(j.error||'Signup failed — try again later.');
        }catch(_){msg.hidden=false;msg.textContent='Network error — try again later.'}
      });
    })();
    </script>`;

fs.writeFileSync(
  path.join(siteDir, "index.html"),
  shellLayout({
    title: "skillissue.sh — agent skills that earn their keep",
    description:
      "Jack Arturo's personal/agent skills collection. Real skills for Claude Code, Codex, Cursor, and AutoHub.",
    path: "/",
    body: homeBody,
    active: "home",
  })
);

// --- about / install / changelog from story md or defaults ---
function storyPage(slug, fallbackTitle, fallbackMd, active) {
  const p = path.join(contentStory, `${slug}.md`);
  let title = fallbackTitle;
  let bodyMd = fallbackMd;
  if (fs.existsSync(p)) {
    const { fm, body } = parseMd(fs.readFileSync(p, "utf8"));
    title = fm.title || fallbackTitle;
    bodyMd = body;
  }
  const dir = slug === "about" ? path.join(siteDir, "about") : path.join(siteDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  const html = shellLayout({
    title: `${title} — skillissue.sh`,
    description: title,
    path: `/${slug === "home" ? "" : slug + "/"}`,
    body: `<section class="hero" style="padding-bottom:1rem"><div class="wrap"><h1>${esc(title)}</h1></div></section>
    <section style="padding-top:0"><div class="wrap prose">${mdToHtml(bodyMd)}</div></section>`,
    active,
  });
  fs.writeFileSync(path.join(dir, "index.html"), html);
}

storyPage(
  "about",
  "About",
  `## The short version

skillissue.sh is the public window onto skills Jack actually runs. Packages live in [AutoVault](https://autovault.dev). Memory lives in [AutoMem](https://automem.ai). The runtime that glues day-to-day agent work is AutoHub.

## The longer version

I build tools for agents the same way I used to build WordPress plugins — ship something that survives real use, then package the pattern so the next agent (or the next me) doesn't re-learn it from scratch.

**Very Good Plugins** paid the bills and taught the ops muscle. **AutoHub** became the agent runtime. **AutoMem** gave assistants durable memory. **AutoVault** is where skills get validated, signed, and synced across Claude Code, Codex, Cursor, and friends without drifting into five half-broken copies.

This site is not a registry. It's a shelf. If a skill doesn't have a story yet, it stays in the vault.

## Domains

Canonical: skillissue.sh. Typo catch: skilissue.sh. Same site.
`,
  "about"
);

storyPage(
  "install",
  "Install",
  `## Preferred: AutoVault

Skills that earn a page here are meant to live in your local vault and sync into each agent's skill directory.

\`\`\`
autovault add <source> --sync-profiles
\`\`\`

See [autovault.dev](https://autovault.dev) for install paths (npm, Homebrew, installer script).

## Skills CLI

For discovery across the open ecosystem:

\`\`\`
npx skills find <query>
npx skills add <package>
\`\`\`

## What this site is not

We don't host the skill package bytes. We host the **story**, version context, and install affordances. The vault is the source of truth for what the agent loads.
`,
  "install"
);

storyPage(
  "changelog",
  "Changelog",
  `## 0.2.0 — 2026-07-20

- Catalog generator from AutoVault inventory + authored narratives
- Per-skill pages with provenance + version badges
- About / install / uniqueness gate
- Newsletter signup surface (Pages Functions + D1 + Resend)

## 0.1.0 — 2026-07-19

- Initial static hub on Cloudflare Pages
- Domains skillissue.sh + skilissue.sh
`,
  "home"
);

// llms.txt
const llms = `# skillissue.sh

> Jack Arturo's personal/agent skills collection. Skills that earn their keep across Claude Code, Codex, Cursor, and AutoHub.

## Site
- Home: https://skillissue.sh/
- Catalog: https://skillissue.sh/skills/
- Machine catalog: https://skillissue.sh/skills.json
- About: https://skillissue.sh/about/
- Install: https://skillissue.sh/install/
- Source: https://github.com/jack-arturo/skillissue

## Relationship
- AutoVault (https://autovault.dev) — local-first vault for skill packages
- AutoMem (https://automem.ai) — durable agent memory
- skillissue.sh — public narratives + install affordances for Jack's collection

## Public skills (${publicSkills.length})
${publicSkills.map((s) => `- ${s.name} (v${s.version}) — ${s.summary}`).join("\n")}

## Vault
The local vault currently indexes ${vault.count} skills. Only skills with authored public narratives appear on this site.
`;
fs.writeFileSync(path.join(siteDir, "llms.txt"), llms);

// sitemap + robots + headers
const urls = [
  "/",
  "/skills/",
  "/about/",
  "/install/",
  "/changelog/",
  "/skills.json",
  "/llms.txt",
  ...publicSkills.map((s) => `/skills/${s.name}/`),
];
fs.writeFileSync(
  path.join(siteDir, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>https://skillissue.sh${u}</loc><changefreq>weekly</changefreq></url>`
      )
      .join("\n") +
    `\n</urlset>\n`
);
fs.writeFileSync(
  path.join(siteDir, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: https://skillissue.sh/sitemap.xml\n`
);
fs.writeFileSync(
  path.join(siteDir, "_headers"),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: interest-cohort=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Frame-Options: DENY

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/skills.json
  Cache-Control: public, max-age=300

/llms.txt
  Cache-Control: public, max-age=300

/index.html
  Cache-Control: public, max-age=0, must-revalidate
`
);

// ensure CSS exists
const css = fs.readFileSync(path.join(__dirname, "site.css"), "utf8");
fs.writeFileSync(cssPath, css);

// report
report.generatedAt = new Date().toISOString();
report.publicSkills = publicSkills.map((s) => s.name);
fs.writeFileSync(
  path.join(root, "catalog/report.json"),
  JSON.stringify(report, null, 2) + "\n"
);

console.log(
  `Built site: ${report.public} public, ${report.internal} content-internal, vault=${vault.count}`
);
if (report.missingNarrative.length) {
  console.warn("Missing narrative:", report.missingNarrative.join(", "));
}
