// Fails when an internal href/src in _site/**/*.html doesn't resolve to a file in _site, or a
// file the deploy depends on is missing. `node scripts/check.mjs --test` runs the self-check.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REQUIRED = [".htaccess", "index.html", "404.html", "devlog/feed.xml"];

function findBroken(root) {
  const broken = [];
  for (const file of fs.readdirSync(root, { recursive: true })) {
    if (!file.endsWith(".html")) continue;
    const html = fs.readFileSync(path.join(root, file), "utf8");
    const base = "http://site/" + file.split(path.sep).join("/");
    for (const [, ref] of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
      if (!ref || ref.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(ref)) continue; // fragment, https:, mailto:
      const url = new URL(ref.replaceAll("&amp;", "&"), base);
      if (url.origin !== "http://site") continue; // protocol-relative //host
      let target = path.join(root, decodeURIComponent(url.pathname));
      if (url.pathname.endsWith("/")) target = path.join(target, "index.html");
      if (!fs.existsSync(target)) broken.push(`${file}: ${ref}`);
    }
  }
  return broken;
}

if (process.argv.includes("--test")) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-"));
  fs.mkdirSync(path.join(dir, "a"));
  fs.writeFileSync(path.join(dir, "a", "pic.png"), "");
  fs.writeFileSync(
    path.join(dir, "a", "index.html"),
    [
      '<a href="/a/">ok dir</a>',
      '<img src="pic.png">',
      '<a href="https://example.com/x">external</a>',
      '<a href="mailto:a@b.c">mail</a>',
      '<a href="#top">fragment</a>',
      '<link href="//cdn.example.com/x.css">',
      '<a href="/a/pic.png?v=1#x">query</a>',
      '<a href="/missing/">broken dir</a>',
      '<img src="gone.png">',
    ].join("\n"),
  );
  const page = path.join("a", "index.html");
  assert.deepEqual(findBroken(dir), [`${page}: /missing/`, `${page}: gone.png`]);
  console.log("check.mjs self-check passed");
} else {
  const missing = REQUIRED.filter((f) => !fs.existsSync(path.join("_site", f)));
  const broken = findBroken("_site");
  if (missing.length || broken.length) {
    if (missing.length) console.error(`Missing from _site: ${missing.join(", ")}`);
    if (broken.length) console.error(`Broken internal links:\n  ${broken.join("\n  ")}`);
    process.exit(1);
  }
  console.log("check: required files present, all internal links resolve");
}
