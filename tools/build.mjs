#!/usr/bin/env node
// Builds the site's pages from src/ — the way PHP includes would, but ahead of time, so GitHub
// Pages can keep serving plain files.
//
// What lives where:
//   src/layout.html          the page every page is: <head>, preloader, menu, footer, scripts
//   src/partials/*.html      the menu, the footer and the other shared pieces
//   src/sections/*.html      the sections of the home page, one file each
//   src/pages/<name>.html    one file per page, written to <name>.html at the site root
//   src/templates/moral.html the page of one Moral, written once per entry of morals/morals.json
//                            to morals/<slug>/index.html
// The built pages are committed next to everything else; the GitHub workflow
// .github/workflows/build.yml runs this on every push and commits whatever changed, so an edit
// in src/ alone is enough. Never edit a built page: the next build overwrites it.
//
// A page file:
//   ---
//   title_key: nav_team            page title and <html data-i18n-title>: translations.js key
//   description_key: meta_description
//   layout: legal                  optional: the accessibility/privacy variant (no Shabbat gate)
//   styles: partnerships.css       optional: stylesheets before rtl.css (comma-separated)
//   styles_after: legal.css        optional: stylesheets after rtl.css
//   nav: partnerships.html         optional: which menu item is marked current (default: itself)
//   hero_title: team_heading       optional: the page hero (partials/page-hero.html), put in the
//   hero_subtitle: …_subtitle        page with {{hero}}; both are translations.js keys
//   ---
//   <!-- @head -->      optional: a <head> of its own (else src/partials/head-meta.html)
//   <!-- @body_top -->  optional: before the menu
//   <!-- @main -->      the page's content
//   <!-- @after -->     optional: after the footer
//   <!-- @scripts -->   optional: after script.js
//
// In any source file:
//   {{> sections/team h=h1}}   the file src/sections/team.html here, with h set to "h1" inside it
//                              (a value with spaces goes in quotes: attrs='aria-hidden="true"')
//   {{> partials/x when=flag}} the include only where the page has set flag to something
//   {{name}}                   a value; {{name|h2}} falls back to "h2"
// Paths are written as from the site root; pages built into a subfolder get them rewritten.
//
// Usage:
//   node tools/build.mjs            writes the pages that changed
//   node tools/build.mjs --check    writes nothing, fails if a built page is out of date

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://moraltogether.com/';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const CHECK = process.argv.includes('--check');

const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// translations.js is a browser script declaring `const TRANSLATIONS`; run it and take the object.
const EN = new Function(`${read('translations.js')}; return TRANSLATIONS;`)().en;
const text = (key, where) => {
    if (EN[key] === undefined) throw new Error(`${where}: translations.js has no "${key}"`);
    return EN[key];
};
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const attr = (s) => decode(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// ── templating ──────────────────────────────────────────────────────────────────────────
// An empty value on a line of its own takes the line with it, so optional parts leave no gaps.
const EMPTY = '\u0000';

function render(source, vars, where, depth = 0) {
    if (depth > 20) throw new Error(`${where}: includes nested too deep`);
    return source
        .replace(/\{\{>\s*([\w/.-]+)((?:\s+\w+=(?:"[^"]*"|'[^']*'|[^\s}]+))*)\s*\}\}/g, (_, path, params) => {
            const scoped = { ...vars };
            for (const [, k, q2, q1, bare] of params.matchAll(/(\w+)=(?:"([^"]*)"|'([^']*)'|([^\s}]+))/g)) {
                scoped[k] = q2 ?? q1 ?? bare;
            }
            const file = join(SRC, path.endsWith('.html') ? path : `${path}.html`);
            if (!existsSync(file)) throw new Error(`${where}: no such include "${path}"`);
            if (scoped.when !== undefined && !vars[scoped.when]) return EMPTY;
            return render(readFileSync(file, 'utf8').replace(/\n$/, ''), scoped, path, depth + 1);
        })
        .replace(/\{\{(\w+)(?:\|([^}]*))?\}\}/g, (m, k, fallback) => {
            if (vars[k] !== undefined) return vars[k] === '' ? EMPTY : vars[k];
            if (fallback !== undefined) return fallback;
            throw new Error(`${where}: no value for ${m}`);
        });
}

const tidy = (html) => html
    .split('\n').filter((l) => !/^\s*\u0000\s*$/.test(l)).join('\n')
    .replace(/\u0000/g, '')
    .replace(/\n{3,}/g, '\n\n');

// "---\nkey: value\n---" at the top, then "<!-- @block -->" sections.
function parsePage(source, where) {
    const meta = {};
    let body = source;
    const fm = source.match(/^---\n([\s\S]*?)\n---\n/);
    if (fm) {
        body = source.slice(fm[0].length);
        for (const line of fm[1].split('\n')) {
            const m = line.match(/^(\w+):\s*(.*)$/);
            if (!m) throw new Error(`${where}: bad front-matter line "${line}"`);
            meta[m[1]] = m[2].trim();
        }
    }
    const blocks = {};
    const parts = body.split(/^<!-- @(\w+) -->\n/m);
    for (let i = 1; i < parts.length; i += 2) blocks[parts[i]] = parts[i + 1].replace(/\n+$/, '');
    if (!blocks.main) throw new Error(`${where}: no <!-- @main --> block`);
    return { meta, blocks };
}

const links = (list) => (list || '').split(',').map((s) => s.trim()).filter(Boolean)
    .map((href) => `    <link rel="stylesheet" href="${href}">`).join('\n');

// Paths in the sources are from the site root; a page two folders down needs ../../ before them.
const rebase = (html, prefix) => !prefix ? html : html.replace(
    /\b(href|src|data-src|data-poster|poster)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g,
    (_, a, url) => `${a}="${prefix}${url}"`);

// The menu item of the current page: marked for the eye and for screen readers.
const markCurrent = (html, href) => html.replace(
    new RegExp(`<a href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" class="nav-link"`, 'g'),
    `<a href="${href}" class="nav-link active" aria-current="page"`);

const layout = readFileSync(join(SRC, 'layout.html'), 'utf8');

// out: the file to write, relative to the site root; extra: values the page's blocks use.
function buildPage({ source, where, out, url, extra = {} }) {
    const { meta, blocks } = parsePage(source, where);
    const prefix = '../'.repeat(out.split('/').length - 1);
    const vars = { url, og_image: `${SITE}images/og-image.jpg`, ...extra };
    if (meta.title_key) {
        vars.title = `${attr(text(meta.title_key, where))} — MoralTogether`;
        vars.description = attr(text(meta.description_key || 'meta_description', where));
    }
    if (meta.hero_title) {
        const sub = meta.hero_subtitle
            ? `            <p class="page-hero__sub reveal" data-i18n="${meta.hero_subtitle}">${text(meta.hero_subtitle, where)}</p>`
            : '';
        vars.hero = render('{{> partials/page-hero}}', {
            hero_title_key: meta.hero_title,
            hero_title: text(meta.hero_title, where),
            hero_subtitle: sub,
        }, where);
    }
    const titleKey = meta.title_key || extra.title_key;
    const descKey = meta.description_key || extra.description_key || (titleKey && 'meta_description');
    const page = {
        ...vars,
        html_attrs: titleKey ? ` data-i18n-title="${titleKey}" data-i18n-description="${descKey}"` : '',
        head_early: render(`{{> partials/${meta.layout === 'legal' ? 'head-early-legal' : 'head-early'}}}`, vars, where),
        head: render(blocks.head ?? '{{> partials/head-meta}}', vars, where),
        styles: links(meta.styles),
        styles_after: links(meta.styles_after),
        body_top: render(blocks.body_top ?? '', vars, where),
        main: render(blocks.main, vars, where),
        after: render(blocks.after ?? '', vars, where),
        scripts: render(blocks.scripts ?? '', vars, where),
    };
    const html = tidy(render(layout, page, 'layout.html'));
    return rebase(markCurrent(html, meta.nav || out.split('/').pop()), prefix);
}

// ── the Moral pages ─────────────────────────────────────────────────────────────────────
const ICONS = { facebook: 'fab fa-facebook-f', youtube: 'fab fa-youtube' };
const LABELS = { facebook: 'Facebook', youtube: 'YouTube' };
const PAD = '                    ';

function moralValues(entry) {
    const where = `morals.json: ${entry.slug}`;
    const name = text(`${entry.key}_name`, where);
    const desc = EN[`${entry.key}_desc`];
    const logo = entry.logo.video
        ? `${PAD}<video class="moral-logo" loop muted playsinline preload="none">\n`
          + `${PAD}    <source data-src="${entry.logo.video}" data-poster="${entry.logo.poster}" type="video/mp4">\n`
          + `${PAD}</video>`
        : `${PAD}<img class="moral-logo" src="${entry.logo.image}" alt="">`;
    const buttons = (entry.links || []).map((l) => {
        if (!ICONS[l.type]) throw new Error(`${where}: unknown link type "${l.type}"`);
        return `${PAD}    <a href="${attr(l.url)}" target="_blank" rel="noopener" class="moral-link moral-link--${l.type}">`
            + `<i class="${ICONS[l.type]}" aria-hidden="true"></i><span>${LABELS[l.type]}</span></a>`;
    });
    return {
        key: entry.key,
        accent: entry.accent,
        name,
        title: `${attr(name)} — MoralTogether`,
        description: attr(desc || name),
        title_key: `${entry.key}_name`,
        description_key: desc ? `${entry.key}_desc` : `${entry.key}_name`,
        og_image: SITE + (entry.logo.poster || entry.logo.image),
        logo,
        desc: desc ? `${PAD}<p class="moral-desc" data-i18n="${entry.key}_desc">${desc}</p>` : '',
        links: buttons.length ? `${PAD}<div class="moral-links">\n${buttons.join('\n')}\n${PAD}</div>` : '',
    };
}

// ── build ───────────────────────────────────────────────────────────────────────────────
const jobs = [];

for (const file of readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html')).sort()) {
    jobs.push({
        source: readFileSync(join(SRC, 'pages', file), 'utf8'),
        where: `pages/${file}`,
        out: file,
        url: file === 'index.html' ? SITE : SITE + file,
    });
}

const moralTemplate = readFileSync(join(SRC, 'templates', 'moral.html'), 'utf8');
const slugs = new Set();
for (const entry of JSON.parse(read('morals/morals.json'))) {
    if (slugs.has(entry.slug)) throw new Error(`morals.json: duplicate slug "${entry.slug}"`);
    slugs.add(entry.slug);
    jobs.push({
        source: moralTemplate,
        where: `templates/moral.html (${entry.slug})`,
        out: `morals/${entry.slug}/index.html`,
        url: `${SITE}morals/${entry.slug}/`,
        extra: moralValues(entry),
    });
}

let written = 0, stale = 0;
for (const job of jobs) {
    const html = buildPage(job);
    const file = join(ROOT, job.out);
    if (existsSync(file) && readFileSync(file, 'utf8') === html) continue;
    if (CHECK) { console.error(`out of date: ${job.out}`); stale++; continue; }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    written++;
}

// A Moral removed from morals.json keeps its folder until someone deletes it; say so.
for (const d of readdirSync(join(ROOT, 'morals'), { withFileTypes: true })) {
    if (d.isDirectory() && !slugs.has(d.name)) console.warn(`not in morals.json, left as is: morals/${d.name}/`);
}

if (CHECK) {
    if (stale) { console.error(`${stale} page(s) out of date — run: node tools/build.mjs`); process.exit(1); }
    console.log(`${jobs.length} pages up to date`);
} else {
    console.log(`${jobs.length} pages, ${written} written`);
}
