# Urban Echo — Claude Code Notes

## Deployment

The site is a **GitHub Pages static site** served from the `main` branch, `docs/` folder.

**Changes only go live when merged to `main`.** After pushing to a feature branch, always merge to `main` and push:

```bash
git checkout main
git merge <feature-branch>
git push origin main
```

Never report a fix as complete until it is on `main`.

## Site structure

- All HTML/CSS/JS lives in `docs/`
- Primary file: `docs/index.html` (single large file — all styles and scripts inline)
- Other pages: `docs/enquire.html`, `docs/problems.html`, `docs/login.html`

## JavaScript

All interactive JS is inline in each page's `<script>` blocks. A syntax error or uncaught top-level exception in a block will silently prevent all event listeners from attaching. After any JS change, syntax-check every page:

```bash
python3 scripts/check-inline-js.py docs/*.html docs/*/index.html
```

Elements a script grabs at load time with `getElementById(...)` must sit **above** that `<script>` in the page, or the lookup returns null and the rest of the script never runs.

## Checks (CI runs the same)

```bash
python3 -m http.server 9876 --directory docs &
node scripts/portal-smoke.js        # portal buttons open their modals
node scripts/portal-flow-smoke.js   # Onboarding Flow view
node scripts/admin-smoke.js         # Team Admin page
bash scripts/test-edge-functions.sh # type-checks and tests supabase/functions under Deno
```

## Supabase edge functions

`supabase/functions/*` are **not** deployed by GitHub Pages. Pushing to `main` does not change what is live there; the owner deploys them from the Supabase dashboard. Keep each function a single self-contained file (so it can be pasted into the dashboard editor) with pinned import versions.
