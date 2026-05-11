// Workspace SPA: loads manifest.json, renders markdown docs from content/.
// Hash-based routing keeps it deployable on any static host with no rewrite rules.

const state = {
  manifest: null,
  currentSlug: null,
  tocObserver: null,
};

// ----- manifest -----

async function loadManifest() {
  const res = await fetch('manifest.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`manifest.json: HTTP ${res.status}`);
  return res.json();
}

function findItem(slug) {
  for (const section of state.manifest.sections || []) {
    for (const item of section.items || []) {
      if (item.slug === slug) return { ...item, sectionTitle: section.title };
    }
  }
  return null;
}

// ----- sidebar -----

function buildSidebar(manifest) {
  document.getElementById('brandTitle').textContent = manifest.site?.title || 'Workspace';
  document.getElementById('brandSubtitle').textContent = manifest.site?.subtitle || '';
  document.title = manifest.site?.title || 'Workspace';

  const nav = document.getElementById('nav');
  nav.innerHTML = '';

  for (const section of manifest.sections || []) {
    const sec = document.createElement('div');
    sec.className = 'nav-section';

    const heading = document.createElement('div');
    heading.className = 'nav-section-title';
    heading.textContent = section.title;
    sec.appendChild(heading);

    for (const item of section.items || []) {
      const link = document.createElement('a');
      link.className = 'nav-item';
      link.href = item.href || `#/doc/${encodeURIComponent(item.slug)}`;
      if (item.href && /^https?:/.test(item.href)) {
        link.target = '_blank';
        link.rel = 'noopener';
      }
      link.dataset.slug = item.slug || '';
      link.textContent = item.title;
      sec.appendChild(link);
    }
    nav.appendChild(sec);
  }
}

function setActiveNav(slug) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', !!slug && el.dataset.slug === slug);
  });
}

// ----- markdown cleaning -----

// Strip Claude/ChatGPT-style citation and entity markers so the content reads cleanly.
// The source .md files are NOT modified; this transform happens at render time only.
//
// The markers are wrapped in invisible Private Use Area chars:
//    <TYPE>  <arg1> [ <arg2> ...] 
// where TYPE is one of `cite`, `entity`, or `url`.
function cleanMarkdown(md) {
  md = md.replace(/([a-z]+)([\s\S]*?)/g, (_match, type, body) => {
    if (type === 'cite') return '';
    if (type === 'url') {
      // first segment is the visible name, remaining segments are turn-refs
      return body.split('')[0];
    }
    if (type === 'entity') {
      // body looks like  ["category","Display Name","Description"]
      const m = body.match(/"[^"]*"\s*,\s*"([^"]*)"/);
      return m ? m[1] : '';
    }
    return '';
  });
  // Defensive: drop any stray marker chars that escaped the structured pattern
  md = md.replace(/[-]/g, '');
  // Plain-text fallbacks (in case a copy-paste lost the PUA wrappers)
  md = md.replace(/\bcite(?:turn\d+(?:search|view)\d+)+/g, '');
  return md;
}

// ----- render -----

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function renderMarkdown(md) {
  marked.setOptions({ gfm: true, breaks: false });
  return marked.parse(cleanMarkdown(md));
}

// Replace ```mermaid code blocks with mermaid divs, add heading anchors,
// and return a flat heading list for the table of contents.
function processContent(container) {
  container.querySelectorAll('pre code.language-mermaid').forEach(code => {
    const div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = code.textContent;
    code.parentElement.replaceWith(div);
  });

  const headings = container.querySelectorAll('h2, h3, h4');
  const seen = new Set();
  const toc = [];
  headings.forEach(h => {
    let id = slugify(h.textContent) || 'section';
    let unique = id;
    let i = 2;
    while (seen.has(unique)) unique = `${id}-${i++}`;
    seen.add(unique);
    h.id = unique;

    const a = document.createElement('a');
    a.href = `#${unique}`;
    a.className = 'anchor';
    a.setAttribute('aria-label', 'Anchor link');
    a.textContent = '#';
    h.appendChild(a);

    toc.push({ id: unique, text: h.firstChild?.textContent?.trim() || h.textContent.replace(/#$/, '').trim(), level: parseInt(h.tagName[1], 10) });
  });

  if (window.mermaid) {
    try { mermaid.run({ querySelector: '.mermaid' }); } catch (e) { console.warn('mermaid render failed', e); }
  }

  return toc;
}

function buildToc(headings) {
  const toc = document.getElementById('toc');
  if (!headings.length) { toc.innerHTML = ''; return; }
  toc.innerHTML = `
    <p class="toc-title">On this page</p>
    <ul>
      ${headings.map(h => `<li class="lvl-${h.level}"><a href="#${h.id}" data-toc-target="${h.id}">${h.text}</a></li>`).join('')}
    </ul>
  `;
  setupTocHighlight(headings);
}

function setupTocHighlight(headings) {
  if (state.tocObserver) state.tocObserver.disconnect();
  if (!headings.length) return;

  const links = new Map();
  document.querySelectorAll('.toc a[data-toc-target]').forEach(a => {
    links.set(a.dataset.tocTarget, a);
  });

  state.tocObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const link = links.get(entry.target.id);
      if (!link) continue;
      if (entry.isIntersecting) {
        document.querySelectorAll('.toc a.active').forEach(a => a.classList.remove('active'));
        link.classList.add('active');
      }
    }
  }, { rootMargin: '-10% 0px -75% 0px' });

  headings.forEach(h => {
    const el = document.getElementById(h.id);
    if (el) state.tocObserver.observe(el);
  });
}

// ----- routes -----

async function renderDoc(slug) {
  state.currentSlug = slug;
  setActiveNav(slug);

  const item = findItem(slug);
  const content = document.getElementById('content');

  if (!item) {
    content.innerHTML = `<h1>Not found</h1><p class="muted">No doc registered for slug <code>${slug}</code>. Check <code>manifest.json</code>.</p>`;
    document.getElementById('toc').innerHTML = '';
    return;
  }

  content.innerHTML = `<p class="muted">Loading ${escapeHtml(item.title)}…</p>`;

  try {
    const res = await fetch(item.file, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    const html = renderMarkdown(md);

    content.innerHTML = `
      <header class="doc-header">
        <div class="doc-eyebrow">${escapeHtml(item.sectionTitle)}</div>
      </header>
      <div class="doc-body">${html}</div>
    `;

    const headings = processContent(content);
    buildToc(headings);
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (err) {
    content.innerHTML = `<h1>Couldn't load document</h1><p class="muted">${escapeHtml(item.file)} — ${escapeHtml(err.message)}</p><p class="muted">If you're opening this directly from the file system, the browser blocks <code>fetch()</code>. Run a local server: <code>python -m http.server</code> or <code>npx serve</code>.</p>`;
  }
}

function renderHome() {
  state.currentSlug = null;
  setActiveNav(null);

  const m = state.manifest;
  const sections = m.sections || [];

  document.getElementById('content').innerHTML = `
    <header class="doc-header">
      <div class="doc-eyebrow">Workspace</div>
      <h1>${escapeHtml(m.site?.title || 'Workspace')}</h1>
      ${m.site?.intro ? `<p class="home-intro">${escapeHtml(m.site.intro)}</p>` : ''}
    </header>
    ${sections.map(section => `
      <section class="home-section">
        <h2>${escapeHtml(section.title)}</h2>
        <div class="home-grid">
          ${(section.items || []).map(item => `
            <a class="card" href="${item.href || `#/doc/${encodeURIComponent(item.slug)}`}"${item.href && /^https?:/.test(item.href) ? ' target="_blank" rel="noopener"' : ''}>
              <div class="card-title">${escapeHtml(item.title)}</div>
              ${item.description ? `<p class="card-desc">${escapeHtml(item.description)}</p>` : ''}
            </a>
          `).join('')}
        </div>
      </section>
    `).join('')}
  `;
  document.getElementById('toc').innerHTML = '';
  if (state.tocObserver) { state.tocObserver.disconnect(); state.tocObserver = null; }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ----- routing -----

function route() {
  const hash = location.hash.slice(1) || '/';
  const docMatch = hash.match(/^\/doc\/(.+)$/);
  if (docMatch) {
    renderDoc(decodeURIComponent(docMatch[1]));
  } else {
    renderHome();
  }
  document.getElementById('sidebar').classList.remove('open');
}

// ----- init -----

async function init() {
  if (window.mermaid) {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    mermaid.initialize({
      startOnLoad: false,
      theme: dark ? 'dark' : 'default',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
    });
  }

  try {
    state.manifest = await loadManifest();
    buildSidebar(state.manifest);
    route();
  } catch (err) {
    document.getElementById('content').innerHTML = `<h1>Setup needed</h1><p class="muted">Could not load <code>manifest.json</code>: ${escapeHtml(err.message)}.</p><p class="muted">If you're opening this file directly, run a local server first: <code>python -m http.server</code> in this folder, then visit <code>http://localhost:8000</code>.</p>`;
  }

  window.addEventListener('hashchange', route);
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

init();
