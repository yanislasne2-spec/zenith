#!/usr/bin/env python3
"""Assemble index.html + CSS + JS + données en un seul fichier HTML autonome.
   dist/zenith.html          : page complète, à héberger n'importe où
   dist/zenith-artifact.html : même contenu sans <html>/<head>/<body> (publication Claude)"""
import re, pathlib
root = pathlib.Path(__file__).parent
html = (root / "index.html").read_text(encoding="utf-8")
html = html.replace('<link rel="stylesheet" href="style.css">',
                    "<style>\n" + (root / "style.css").read_text(encoding="utf-8") + "\n</style>")
def inline(m):
    return "<script>\n" + (root / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script") + "\n</script>"
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
out = root / "dist"; out.mkdir(exist_ok=True)
(out / "zenith.html").write_text(html, encoding="utf-8")
art = re.sub(r"<!DOCTYPE html>\s*<html[^>]*>\s*<head>\s*", "", html)
art = re.sub(r'<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*', "", art)
art = art.replace("</head>\n<body>\n", "\n").replace("</body>\n</html>\n", "")
(out / "zenith-artifact.html").write_text(art, encoding="utf-8")
print("ok", len(html) // 1024, "Ko")
