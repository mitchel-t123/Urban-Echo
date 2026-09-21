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

All interactive JS is inline at the bottom of `docs/index.html` in one `<script>` block. A syntax error or uncaught top-level exception in that block will silently prevent all event listeners from attaching. After any JS change, extract and syntax-check before committing:

```bash
python3 -c "
import re
with open('docs/index.html') as f: content = f.read()
scripts = re.findall(r'<script(?:(?!src=|application/ld)[^>])*>(.*?)</script>', content, re.DOTALL)
open('/tmp/check.js','w').write('\n'.join(scripts))
" && node --check /tmp/check.js && echo "JS OK"
```
