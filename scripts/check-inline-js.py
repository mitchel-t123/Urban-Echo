#!/usr/bin/env python3
"""Syntax-check the inline <script> blocks of the HTML pages given on the command line.

Usage:  python3 scripts/check-inline-js.py docs/portal.html docs/admin.html

A syntax error in a page's inline script silently stops every event listener
on that page from attaching, so this runs in CI before the browser tests.
"""
import os
import re
import subprocess
import sys
import tempfile

# Same pattern as the check described in CLAUDE.md: skip external (src=) and JSON-LD blocks.
SCRIPT_RE = re.compile(r'<script(?:(?!src=|application/ld)[^>])*>(.*?)</script>', re.DOTALL)


def check(path):
    with open(path, encoding='utf-8') as fh:
        content = fh.read()
    scripts = SCRIPT_RE.findall(content)
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as tmp:
        tmp.write('\n'.join(scripts))
        tmp_path = tmp.name
    try:
        result = subprocess.run(['node', '--check', tmp_path], capture_output=True, text=True)
    finally:
        os.unlink(tmp_path)
    if result.returncode != 0:
        print('FAIL %s' % path)
        print(result.stderr)
        return False
    print('OK   %s (%d inline script block%s)' % (path, len(scripts), '' if len(scripts) == 1 else 's'))
    return True


def main(paths):
    if not paths:
        print(__doc__)
        return 2
    results = [check(p) for p in paths]
    return 0 if all(results) else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
