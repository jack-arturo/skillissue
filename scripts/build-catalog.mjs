#!/usr/bin/env node
/**
 * Build site/ from skills/* SSOT (GitHub repo tree).
 * No local AutoVault required — Pages CI has the git checkout.
 *
 *   skills/<name>/SKILL.md   — installable package
 *   skills/<name>/story.md   — public narrative (site-only content)
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const strict = process.argv.includes("--strict");
const siteDir = path.join(root, "site");
const skillsDir = path.join(root, "skills");
const contentStory = path.join(root, "content/story");
const REPO = "jack-arturo/skillissue";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function gitSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "main";
  }
}

function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { fm: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { fm: {}, body: text };
  const raw = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\n/, "");
  const fm = {};
  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) {
      i++;
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1];
    let val = m[2];
    if (val === ">" || val === ">-" || val === "|" || val === "|-") {
      const parts = [];
      i++;
      while (i < lines.length && (/^\s+/.test(lines[i]) || lines[i].trim() === "")) {
        if (lines[i].trim()) parts.push(lines[i].replace(/^\s+/, ""));
        i++;
      }
      fm[key] = parts.join(" ").trim();
      continue;
    }
    if (val.startsWith("[") && val.endsWith("]")) {
      fm[key] = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      fm[key] = val.replace(/^["']|["']$/g, "").trim();
    }
    i++;
  }
  const verMatch = raw.match(/version:\s*["']?([\d.]+)/);
  if (verMatch) fm.version = verMatch[1];
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
  const inline = (s) => {
    let t = esc(s);
    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(
      /\[([^\]]+)\]\((https?:[^)]+)\)/g,
      '<a href="$2" rel="noopener">$1</a>'
    );
    return t;
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
      <div class="foot-mono">packages on github · install via AutoVault</div>
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

// --- load skills from repo tree ---
const deny = loadDenylist();
const sha = gitSha();
const shortSha = sha.slice(0, 7);
const publicSkills = [];
const errors = [];
const report = { public: 0, skipped: [], missingNarrative: [], missingSkillMd: [] };

if (!fs.existsSync(skillsDir)) {
  console.error("Missing skills/ directory — GitHub SSOT required");
  process.exit(1);
}

for (const name of fs.readdirSync(skillsDir).sort()) {
  const dir = path.join(skillsDir, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  if (deny.has(name)) {
    report.skipped.push(name);
    continue;
  }
  const skillPath = path.join(dir, "SKILL.md");
  const storyPath = path.join(dir, "story.md");
  if (!fs.existsSync(skillPath)) {
    report.missingSkillMd.push(name);
    if (strict) errors.push(`missing SKILL.md: ${name}`);
    continue;
  }
  const skillRaw = fs.readFileSync(skillPath, "utf8");
  const { fm: skillFm } = parseFrontmatter(skillRaw);
  let storyFm = {};
  let storyBody = "";
  if (fs.existsSync(storyPath)) {
    const storyRaw = fs.readFileSync(storyPath, "utf8");
    const parsed = parseFrontmatter(storyRaw);
    storyFm = parsed.fm;
    storyBody = parsed.body;
  }
  const visibility = storyFm.visibility || "public";
  if (visibility !== "public") {
    report.skipped.push(name);
    continue;
  }
  const summary =
    storyFm.summary ||
    (skillFm.description || "").replace(/\s+/g, " ").trim() ||
    name;
  const version = skillFm.version || storyFm.version_pin || "1.0.0";
  const provenance = storyFm.provenance || "house";
  const featured = storyFm.featured === true || storyFm.featured === "true";
  const bodyTrim = storyBody.trim();
  const hasNarrative =
    bodyTrim.length > 80 &&
    (/##\s+Why/i.test(storyBody) ||
      /##\s+History/i.test(storyBody) ||
      /##\s+How/i.test(storyBody) ||
      /##\s+Origin/i.test(storyBody));
  if (!hasNarrative) {
    report.missingNarrative.push(name);
    if (strict) errors.push(`public skill lacks story narrative: ${name}`);
  }

  const installId = `${REPO}@${sha}:skills/${name}/SKILL.md`;
  const cliInstall = `autovault add ${installId} --sync-profiles`;
  const mcpInstall = `add_skill({ source: "github", identifier: "${installId}" })`;
  const sourceUrl = `https://github.com/${REPO}/blob/${sha}/skills/${name}/SKILL.md`;

  publicSkills.push({
    name: skillFm.name || name,
    title: storyFm.title || skillFm.name || name,
    summary,
    category: storyFm.category || skillFm.category || "uncategorized",
    version,
    tags: storyFm.tags || skillFm.tags || [],
    agents: skillFm.agents || [],
    featured,
    provenance,
    related: storyFm.related || [],
    first_used: storyFm.first_used || "",
    bodyHtml: mdToHtml(storyBody || `## ${name}\n\n${summary}`),
    cliInstall,
    mcpInstall,
    sourceUrl,
    installId,
  });
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

// clean site except assets
fs.mkdirSync(siteDir, { recursive: true });
for (const ent of fs.readdirSync(siteDir, { withFileTypes: true })) {
  if (ent.name === "assets") continue;
  const p = path.join(siteDir, ent.name);
  if (ent.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
  else fs.unlinkSync(p);
}

// CSS
const cssSrc = path.join(__dirname, "site.css");
fs.mkdirSync(path.join(siteDir, "assets"), { recursive: true });
if (fs.existsSync(cssSrc)) {
  fs.writeFileSync(path.join(siteDir, "assets/site.css"), fs.readFileSync(cssSrc, "utf8"));
}

// skills.json
const skillsJson = {
  name: "skillissue",
  url: "https://skillissue.sh",
  description:
    "Jack Arturo's personal/agent skills collection — packages on GitHub, install via AutoVault.",
  updated: new Date().toISOString().slice(0, 10),
  installPin: sha,
  installPinShort: shortSha,
  repo: REPO,
  publicCount: publicSkills.length,
  install: {
    autovault: `autovault add ${REPO}@${sha}:skills/<name>/SKILL.md --sync-profiles`,
    bootstrap: "https://autovault.sh",
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
    cliInstall: s.cliInstall,
    mcpInstall: s.mcpInstall,
    sourceUrl: s.sourceUrl,
    url: `https://skillissue.sh/skills/${s.name}/`,
  })),
};
fs.writeFileSync(path.join(siteDir, "skills.json"), JSON.stringify(skillsJson, null, 2) + "\n");

// per-skill pages
for (const s of publicSkills) {
  const dir = path.join(siteDir, "skills", s.name);
  fs.mkdirSync(dir, { recursive: true });
  const related = (s.related || [])
    .filter((n) => publicSkills.some((p) => p.name === n))
    .map((n) => `<a class="tag" href="/skills/${esc(n)}/">${esc(n)}</a>`)
    .join(" ");
  const tags = (s.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  const body = `
    <section class="hero skill-hero">
      <div class="wrap">
        <div class="prompt"><span class="dot"></span> skill · v${esc(s.version)} · ${esc(s.provenance)} · pin ${esc(shortSha)}</div>
        <h1><span class="path">${esc(s.name)}</span></h1>
        <p class="lede">${esc(s.summary)}</p>
        <div class="meta" style="margin-bottom:1.25rem">${tags}
          <span class="badge">${esc(s.provenance)}</span>
          ${s.featured ? '<span class="badge">featured</span>' : ""}
        </div>
        <div class="cta-row">
          <button type="button" class="btn btn-primary" data-copy="${esc(s.cliInstall)}">Copy AutoVault install</button>
          <button type="button" class="btn btn-ghost" data-copy="${esc(s.mcpInstall)}">Copy MCP add_skill</button>
          <a class="btn btn-ghost" href="https://autovault.dev/quick-start" rel="noopener">Need AutoVault?</a>
        </div>
        <div class="term" style="max-width:48rem">
          <div class="term-bar"><i></i><i></i><i></i><span class="term-title">install · ${esc(shortSha)}</span></div>
          <div class="term-body">
            <div><span class="dim"># CLI (primary)</span></div>
            <div><span class="dim">$</span> <span class="cmd">${esc(s.cliInstall)}</span></div>
            <div style="margin-top:0.6rem"><span class="dim"># MCP tool call</span></div>
            <div class="cmd" style="word-break:break-all">${esc(s.mcpInstall)}</div>
            <div class="ok" style="margin-top:0.6rem">→ vault validates · signs · syncs agent skill dirs</div>
            <div class="dim">source: <a href="${esc(s.sourceUrl)}" style="color:inherit">${esc(REPO)}</a></div>
          </div>
        </div>
      </div>
    </section>
    <section>
      <div class="wrap prose">
        ${s.bodyHtml}
        ${related ? `<h2>Related</h2><div class="meta">${related}</div>` : ""}
        <h2>Package</h2>
        <p class="muted">Version <code>${esc(s.version)}</code>
        · install pin <code>${esc(shortSha)}</code>
        · SSOT <code>skills/${esc(s.name)}/</code> on GitHub
        ${s.agents?.length ? ` · agents: ${esc((s.agents || []).join(", "))}` : ""}</p>
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

// catalog
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

fs.writeFileSync(
  path.join(siteDir, "skills/index.html"),
  shellLayout({
    title: "Skills — skillissue.sh",
    description: "Jack Arturo's public agent skills — packages on GitHub, install via AutoVault.",
    path: "/skills/",
    body: `
    <section class="hero" style="padding-bottom:1.5rem">
      <div class="wrap">
        <div class="prompt"><span class="dot"></span> ${publicSkills.length} public · pin ${esc(shortSha)}</div>
        <h1>Skills</h1>
        <p class="lede">Each page is a story plus a real <code>autovault add</code> for the package living in this repo.</p>
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
    </script>`,
    active: "skills",
  })
);

// home
const featured = publicSkills.filter((s) => s.featured).slice(0, 8);
const featCards = featured
  .map(
    (s) => `<a class="card featured" href="/skills/${esc(s.name)}/">
  <div class="card-top"><h3>${esc(s.name)}</h3><span class="badge">featured</span></div>
  <p>${esc(s.summary)}</p>
</a>`
  )
  .join("\n");

const sampleCli =
  publicSkills.find((s) => s.name === "cloudflare-ops")?.cliInstall ||
  publicSkills[0]?.cliInstall ||
  "";

fs.writeFileSync(
  path.join(siteDir, "index.html"),
  shellLayout({
    title: "skillissue.sh — agent skills that earn their keep",
    description:
      "Jack Arturo's personal/agent skills. Packages live on GitHub; install with AutoVault.",
    path: "/",
    body: `
    <section class="hero">
      <div class="wrap">
        <div class="prompt"><span class="dot"></span> live · ${publicSkills.length} public skills · pin ${esc(shortSha)}</div>
        <h1><span class="path">skillissue</span>.sh<span class="cursor" aria-hidden="true"></span></h1>
        <p class="lede">
          Jack Arturo’s personal/agent skills —
          the ones that <strong>earn their keep</strong>.
          Packages live in this GitHub repo. Install with AutoVault. Not a marketplace.
        </p>
        <div class="cta-row">
          <a class="btn btn-primary" href="/skills/">Browse skills</a>
          <a class="btn btn-ghost" href="/install/">Install with AutoVault</a>
          <a class="btn btn-ghost" href="/about/">The story</a>
        </div>
        <div class="term" aria-label="Example terminal session">
          <div class="term-bar"><i></i><i></i><i></i><span class="term-title">zsh · skillissue</span></div>
          <div class="term-body">
            <div><span class="dim">$</span> <span class="cmd">${esc(sampleCli)}</span></div>
            <div class="ok">✓ package from github · vault syncs claude-code · codex · cursor</div>
            <div class="amber"># if your agent still can't ship… skill issue</div>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><b>${publicSkills.length}</b><span>public skill pages</span></div>
          <div class="stat"><b>${featured.length}</b><span>featured</span></div>
          <div class="stat"><b>${esc(shortSha)}</b><span>install pin (this build)</span></div>
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
          <p class="muted">AutoVault holds the runtime vault on your machine. This repo holds the public packages. skillissue.sh is the shelf — stories plus <code>autovault add</code>.</p>
          <p><a href="/about/">Read the stack story →</a></p>
        </div>
        <div class="callout">
          <h3>$ whoami</h3>
          <p>Jack Arturo — Very Good Plugins, AutoHub, AutoMem, AutoVault. Personal tooling made public where useful.</p>
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
          msg.textContent=r.ok?(j.message||'Signed up.'):(j.error||'Signup failed — try again later.');
        }catch(_){msg.hidden=false;msg.textContent='Network error — try again later.'}
      });
    })();
    </script>`,
    active: "home",
  })
);

function storyPage(slug, fallbackTitle, fallbackMd, active) {
  const p = path.join(contentStory, `${slug}.md`);
  let title = fallbackTitle;
  let bodyMd = fallbackMd;
  if (fs.existsSync(p)) {
    const { fm, body } = parseFrontmatter(fs.readFileSync(p, "utf8"));
    title = fm.title || fallbackTitle;
    bodyMd = body;
  }
  const dir = path.join(siteDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "index.html"),
    shellLayout({
      title: `${title} — skillissue.sh`,
      description: title,
      path: `/${slug}/`,
      body: `<section class="hero" style="padding-bottom:1rem"><div class="wrap"><h1>${esc(title)}</h1></div></section>
    <section style="padding-top:0"><div class="wrap prose">${mdToHtml(bodyMd)}</div></section>`,
      active,
    })
  );
}

storyPage(
  "about",
  "About",
  `## The short version

skillissue.sh is the public shelf for skills Jack actually runs. **Packages live in this GitHub repo** under \`skills/\`. You install them with [AutoVault](https://autovault.dev). Memory for the agents lives in [AutoMem](https://automem.ai).

## The longer version

I build tools for agents the way I used to build WordPress plugins — ship something that survives real use, then package the pattern so the next agent doesn't re-learn it cold.

**Very Good Plugins** paid the bills. **AutoHub** became the agent runtime. **AutoMem** gave assistants durable memory. **AutoVault** is where skills get validated, signed, and synced across Claude Code, Codex, Cursor, and friends.

This site is not a registry and not a clone of autovault.dev. It's a shelf with install pins into the same git tree you can read on GitHub.
`,
  "about"
);

storyPage(
  "install",
  "Install",
  `## 1. Get AutoVault

If you don't have it yet:

\`\`\`
curl -fsSL https://autovault.sh | sh
\`\`\`

Or see [autovault.dev quick-start](https://autovault.dev/quick-start).

## 2. Add a skill from this repo

Every public skill page has a copy button. Pattern:

\`\`\`
autovault add jack-arturo/skillissue@<sha>:skills/<name>/SKILL.md --sync-profiles
\`\`\`

The \`@sha\` pin is this site's build commit so installs are reproducible. Packages are multi-file when needed (resources, bin scripts) — that's why we use GitHub source, not a lone SKILL.md URL.

## 3. What AutoVault does

1. Fetches the skill bundle at that commit  
2. Validates / signs into your local vault  
3. Syncs into agent skill directories (Claude Code, Codex, Cursor, …)

You do **not** need an AutoVault MCP server for day-to-day use after sync — the files land where the agent already looks.

## MCP form

\`\`\`
add_skill({ source: "github", identifier: "jack-arturo/skillissue@<sha>:skills/<name>/SKILL.md" })
\`\`\`
`,
  "install"
);

storyPage(
  "changelog",
  "Changelog",
  `## 0.3.0 — 2026-07-20

- GitHub SSOT: packages under \`skills/<name>/\` (SKILL.md + story.md)
- AutoVault install rows (CLI + MCP) pinned to build commit
- Email list: D1 LEAD_DB + Resend
- Removed typo-domain marketing copy

## 0.2.0 — 2026-07-20

- Catalog generator + 30 narratives

## 0.1.0 — 2026-07-19

- Initial hub on Cloudflare Pages
`,
  "home"
);

// llms + sitemap + robots + headers
const llms = `# skillissue.sh

> Jack Arturo's personal/agent skills. Packages on GitHub; install with AutoVault.

## Site
- Home: https://skillissue.sh/
- Catalog: https://skillissue.sh/skills/
- Machine catalog: https://skillissue.sh/skills.json
- Source packages: https://github.com/jack-arturo/skillissue/tree/main/skills
- Install pin (this build): ${sha}

## Install
\`\`\`
autovault add jack-arturo/skillissue@${sha}:skills/<name>/SKILL.md --sync-profiles
\`\`\`

## Public skills (${publicSkills.length})
${publicSkills.map((s) => `- ${s.name} (v${s.version}) — ${s.summary}`).join("\n")}
`;
fs.writeFileSync(path.join(siteDir, "llms.txt"), llms);

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
      .map((u) => `  <url><loc>https://skillissue.sh${u}</loc><changefreq>weekly</changefreq></url>`)
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
`
);

report.generatedAt = new Date().toISOString();
report.installPin = sha;
report.publicSkills = publicSkills.map((s) => s.name);
fs.mkdirSync(path.join(root, "catalog"), { recursive: true });
fs.writeFileSync(path.join(root, "catalog/report.json"), JSON.stringify(report, null, 2) + "\n");

console.log(
  `Built site: ${report.public} public from skills/ · pin ${shortSha}`
);
if (report.missingNarrative.length) {
  console.warn("Missing narrative:", report.missingNarrative.join(", "));
}
