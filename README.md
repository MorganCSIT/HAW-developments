# BOI Phuket Rehab — Workspace

A static site that renders the project's markdown documents in a clean, shareable format. Source `.md` files live in `content/` and stay untouched — the renderer strips citation/entity markers at view time.

## File layout

```
.
├── index.html               # Site shell
├── manifest.json            # Registers docs in the sidebar
├── vercel.json              # Vercel config (markdown content-type)
├── .nojekyll                # Disables Jekyll on GitHub Pages
├── content/                 # Markdown documents (drop new .md files here)
│   ├── BOI Pitch rehab center.md
│   └── deep-research-report.md
└── assets/
    ├── style.css
    └── app.js
```

The public marketing pages are isolated under `landing/`:

- `landing/index.html` - landing page
- `landing/clients.html` - client interest page
- `landing/partners.html` - partner/supplier page
- `landing/assets/` - CSS and rendered page images
- `landing/source-images/` - original building image sets

## Add a new markdown document

1. Drop the `.md` file into `content/`.
2. Add an entry to `manifest.json` under the right section (or create a new section):

```json
{
  "slug": "my-new-doc",
  "title": "My New Doc",
  "file": "content/my-new-doc.md",
  "description": "Optional one-liner shown on the home cards."
}
```

3. Refresh. The doc shows up in the sidebar and on the home page, available at `#/doc/my-new-doc`.

## Add a non-markdown page

Use `href` instead of `file`. The link can point to a custom HTML page in this repo or to an external URL:

```json
{
  "slug": "dashboard",
  "title": "Live Dashboard",
  "href": "pages/dashboard.html"
}
```

## Run locally

The site uses `fetch()` to load markdown, which browsers block when opening `index.html` directly from the file system. Serve it instead:

```powershell
# Python (built into many Win installs)
python -m http.server 8000

# or Node
npx serve
```

Then visit `http://localhost:8000`.

## Deploy

### Vercel (easiest)

1. Push this folder to GitHub.
2. On vercel.com → **Add New Project** → import the repo.
3. Framework: **Other** (no build command, no output dir).
4. Deploy. You get a URL like `your-project.vercel.app`.

Or from the CLI:

```powershell
npm i -g vercel
vercel
```

### GitHub Pages

1. Push this folder to a GitHub repo.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`. Save.
4. Wait ~1 min, your site is at `https://<username>.github.io/<repo>/`.

The `.nojekyll` file is already there so GitHub serves your assets folder correctly.

## How the markdown cleaning works

The source `.md` files contain Claude/ChatGPT-style citation markers (`citeturn39view0`, `entity["city","Phuket","..."]`, `urlBOI Investment Promotion Guide 2025turn5search2`). These are stripped purely at render time in [`assets/app.js`](assets/app.js) — the files on disk are never modified. Edit the `cleanMarkdown()` function if you want different behavior.

## Customize

- **Site title / subtitle / intro:** edit `manifest.json` → `site`.
- **Colors / typography:** edit CSS variables at the top of `assets/style.css`. Dark mode auto-follows the system preference.
- **Mermaid diagrams:** any `` ```mermaid `` code block renders as an SVG diagram automatically.
