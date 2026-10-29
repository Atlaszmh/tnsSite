# Tooth and Scale Studio Site Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-written placeholder page with the Night Arcade studio site (home, devlog, press hub) as an Eleventy 3 build that deploys over FTP.

**Architecture:** An Eleventy 3 static site. All studio and game facts live in `_data/site.json` and `_data/games.json`, and every optional section renders only when its data is non-empty. Two dependency-free Node scripts run after the build: `scripts/zip.mjs` makes the press-image zips, and `scripts/check.mjs` fails on broken internal links. Each has its own `--test` self-check. Press thumbnails are made with `sharp` in an `eleventy.before` hook.

**Tech Stack:** Eleventy 3.1, `@11ty/eleventy-plugin-rss` 3.1, `sharp` 0.35, Nunjucks, plain CSS, Node ≥ 22.2, GitHub Actions with SamKirkland/FTP-Deploy-Action, and ffmpeg (local only, for preparing assets).

**Spec:** `docs/superpowers/specs/2026-10-29-studio-site-design.md`. Read it first.

**One deliberate deviation from the spec:** thumbnails use `sharp` directly (the spec's own fallback path) instead of `@11ty/eleventy-img`. That gives one code path with nearest-neighbour support and one dependency fewer. Thumbnails keep their source file name (`alloy-01.webp`) instead of a hash, since the build starts from an empty `_site/`.

**Environment notes (Windows host):**
- Run commands from `C:\Projects\toothandscale-site` in Git Bash.
- `ffmpeg` is on PATH. `zip` is **not** (that's why `zip.mjs` exists).
- Node is v24 locally.
- For visual checks, use the Playwright MCP tools. Screenshots must be saved under `c:\Projects\` (for example `c:\Projects\.playwright-mcp\`), because other paths are refused.

---

## File map

| File | Responsibility |
|---|---|
| `package.json` | deps, `engines`, scripts (`build`, `serve`, `check`, `test`) |
| `.gitignore` | `_site/`, `node_modules/`, `.superpowers/` |
| `.htaccess` | `DirectoryIndex index.html`, `ErrorDocument 404 /404.html` |
| `eleventy.config.js` | ignores, passthrough, data validation, filters, global data, thumbnails |
| `scripts/images.mjs` | `listImages(dir)`, shared by the build and the zip script so pages and zips list the same files |
| `scripts/zip.mjs` | stored-zip writer for the press images, plus `--test` |
| `scripts/check.mjs` | internal link checker and required-file check, plus `--test` |
| `_data/site.json` | studio facts, channels, channel display names |
| `_data/games.json` | one entry per game |
| `_includes/base.njk` | `<head>`, meta and OG tags, nav, footer |
| `_includes/nav.njk`, `_includes/footer.njk` | site chrome |
| `_includes/game-buttons.njk` | Play / Wishlist / Site / Press kit for game `g` |
| `_includes/post-card.njk` | devlog card for `post` |
| `_includes/post.njk` | devlog post layout |
| `index.njk` | home |
| `pages/devlog.njk`, `pages/feed.njk`, `pages/press.njk`, `pages/press-game.njk`, `pages/404.njk` | the other pages |
| `devlog/devlog.11tydata.json` | `layout: post.njk` for every post folder |
| `css/site.css` | the whole design system |
| `img/` | favicon, og image, hero and tile art per game |
| `press/<slug>/images/`, `press/<slug>/<slug>-teaser.mp4`, `press/studio/` | press assets |
| `.github/workflows/deploy.yml` | test → build → check → FTP |
| `CLAUDE.md` | how to work in this repo, especially devlog posts |

---

## Chunk 1: Foundation (scripts, data, config)

### Task 1: Scaffold the npm project and remove the placeholder page

**Files:**
- Create: `package.json`
- Modify: `.gitignore`
- Delete: `index.html`, `img/alloy.webp`, `img/campers.webp`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "toothandscale-site",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.2" },
  "scripts": {
    "build": "node -e \"require('fs').rmSync('_site',{recursive:true,force:true})\" && eleventy && npm run zip",
    "zip": "node scripts/zip.mjs",
    "serve": "eleventy --serve",
    "check": "node scripts/check.mjs",
    "test": "node scripts/zip.mjs --test && node scripts/check.mjs --test"
  }
}
```

(`node -e` runs as CommonJS, so `require` works there even though the package is `"type": "module"`.)

- [ ] **Step 2: Install dependencies**

Run: `npm install -D @11ty/eleventy@^3.1.7 @11ty/eleventy-plugin-rss@^3.1.0 sharp@^0.35.5`
Expected: `package-lock.json` is created, with no errors (sharp ships prebuilt win32-x64 and linux-x64 binaries).

- [ ] **Step 3: Replace `.gitignore`**

```
.superpowers/
_site/
node_modules/
```

- [ ] **Step 4: Delete the placeholder files**

Run: `git rm -q index.html img/alloy.webp img/campers.webp`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "Scaffold Eleventy project, remove placeholder page"
```

### Task 2: `scripts/images.mjs` and `scripts/zip.mjs` (TDD)

**Files:**
- Create: `scripts/images.mjs`, `scripts/zip.mjs`

- [ ] **Step 1: Write `scripts/images.mjs`**

```js
import fs from "node:fs";

// Image files directly inside dir, sorted; [] when dir is missing. Shared by the build and zip.mjs
// so the press pages and the zips always list the same files.
export const listImages = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp|svg)$/i.test(f)).sort() : [];
```

- [ ] **Step 2: Write `scripts/zip.mjs` with the self-check first and a stub `zip()`**

```js
// Writes _site/press/<slug>/<slug>-images.zip for each game with press images.
// Stored (uncompressed) entries, since PNGs are already compressed. Needs Node >= 22.2 for zlib.crc32.
// `node scripts/zip.mjs --test` checks the writer against its own reader.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { listImages } from "./images.mjs";

function zip(files, out) {
  throw new Error("not implemented");
}

// Reads the central directory back: [{ name, size, crcOk, text }]. Used only by --test.
function readZip(file) {
  const buf = fs.readFileSync(file);
  const end = buf.length - 22;
  assert.equal(buf.readUInt32LE(end), 0x06054b50, "end of central directory record");
  const entries = [];
  let p = buf.readUInt32LE(end + 16);
  for (let i = 0; i < buf.readUInt16LE(end + 10); i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, "central directory header");
    const nameLen = buf.readUInt16LE(p + 28);
    const size = buf.readUInt32LE(p + 24);
    const local = buf.readUInt32LE(p + 42);
    assert.equal(buf.readUInt32LE(local), 0x04034b50, "local file header");
    const start = local + 30 + buf.readUInt16LE(local + 26);
    const data = buf.subarray(start, start + size);
    entries.push({
      name: buf.toString("utf8", p + 46, p + 46 + nameLen),
      size,
      crcOk: zlib.crc32(data) === buf.readUInt32LE(p + 16),
      text: data.toString(),
    });
    p += 46 + nameLen;
  }
  return entries;
}

if (process.argv.includes("--test")) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "zip-")), "t.zip");
  zip([{ name: "a.txt", data: Buffer.from("hello") }, { name: "b.txt", data: Buffer.from("world!") }], out);
  assert.deepEqual(readZip(out), [
    { name: "a.txt", size: 5, crcOk: true, text: "hello" },
    { name: "b.txt", size: 6, crcOk: true, text: "world!" },
  ]);
  console.log("zip.mjs self-check passed");
} else {
  const games = JSON.parse(fs.readFileSync("_data/games.json", "utf8"));
  for (const { slug } of games) {
    const dir = path.join("press", slug, "images");
    const names = listImages(dir);
    if (!names.length) continue;
    const out = path.join("_site", "press", slug, `${slug}-images.zip`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    zip(names.map((name) => ({ name, data: fs.readFileSync(path.join(dir, name)) })), out);
    console.log(`zip: ${out} (${names.length} images)`);
  }
}
```

- [ ] **Step 3: Run the self-check to verify it fails**

Run: `node scripts/zip.mjs --test`
Expected: FAIL with `Error: not implemented`

- [ ] **Step 4: Implement `zip()`**

Replace the stub with:

```js
function zip(files, out) {
  const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01, the earliest valid DOS date
  const local = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name);
    const crc = zlib.crc32(data);
    const h = Buffer.alloc(30); // local file header; method 0 = stored, flags 0, time 00:00
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(DOS_DATE, 12);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(data.length, 18);
    h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(nameBuf.length, 26);
    local.push(h, nameBuf, data);
    const c = Buffer.alloc(46); // central directory header
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(DOS_DATE, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22); // end of central directory
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  fs.writeFileSync(out, Buffer.concat([...local, dir, end]));
}
```

- [ ] **Step 5: Run the self-check to verify it passes**

Run: `node scripts/zip.mjs --test`
Expected: `zip.mjs self-check passed`

(Opening a real zip in a real extractor happens in Task 9, Step 6, once there are press images.)

- [ ] **Step 6: Commit**

```bash
git add scripts/images.mjs scripts/zip.mjs
git commit -m "Add dependency-free press zip writer with self-check"
```

### Task 3: `scripts/check.mjs` (TDD)

**Files:**
- Create: `scripts/check.mjs`

- [ ] **Step 1: Write the script with its self-check and a stub `findBroken()`**

```js
// Fails when an internal href/src in _site/**/*.html doesn't resolve to a file in _site, or a
// file the deploy depends on is missing. `node scripts/check.mjs --test` runs the self-check.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REQUIRED = [".htaccess", "index.html", "404.html", "devlog/feed.xml"];

function findBroken(root) {
  return [];
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
```

- [ ] **Step 2: Run the self-check to verify it fails**

Run: `node scripts/check.mjs --test`
Expected: FAIL with an `AssertionError` (actual `[]`, expected two broken entries)

- [ ] **Step 3: Implement `findBroken()`**

```js
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
```

- [ ] **Step 4: Run both self-checks to verify they pass**

Run: `npm test`
Expected: `zip.mjs self-check passed` then `check.mjs self-check passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/check.mjs
git commit -m "Add internal link checker with self-check"
```

### Task 4: Data files and art

**Files:**
- Create: `_data/site.json`, `_data/games.json`, `img/alloy-hero.webp`, `img/alloy-tile.webp`, `img/campers-hero.webp`, `img/campers-tile.webp`, `img/favicon.svg`

- [ ] **Step 1: Write `_data/site.json`**

```json
{
  "name": "Tooth and Scale",
  "url": "https://toothandscale.com",
  "tagline": "We make games where systems collide and things go loudly wrong.",
  "about": "Tooth and Scale is an independent game studio. Right now it is one person, a stack of design docs, and a few test bots that play the games around the clock so the balance holds up before real players arrive. We like systems that combine in ways nobody planned, and failures that are funny instead of punishing.",
  "description": {
    "short": "Tooth and Scale is an independent game studio making Alloy: Delvesmith and Unhappy Campers.",
    "long": "Tooth and Scale is a one-person independent game studio. Its first two games are Alloy: Delvesmith, a pixel-art action RPG where every pair of elements reacts, and Unhappy Campers, a co-op camping trip that goes wrong in three acts. Both are in development."
  },
  "history": "",
  "basedIn": "",
  "pressEmail": "",
  "channels": { "discord": "", "steam": "", "bluesky": "", "x": "", "tiktok": "", "youtube": "", "newsletter": "" },
  "channelNames": { "discord": "Discord", "steam": "Steam", "bluesky": "Bluesky", "x": "X", "tiktok": "TikTok", "youtube": "YouTube", "newsletter": "Newsletter" }
}
```

- [ ] **Step 2: Write `_data/games.json`**

Copy is from Alloy's `marketing/2026-10-17-fun-30s-social/copy.md` and the Unhappy Campers GDD's "Pitch and pillars". Don't invent facts beyond these.

```json
[
  {
    "slug": "alloy",
    "name": "Alloy: Delvesmith",
    "hook": "Every element reacts.",
    "pitch": "A top-down pixel-art action RPG. Each hero binds two of six elements, and every pair reacts both ways: fire on nature sets off Combust, frost then earth Shatters. You build your moves at the Anvil as chains of up to five, each with its own form, elements and rune sockets.",
    "status": "Playtest",
    "platforms": ["Web browser"],
    "pixelArt": true,
    "art": {
      "hero": "/img/alloy-hero.webp",
      "tile": "/img/alloy-tile.webp",
      "alt": "A pixel-art hero swings a greatsword at a hulking foreman in a mine lit by molten cracks."
    },
    "links": { "play": "https://alloy.toothandscale.com/", "wishlist": "", "site": "" },
    "press": {
      "release": "",
      "price": "",
      "description": "Alloy: Delvesmith is a top-down pixel-art action RPG built by one developer. Each hero binds two of six elements, and every pair of elements reacts, both ways. Moves are items you build at the Anvil: chains of up to five, each with its own form, elements and rune sockets. It is in development and playable in the browser during playtesting.",
      "features": [
        "Six elements, and every pair reacts both ways: fire on nature sets off Combust, frost then earth Shatters.",
        "Build your own moves at the Anvil: chains of up to five, each with its own form, elements and rune sockets.",
        "Bosses with scripted phases and break gauges.",
        "Playable now in the browser while in playtest."
      ],
      "history": "",
      "video": "/press/alloy/alloy-teaser.mp4",
      "quotes": [],
      "credits": []
    }
  },
  {
    "slug": "unhappy-campers",
    "name": "Unhappy Campers",
    "hook": "You forgot the tent stakes. The raccoons did not forget your truck keys.",
    "pitch": "A 2–4 player physics co-op camping trip that goes wrong in three acts. Pack late, camp badly, then hike out in the dark after the raccoons take the truck. One run takes about an hour.",
    "status": "In development",
    "platforms": ["PC"],
    "pixelArt": false,
    "art": {
      "hero": "/img/campers-hero.webp",
      "tile": "/img/campers-tile.webp",
      "alt": "A small campfire in a clearing ringed by redwoods and autumn trees."
    },
    "links": { "play": "", "wishlist": "", "site": "" },
    "press": {
      "release": "",
      "price": "",
      "description": "Unhappy Campers is a co-op camping trip for 2–4 players (up to 6 in clown-car lobbies) that goes wrong in three acts: you pack late, you camp badly, and then raccoons steal your truck and you hike out in the dark. Required gear, poisonous berries and the rules of the night change every run, so players learn by eating, guessing and arguing.",
      "features": [
        "Three acts in one run: a packing scramble at home, a day making camp, and a night hike out after the raccoons take the truck.",
        "Nature is petty, then dangerous: squirrels and raccoons steal by day, bears are real danger, and cryptids own the night.",
        "The rules change every run: required items, poisonous berries and cryptid rules are randomized.",
        "Everything you do earlier pays off later: what you pack feeds camp, and camp feeds the escape.",
        "A full run fits in about an hour, and a failed run should be funny, not a waste of time."
      ],
      "history": "",
      "video": "",
      "quotes": [],
      "credits": []
    }
  }
]
```

- [ ] **Step 3: Cut the hero and tile art with ffmpeg**

Run (Git Bash):
```bash
A=/c/Projects/Alloy/marketing/2026-10-17-fun-30s-social
C="/c/Projects/Camping Slop/LookSheets/2026-10-27_022639"
ffmpeg -loglevel error -y -i "$A/stills/2.png" -quality 82 img/alloy-hero.webp
ffmpeg -loglevel error -y -i "$A/stills/1.png" -vf "crop=1280:720:560:180,scale=960:540:flags=neighbor" -quality 82 img/alloy-tile.webp
ffmpeg -loglevel error -y -i "$C/camp_Golden.png" -quality 80 img/campers-hero.webp
ffmpeg -loglevel error -y -i "$C/camp_Night_lit.png" -vf "scale=960:540" -quality 80 img/campers-tile.webp
ls -la img
```
Expected: four new `.webp` files, each under 400 KB, next to `og.jpg`.

- [ ] **Step 4: Write `img/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0d0f14"/><path d="M7 9h18l-3 7-3-4-3 9-3-9-3 4z" fill="#ff6b3d"/></svg>
```

- [ ] **Step 5: Commit**

```bash
git add _data img
git commit -m "Add studio and game data, hero and tile art, favicon"
```

### Task 5: `eleventy.config.js` with data validation

**Files:**
- Create: `eleventy.config.js`, `devlog/devlog.11tydata.json`
- Modify: `.htaccess`

- [ ] **Step 1: Write `.htaccess`**

```
# Static site: serve index.html, not the old WordPress index.php
DirectoryIndex index.html
ErrorDocument 404 /404.html
```

- [ ] **Step 2: Write `devlog/devlog.11tydata.json`**

```json
{ "layout": "post.njk" }
```

- [ ] **Step 3: Write `eleventy.config.js`**

```js
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { rssPlugin } from "@11ty/eleventy-plugin-rss";
import { listImages } from "./scripts/images.mjs";

const games = JSON.parse(fs.readFileSync("_data/games.json", "utf8"));
const get = (obj, key) => key.split(".").reduce((o, k) => o?.[k], obj);

const GAME_FIELDS = ["slug", "name", "hook", "pitch", "status", "art.hero", "art.tile"];
for (const g of games) {
  const missing = GAME_FIELDS.filter((f) => !get(g, f));
  if (missing.length) throw new Error(`_data/games.json: "${g.slug ?? g.name ?? "?"}" is missing ${missing.join(", ")}`);
}
const slugs = new Set(games.map((g) => g.slug));
const POST_FIELDS = ["title", "game", "summary", "cover"]; // date is checked against the folder name below

const thumbName = (file) => file.replace(/\.\w+$/, ".webp");

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(rssPlugin);

  for (const p of ["docs/**", "README.md", "CLAUDE.md", ".superpowers/**"]) eleventyConfig.ignores.add(p);
  for (const p of [".htaccess", "img", "css", "press/**/*.{png,jpg,webp,svg,mp4}", "devlog/**/*.{png,jpg,gif,webp,mp4}"]) {
    eleventyConfig.addPassthroughCopy(p);
  }

  // Newest first. Validates every post's frontmatter after it is parsed.
  eleventyConfig.addCollection("posts", (api) => {
    const posts = api.getFilteredByGlob("devlog/*/index.md");
    for (const p of posts) {
      const missing = POST_FIELDS.filter((f) => !p.data[f]);
      if (missing.length) throw new Error(`${p.inputPath}: missing frontmatter ${missing.join(", ")}`);
      if (p.data.game !== "studio" && !slugs.has(p.data.game)) {
        throw new Error(`${p.inputPath}: game "${p.data.game}" is not a slug in games.json or "studio"`);
      }
      // `date` always has a value (Eleventy falls back to the file's date, which on CI is checkout
      // time), so require it to match the folder's YYYY-MM-DD prefix instead.
      const folderDate = p.inputPath.match(/devlog\/(\d{4}-\d{2}-\d{2})-/)?.[1];
      if (folderDate !== p.date.toISOString().slice(0, 10)) {
        throw new Error(`${p.inputPath}: frontmatter date must be set and match the folder prefix (${folderDate ?? "none"})`);
      }
    }
    return posts.reverse();
  });

  eleventyConfig.addFilter("gameBySlug", (slug) => games.find((g) => g.slug === slug));
  eleventyConfig.addFilter("pluck", (arr, key) => arr.map((o) => get(o, key)));
  eleventyConfig.addFilter("head", (arr, n) => arr.slice(0, n));
  eleventyConfig.addFilter("compactEntries", (obj) => Object.entries(obj ?? {}).filter(([, v]) => v));
  eleventyConfig.addFilter("displayDate", (d) =>
    d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }),
  );
  eleventyConfig.addFilter("isoDate", (d) => d.toISOString().slice(0, 10));
  eleventyConfig.addFilter("youtubeEmbed", (url) => {
    const id = url?.match(/(?:youtu\.be\/|[?&]v=|embed\/)([\w-]{11})/)?.[1];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
  });
  eleventyConfig.addFilter("thumbUrl", (file, slug) => `/press/${slug}/thumbs/${thumbName(file)}`);

  eleventyConfig.addGlobalData("year", new Date().getUTCFullYear());
  eleventyConfig.addGlobalData("now", new Date());
  eleventyConfig.addGlobalData("pressImages", Object.fromEntries(games.map((g) => [g.slug, listImages(`press/${g.slug}/images`)])));
  eleventyConfig.addGlobalData(
    "pressLogos",
    Object.fromEntries(games.map((g) => [g.slug, listImages(`press/${g.slug}`).find((f) => f.startsWith("logo."))])),
  );
  eleventyConfig.addGlobalData("studioLogos", listImages("press/studio"));

  // Press thumbnails: 640px WebP, nearest-neighbour for pixel art so it stays crisp.
  eleventyConfig.on("eleventy.before", async () => {
    for (const g of games) {
      for (const file of listImages(`press/${g.slug}/images`)) {
        const out = path.join("_site", "press", g.slug, "thumbs", thumbName(file));
        if (fs.existsSync(out)) continue;
        fs.mkdirSync(path.dirname(out), { recursive: true });
        await sharp(path.join("press", g.slug, "images", file))
          .resize({ width: 640, kernel: g.pixelArt ? "nearest" : "lanczos3" })
          .webp({ quality: 80 })
          .toFile(out);
      }
    }
  });
}

export const config = {
  dir: { input: ".", includes: "_includes", data: "_data", output: "_site" },
  markdownTemplateEngine: false, // posts are literal Markdown; {{ }} in a post is just text
  htmlTemplateEngine: "njk",
};
```

- [ ] **Step 4: Verify the game validation fails loudly**

Temporarily blank Alloy's `"hook"` in `_data/games.json`, then run: `npx @11ty/eleventy --dryrun`
Expected: FAIL, with output containing `"alloy" is missing hook`.
Restore the hook with `git checkout _data/games.json`, then confirm it's clean with `git diff --stat _data` (no output).

- [ ] **Step 5: Verify the build runs with no templates yet**

Run: `npm run build`
Expected: no errors; `zip:` prints nothing (no press images yet). `ls -a _site` shows `.htaccess` and `img`.
If `.htaccess` is **not** in `_site`, change its passthrough entry to `eleventyConfig.addPassthroughCopy({ ".htaccess": ".htaccess" })` and re-run.

- [ ] **Step 6: Commit**

```bash
git add eleventy.config.js devlog/devlog.11tydata.json .htaccess
git commit -m "Add Eleventy config: passthrough, validation, filters, press thumbnails"
```

---

## Chunk 2: Design system, layout and home

### Task 6: CSS, base layout, nav, footer, 404

**Files:**
- Create: `css/site.css`, `_includes/base.njk`, `_includes/nav.njk`, `_includes/footer.njk`, `_includes/game-buttons.njk`, `pages/404.njk`

- [ ] **Step 1: Write `css/site.css`**

```css
:root {
  --bg: #0d0f14;
  --surface: #15181f;
  --line: #2a303b;
  --text: #f1ead8;
  --muted: #b9b4a6;
  --accent: #ff6b3d;
  --gold: #ffcf5a;
  --display: "Bricolage Grotesque", system-ui, sans-serif;
  --body: "Familjen Grotesk", system-ui, sans-serif;
  --pixel: "Silkscreen", ui-monospace, monospace;
  --gutter: clamp(16px, 4vw, 40px);
  color-scheme: dark;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--bg); color: var(--text); font: 400 1.0625rem/1.6 var(--body); overflow-x: clip; }
img, video { display: block; max-width: 100%; height: auto; }
a { color: inherit; }
:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
.wrap { max-width: 1200px; margin: 0 auto; padding-left: var(--gutter); padding-right: var(--gutter); }
.pixel img, img.pixel, .tile.pixel { image-rendering: pixelated; }

.kicker, .chip { font: 400 .75rem/1.4 var(--pixel); color: var(--gold); letter-spacing: .06em; text-transform: uppercase; }
.kicker { margin: 0 0 .5rem; }
.kicker a { color: inherit; }
.chip { display: inline-block; font-size: .65rem; }

/* Nav: links inline on desktop, a native popover menu on phones. */
.nav { display: flex; justify-content: space-between; align-items: center; gap: 16px; max-width: 1200px; margin: 0 auto; padding: 18px var(--gutter); }
.home .nav { position: absolute; top: 0; left: 0; right: 0; z-index: 10; }
.wordmark { font: 400 .95rem/1 var(--pixel); color: var(--gold); letter-spacing: .04em; text-decoration: none; }
.nav-toggle { display: none; font: 400 .75rem/1 var(--pixel); color: var(--text); background: none; border: 2px solid var(--text); padding: 8px 10px; cursor: pointer; }
#nav-menu { display: flex; gap: 28px; position: static; inset: auto; margin: 0; padding: 0; border: 0; background: none; color: inherit; overflow: visible; width: auto; height: auto; }
#nav-menu a, .footer a, .footer small { font: 400 .75rem/1 var(--pixel); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; text-decoration: none; }
#nav-menu a:hover, .footer a:hover { color: var(--accent); }

/* Buttons */
.buttons { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 22px; }
.btn { display: inline-block; padding: 12px 16px; font: 400 .75rem/1 var(--pixel); letter-spacing: .06em; text-transform: uppercase; text-decoration: none; background: var(--accent); color: var(--bg); border: 2px solid var(--accent); box-shadow: 4px 4px 0 var(--text); transition: transform .15s, box-shadow .15s; }
.btn:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 var(--text); }
.btn-alt { background: transparent; color: var(--text); border-color: var(--text); box-shadow: 4px 4px 0 var(--accent); }
.btn-alt:hover { box-shadow: 6px 6px 0 var(--accent); }

/* Hero */
.hero { position: relative; display: flex; align-items: flex-end; min-height: min(100svh, 860px); padding: 120px 0 48px; background: var(--bg) var(--hero) center / cover no-repeat; }
.hero::before { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, var(--bg) 20%, rgb(13 15 20 / .25) 75%), linear-gradient(0deg, var(--bg) 0%, rgb(13 15 20 / 0) 45%); }
.hero-inner { position: relative; width: 100%; }
.hero-title { margin: 0; font: 800 clamp(3.5rem, 12vw, 9rem)/.85 var(--display); letter-spacing: -.03em; text-transform: uppercase; }
.hero-title span { color: var(--accent); }
.hero-tagline { max-width: 32ch; margin: 1rem 0 2.5rem; color: var(--muted); font-size: 1.2rem; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
.tile { position: relative; isolation: isolate; display: flex; flex-direction: column; justify-content: flex-end; gap: 4px; aspect-ratio: 16 / 9; padding: 12px 14px; background: var(--surface) center / cover no-repeat; border: 2px solid var(--text); box-shadow: 5px 5px 0 var(--accent); text-decoration: none; transition: transform .15s, box-shadow .15s; }
.tile::before { content: ""; position: absolute; inset: 0; z-index: -1; background: linear-gradient(0deg, rgb(13 15 20 / .9), rgb(13 15 20 / 0) 60%); }
.tile:hover { transform: translate(-2px, -2px); box-shadow: 7px 7px 0 var(--accent); }
.tile-name { font: 800 1.25rem/1 var(--display); text-transform: uppercase; }
.tile-post { border-style: dashed; box-shadow: none; }
.tile-post:hover { box-shadow: none; }
.tile-post .tile-name { color: var(--muted); font-size: 1.05rem; text-transform: none; }

/* Sections */
.section { padding-top: clamp(56px, 9vw, 112px); padding-bottom: clamp(56px, 9vw, 112px); }
.section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-bottom: 28px; }
.section-head a { font: 400 .75rem/1 var(--pixel); color: var(--gold); text-transform: uppercase; text-decoration: none; }
.section-title, .page-title { margin: 0 0 28px; font: 800 clamp(2rem, 5vw, 3.25rem)/1 var(--display); letter-spacing: -.02em; text-transform: uppercase; }
.page-title { font-size: clamp(2.6rem, 7vw, 4.5rem); margin-bottom: .4rem; }
.section-head .section-title { margin: 0; }

/* Games */
.game { display: grid; grid-template-columns: 1.3fr 1fr; gap: clamp(24px, 5vw, 56px); align-items: center; padding: 40px 0; border-top: 1px dashed var(--line); }
.game:nth-of-type(even) .game-art { order: 2; }
.game-art { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border: 2px solid var(--text); box-shadow: 8px 8px 0 var(--accent); }
.game-name { margin: 0 0 .4rem; font: 800 clamp(2rem, 4vw, 3rem)/.95 var(--display); text-transform: uppercase; }
.game-hook { margin: 0 0 1rem; color: var(--accent); font-size: 1.2rem; }
.game p { color: var(--muted); }
.about p { max-width: 60ch; color: var(--muted); font-size: 1.2rem; }

/* Devlog cards */
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 28px; }
.card { display: flex; flex-direction: column; background: var(--surface); border: 2px solid var(--line); text-decoration: none; transition: border-color .15s, transform .15s; }
.card:hover { border-color: var(--text); transform: translateY(-3px); }
.card img { width: 100%; aspect-ratio: 1200 / 630; object-fit: cover; }
.card-body { padding: 16px 18px 20px; }
.card h3 { margin: 8px 0; font: 800 1.3rem/1.1 var(--display); }
.card time { font: 400 .7rem/1 var(--pixel); color: var(--muted); }
.card p { margin: 8px 0 0; color: var(--muted); font-size: .95rem; }

/* Post */
.post { max-width: 820px; padding-top: 24px; padding-bottom: 80px; }
.post-cover { width: 100%; aspect-ratio: 1200 / 630; object-fit: cover; margin-bottom: 28px; border: 2px solid var(--text); box-shadow: 8px 8px 0 var(--accent); }
.post-title { margin: .4rem 0 2rem; font: 800 clamp(2.2rem, 6vw, 3.6rem)/.95 var(--display); letter-spacing: -.02em; text-transform: uppercase; }
.prose { font-size: 1.125rem; }
.prose h2 { margin: 2.2em 0 .6em; font: 800 1.6rem/1.1 var(--display); text-transform: uppercase; }
.prose h3 { margin: 1.8em 0 .5em; font: 800 1.25rem/1.2 var(--display); }
.prose img, .prose video { width: 100%; margin: 1.6em 0; border: 2px solid var(--line); }
.prose a { color: var(--accent); }
.prose code { padding: .1em .35em; background: var(--surface); font-family: ui-monospace, monospace; }
.prose blockquote { margin: 1.5em 0; padding: .2em 0 .2em 1.2em; border-left: 4px solid var(--accent); color: var(--muted); }
.prose iframe, .video { width: 100%; aspect-ratio: 16 / 9; border: 0; }
.cta { display: grid; grid-template-columns: 220px 1fr; gap: 24px; align-items: center; margin-top: 56px; padding: 20px; background: var(--surface); border: 2px solid var(--text); box-shadow: 6px 6px 0 var(--accent); }
.cta img { aspect-ratio: 16 / 9; object-fit: cover; }
.cta h2 { margin: 0; font: 800 1.5rem/1 var(--display); text-transform: uppercase; }
.cta p { margin: 4px 0 0; color: var(--accent); }
.cta .buttons { margin-top: 14px; }
.post-nav { display: flex; gap: 16px; margin-top: 40px; font: 400 .75rem/1.4 var(--pixel); text-transform: uppercase; }
.post-nav a { color: var(--gold); text-decoration: none; }
.post-nav .newer { margin-left: auto; text-align: right; }

/* Press */
.press-grid { display: grid; grid-template-columns: 300px 1fr; gap: clamp(28px, 5vw, 64px); align-items: start; margin-top: 32px; }
.facts { display: grid; grid-template-columns: auto 1fr; margin: 0; border-top: 1px solid var(--line); position: sticky; top: 24px; }
.facts dt, .facts dd { margin: 0; padding: 10px 0; border-bottom: 1px solid var(--line); }
.facts dt { padding-right: 18px; font: 400 .7rem/1.9 var(--pixel); color: var(--gold); text-transform: uppercase; }
.facts dd { color: var(--muted); overflow-wrap: anywhere; }
.facts a { color: var(--text); }
.prose .facts { position: static; }
.press .prose > h2:first-child { margin-top: 0; }
.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-top: 18px; }
.prose .shots img { margin: 0; aspect-ratio: 16 / 9; object-fit: cover; }
.logos { display: flex; flex-wrap: wrap; gap: 14px; }
.prose .logos img { width: auto; max-height: 120px; margin: 0; background: repeating-conic-gradient(#222 0 25%, #333 0 50%) 0 0 / 16px 16px; }

/* Footer, 404 */
.footer { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px 32px; max-width: 1200px; margin: 0 auto; padding: 32px var(--gutter) 48px; border-top: 1px solid var(--line); }
.footer nav { display: flex; flex-wrap: wrap; gap: 20px; }
.notfound { padding-top: 140px; padding-bottom: 120px; }
.notfound h1 { margin: 0; font: 800 clamp(5rem, 20vw, 12rem)/.8 var(--display); color: var(--accent); }

@media (max-width: 760px) {
  .nav-toggle { display: block; }
  #nav-menu:not(:popover-open) { display: none; }
  #nav-menu:popover-open { position: fixed; inset: 64px var(--gutter) auto auto; flex-direction: column; gap: 18px; padding: 20px 24px; background: var(--surface); border: 2px solid var(--text); box-shadow: 5px 5px 0 var(--accent); }
  .game, .press-grid, .cta { grid-template-columns: 1fr; }
  .game:nth-of-type(even) .game-art { order: 0; }
  .facts { position: static; }
}

@media (prefers-reduced-motion: no-preference) {
  .hero-inner > * { animation: rise .7s cubic-bezier(.2, .7, .2, 1) both; }
  .hero-inner > :nth-child(2) { animation-delay: .06s; }
  .hero-inner > :nth-child(3) { animation-delay: .12s; }
  .hero-inner > :nth-child(4) { animation-delay: .2s; }
  @keyframes rise { from { opacity: 0; transform: translateY(16px); } }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before { transition: none !important; }
}
```

- [ ] **Step 2: Write `_includes/nav.njk`**

```njk
<header class="nav">
  <a class="wordmark" href="/">TOOTH &amp; SCALE</a>
  <button class="nav-toggle" popovertarget="nav-menu" aria-label="Open menu">Menu</button>
  {# Closing on link tap matters on the home page, where the links are same-page anchors. #}
  <nav id="nav-menu" popover onclick="if (event.target.closest('a')) this.hidePopover()">
    <a href="/#games">Games</a>
    <a href="/devlog/">Devlog</a>
    <a href="/press/">Press</a>
    <a href="/#about">About</a>
  </nav>
</header>
```

- [ ] **Step 3: Write `_includes/footer.njk`**

```njk
<footer class="footer">
  <a class="wordmark" href="/">TOOTH &amp; SCALE</a>
  <nav>
    <a href="/#games">Games</a>
    <a href="/devlog/">Devlog</a>
    <a href="/press/">Press</a>
    <a href="/devlog/feed.xml">Feed</a>
  </nav>
  {% if site.pressEmail %}<a href="mailto:{{ site.pressEmail }}">{{ site.pressEmail }}</a>{% endif %}
  <small>© {{ year }} {{ site.name }}</small>
</footer>
```

- [ ] **Step 4: Write `_includes/base.njk`**

`cover` and `summary` come from a post's frontmatter and are undefined on every other page.

```njk
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{% if title %}{{ title }} · {{ site.name }}{% else %}{{ site.name }} · Independent game studio{% endif %}</title>
{% set desc = summary or site.description.short %}
<meta name="description" content="{{ desc }}">
<meta property="og:type" content="{{ 'article' if cover else 'website' }}">
<meta property="og:url" content="{{ site.url }}{{ page.url }}">
<meta property="og:title" content="{{ title or site.name }}">
<meta property="og:description" content="{{ desc }}">
<meta property="og:image" content="{% if cover %}{{ site.url }}{{ page.url }}{{ cover }}{% else %}{{ site.url }}/img/og.jpg{% endif %}">
<meta name="twitter:card" content="summary_large_image">
<link rel="alternate" type="application/atom+xml" title="{{ site.name }} devlog" href="/devlog/feed.xml">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Familjen+Grotesk:wght@400;600&family=Silkscreen&display=swap">
<link rel="stylesheet" href="/css/site.css">
</head>
<body class="{{ bodyClass }}">
{% include "nav.njk" %}
<main id="main">
{{ content | safe }}
</main>
{% include "footer.njk" %}
</body>
</html>
```

- [ ] **Step 5: Write `_includes/game-buttons.njk`** (expects `g`)

```njk
<div class="buttons">
  {% if g.links.play %}<a class="btn" href="{{ g.links.play }}">Play</a>{% endif %}
  {% if g.links.wishlist %}<a class="btn" href="{{ g.links.wishlist }}">Wishlist</a>{% endif %}
  {% if g.links.site %}<a class="btn btn-alt" href="{{ g.links.site }}">Site</a>{% endif %}
  <a class="btn btn-alt" href="/press/{{ g.slug }}/">Press kit</a>
</div>
```

- [ ] **Step 6: Write `pages/404.njk`**

```njk
---
layout: base.njk
title: Not found
permalink: /404.html
eleventyExcludeFromCollections: true
---
<section class="wrap notfound">
  <h1>404</h1>
  <p class="hero-tagline">This page wandered off into the woods.</p>
  <div class="buttons"><a class="btn" href="/">Home</a><a class="btn btn-alt" href="/devlog/">Devlog</a></div>
</section>
```

- [ ] **Step 7: Build and check that the 404 page renders with absolute asset paths**

Run: `npm run build && grep -c 'href="/css/site.css"' _site/404.html`
Expected: build succeeds; prints `1`.

- [ ] **Step 8: Commit**

```bash
git add css _includes pages/404.njk
git commit -m "Add Night Arcade design system, base layout, nav, footer, 404"
```

### Task 7: Home page

**Files:**
- Create: `index.njk`, `_includes/post-card.njk`

- [ ] **Step 1: Write `_includes/post-card.njk`** (expects `post`)

```njk
{% set pg = post.data.game | gameBySlug %}
<a class="card{% if pg.pixelArt %} pixel{% endif %}" href="{{ post.url }}">
  <img src="{{ post.url }}{{ post.data.cover }}" alt="" loading="lazy">
  <div class="card-body">
    <span class="chip">{{ pg.name or site.name }}</span>
    <h3>{{ post.data.title }}</h3>
    <time datetime="{{ post.date | isoDate }}">{{ post.date | displayDate }}</time>
    <p>{{ post.data.summary }}</p>
  </div>
</a>
```

- [ ] **Step 2: Write `index.njk`**

```njk
---
layout: base.njk
bodyClass: home
---
{% set latest = collections.posts[0] %}
<section class="hero" style="--hero: url({{ games[0].art.hero }})" data-art="{{ games | pluck('art.hero') | dump }}">
  <div class="wrap hero-inner">
    <p class="kicker">Independent game studio</p>
    <h1 class="hero-title">Tooth <span>&amp;</span> Scale</h1>
    <p class="hero-tagline">{{ site.tagline }}</p>
    <div class="tiles">
      {% for g in games %}
      <a class="tile{% if g.pixelArt %} pixel{% endif %}" href="{{ g.links.site or ('#game-' + g.slug) }}" style="background-image: url({{ g.art.tile }})">
        <span class="chip">{{ g.status }}</span>
        <span class="tile-name">{{ g.name }}</span>
      </a>
      {% endfor %}
      {% if latest %}
      <a class="tile tile-post" href="{{ latest.url }}">
        <span class="chip">Latest devlog</span>
        <span class="tile-name">{{ latest.data.title }}</span>
      </a>
      {% endif %}
    </div>
  </div>
</section>
<script>
  (h => { const a = JSON.parse(h.dataset.art); h.style.setProperty("--hero", `url(${a[Math.floor(Math.random() * a.length)]})`); })(document.querySelector(".hero"));
</script>

<section id="games" class="wrap section">
  <h2 class="section-title">Games</h2>
  {% for g in games %}
  <article class="game" id="game-{{ g.slug }}">
    <img class="game-art{% if g.pixelArt %} pixel{% endif %}" src="{{ g.art.tile }}" width="960" height="540" alt="{{ g.art.alt }}" loading="lazy">
    <div>
      <p class="kicker">{{ g.status }} · {{ g.platforms | join(" · ") }}</p>
      <h3 class="game-name">{{ g.name }}</h3>
      <p class="game-hook">{{ g.hook }}</p>
      <p>{{ g.pitch }}</p>
      {% include "game-buttons.njk" %}
    </div>
  </article>
  {% endfor %}
</section>

{% if collections.posts.length %}
<section class="wrap section">
  <div class="section-head"><h2 class="section-title">From the devlog</h2><a href="/devlog/">All posts →</a></div>
  <div class="cards">
    {% for post in collections.posts | head(3) %}{% include "post-card.njk" %}{% endfor %}
  </div>
</section>
{% endif %}

<section id="about" class="wrap section about">
  <h2 class="section-title">About the studio</h2>
  <p>{{ site.about }}</p>
</section>

{% set channels = site.channels | compactEntries %}
{% if channels.length %}
<section class="wrap section">
  <h2 class="section-title">Follow along</h2>
  <div class="buttons">
    {% for c in channels %}<a class="btn btn-alt" href="{{ c[1] }}">{{ site.channelNames[c[0]] }}</a>{% endfor %}
  </div>
</section>
{% endif %}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: writes `_site/index.html` and `_site/404.html`. Then run `npm run check`.
Expected: FAIL, listing `/devlog/` and `/press/alloy/` links and the missing `devlog/feed.xml` (those pages come in later tasks). Confirm **no other** broken links are listed. Every image and `/css/` path must resolve.

- [ ] **Step 4: Visual check at desktop and phone widths**

Start `npm run serve` in the background (it serves `http://localhost:8080`). With Playwright:
- resize to 1366×900, open `/`, wait 2 s, full-page screenshot to `c:\Projects\.playwright-mcp\home-desk.png`
- resize to 390×844, screenshot to `c:\Projects\.playwright-mcp\home-phone.png`
- click "Menu" and screenshot to confirm the popover menu opens

Read the screenshots and compare against the spec's reference mockup (`.superpowers/brainstorm/site-design/home-layout.html`, option 1). Check:
- hero art is visible behind the title
- the two game tiles have orange offset shadows
- there's no horizontal scroll at 390px
- Follow and devlog sections are absent (no data yet)

Fix anything off before committing.

- [ ] **Step 5: Commit**

```bash
git add index.njk _includes/post-card.njk
git commit -m "Add home page: studio hero, games, about, follow"
```

---

## Chunk 3: Devlog

### Task 8: Post layout, devlog index, Atom feed

**Files:**
- Create: `_includes/post.njk`, `pages/devlog.njk`, `pages/feed.njk`

- [ ] **Step 1: Write `_includes/post.njk`**

`getPreviousCollectionItem` returns the **newer** post, because `posts` is sorted newest first.

```njk
---
layout: base.njk
---
{% set g = game | gameBySlug %}
<article class="wrap post{% if g.pixelArt %} pixel{% endif %}">
  <img class="post-cover" src="{{ cover }}" alt="" width="1200" height="630">
  <p class="kicker"><span class="chip">{{ g.name or site.name }}</span> · <time datetime="{{ page.date | isoDate }}">{{ page.date | displayDate }}</time></p>
  <h1 class="post-title">{{ title }}</h1>
  <div class="prose">
    {{ content | safe }}
  </div>
  {% if g %}
  <aside class="cta">
    <img class="{% if g.pixelArt %}pixel{% endif %}" src="{{ g.art.tile }}" alt="{{ g.art.alt }}" loading="lazy">
    <div>
      <h2>{{ g.name }}</h2>
      <p>{{ g.hook }}</p>
      {% include "game-buttons.njk" %}
    </div>
  </aside>
  {% endif %}
  {% set newer = collections.posts | getPreviousCollectionItem %}
  {% set older = collections.posts | getNextCollectionItem %}
  <nav class="post-nav">
    {% if older %}<a class="older" href="{{ older.url }}">← {{ older.data.title }}</a>{% endif %}
    {% if newer %}<a class="newer" href="{{ newer.url }}">{{ newer.data.title }} →</a>{% endif %}
  </nav>
</article>
```

- [ ] **Step 2: Write `pages/devlog.njk`**

```njk
---
layout: base.njk
title: Devlog
permalink: /devlog/
---
<section class="wrap section">
  <div class="section-head"><h1 class="section-title">Devlog</h1><a href="/devlog/feed.xml">Feed</a></div>
  {% if collections.posts.length %}
  <div class="cards">
    {% for post in collections.posts %}{% include "post-card.njk" %}{% endfor %}
  </div>
  {% else %}
  <p class="hero-tagline">No posts yet.</p>
  {% endif %}
</section>
```

- [ ] **Step 3: Write `pages/feed.njk`**

```njk
---
permalink: /devlog/feed.xml
eleventyExcludeFromCollections: true
---
<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>{{ site.name }} devlog</title>
  <subtitle>{{ site.description.short }}</subtitle>
  <link href="{{ site.url }}/devlog/feed.xml" rel="self"/>
  <link href="{{ site.url }}/devlog/"/>
  <id>{{ site.url }}/devlog/</id>
  <updated>{% if collections.posts.length %}{{ collections.posts | getNewestCollectionItemDate | dateToRfc3339 }}{% else %}{{ now | dateToRfc3339 }}{% endif %}</updated>
  <author><name>{{ site.name }}</name></author>
  {%- for post in collections.posts %}
  {%- set absUrl = site.url + post.url %}
  <entry>
    <title>{{ post.data.title }}</title>
    <link href="{{ absUrl }}"/>
    <id>{{ absUrl }}</id>
    <updated>{{ post.date | dateToRfc3339 }}</updated>
    <summary>{{ post.data.summary }}</summary>
    <content type="html">{{ post.templateContent | htmlToAbsoluteUrls(absUrl) }}</content>
  </entry>
  {%- endfor %}
</feed>
```

- [ ] **Step 4: Add a throwaway test post to exercise every path**

Create `devlog/2026-10-29-layout-test/index.md`:

```markdown
---
title: Layout test post
date: 2026-10-29
game: alloy
summary: A throwaway post to check the devlog templates.
cover: cover.png
---

A paragraph with a [link](https://example.com).

![A relative image](shot.png)

## A heading

> A quote.
```

Then make its media:
```bash
ffmpeg -loglevel error -y -i img/alloy-hero.webp -vf "scale=1200:630:force_original_aspect_ratio=increase:flags=neighbor,crop=1200:630" devlog/2026-10-29-layout-test/cover.png
cp devlog/2026-10-29-layout-test/cover.png devlog/2026-10-29-layout-test/shot.png
```

- [ ] **Step 5: Build and verify the post, the feed and the checks**

Run: `npm run build && npm run check`
Expected: the only broken links are the `/press/...` ones (press pages come in Task 9).

Then run:
```bash
grep -o 'src=&quot;[^&]*shot.png' _site/devlog/feed.xml
grep -o '<meta property="og:image" content="[^"]*"' _site/devlog/2026-10-29-layout-test/index.html
```
Expected:
- the first command prints `src=&quot;https://toothandscale.com/devlog/2026-10-29-layout-test/shot.png`. The content is autoescaped, which is correct for Atom `type="html"`. Only if it prints a bare `src=&quot;shot.png` is the async filter not running inside the Nunjucks `for`; in that case change the loop to `{%- asyncEach post in collections.posts %}…{%- endeach %}` and re-run.
- the second command prints `content="https://toothandscale.com/devlog/2026-10-29-layout-test/cover.png"`.

- [ ] **Step 6: Verify the frontmatter validation fails loudly**

Delete the `summary:` line from the test post and run `npx @11ty/eleventy --dryrun`.
Expected: FAIL with `missing frontmatter summary`.
Put the line back. Then set `game: nope` and expect FAIL with `game "nope" is not a slug`. Restore `game: alloy`. Then change the date to `2026-10-30` and expect FAIL with `must be set and match the folder prefix`. Restore `2026-10-29`.

- [ ] **Step 7: Visual check**

With `npm run serve`, screenshot `/`, `/devlog/` and `/devlog/2026-10-29-layout-test/` at 1366px and 390px. Confirm:
- the home page now shows the "Latest devlog" tile and the "From the devlog" section
- the post's cover and body image are pixelated (sharp)
- the call-to-action box shows Alloy with its Play and Press kit buttons

- [ ] **Step 8: Remove the test post and commit**

```bash
rm -r devlog/2026-10-29-layout-test
git add _includes/post.njk pages/devlog.njk pages/feed.njk
git commit -m "Add devlog: post layout, index, Atom feed"
```

---

## Chunk 4: Press hub

### Task 9: Press assets and pages

**Files:**
- Create: `press/alloy/images/*.png`, `press/alloy/alloy-teaser.mp4`, `press/unhappy-campers/images/*.png`, `press/studio/wordmark-*.png`, `pages/press.njk`, `pages/press-game.njk`

- [ ] **Step 1: Copy screenshots and encode the teaser**

```bash
A=/c/Projects/Alloy/marketing/2026-10-17-fun-30s-social
C="/c/Projects/Camping Slop/LookSheets/2026-10-27_022639"
mkdir -p press/alloy/images press/unhappy-campers/images press/studio
cp "$A/stills/1.png" press/alloy/images/alloy-01.png
cp "$A/stills/2.png" press/alloy/images/alloy-02.png
cp "$C/camp_Golden.png" press/unhappy-campers/images/unhappy-campers-01.png
cp "$C/camp_Night_lit.png" press/unhappy-campers/images/unhappy-campers-02.png
cp "$C/forest_Dusk.png" press/unhappy-campers/images/unhappy-campers-03.png
cp "$C/overhead_Golden.png" press/unhappy-campers/images/unhappy-campers-04.png
ffmpeg -loglevel error -y -i "$A/wide-sfx.mp4" -vf "scale=1280:-2:flags=neighbor" -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart press/alloy/alloy-teaser.mp4
ls -la press/*/ press/*/images
```
Expected: the teaser is under 10 MB. If it's larger, re-run with `-crf 30`.

- [ ] **Step 2: Render the studio wordmark PNGs with ffmpeg**

Run from a temp folder, so the font file stays out of the repo and the font path has no drive-letter colon for `drawtext`:
```bash
T="$(mktemp -d)"; R="$PWD"
curl -sL -o "$T/Silkscreen-Regular.ttf" https://github.com/google/fonts/raw/main/ofl/silkscreen/Silkscreen-Regular.ttf
cd "$T"
DT="drawtext=fontfile=Silkscreen-Regular.ttf:text='TOOTH & SCALE':fontsize=110:x=(w-text_w)/2:y=(h-text_h)/2"
ffmpeg -loglevel error -y -f lavfi -i "color=c=0x0d0f14:s=1400x300" -vf "$DT:fontcolor=0xffcf5a" -frames:v 1 "$R/press/studio/wordmark-on-dark.png"
ffmpeg -loglevel error -y -f lavfi -i "color=c=0xf1ead8:s=1400x300" -vf "$DT:fontcolor=0x0d0f14" -frames:v 1 "$R/press/studio/wordmark-on-light.png"
ffmpeg -loglevel error -y -f lavfi -i "color=c=black@0.0:s=1400x300,format=rgba" -vf "$DT:fontcolor=0xffcf5a" -frames:v 1 "$R/press/studio/wordmark-transparent.png"
cd "$R"
```
Read the three PNGs and confirm the wordmark is centered, legible, and set in the pixel font (not a fallback font).

- [ ] **Step 3: Write `pages/press.njk`**

```njk
---
layout: base.njk
title: Press kit
permalink: /press/
---
{% set channels = site.channels | compactEntries %}
<section class="wrap section press">
  <p class="kicker">Press kit</p>
  <h1 class="page-title">{{ site.name }}</h1>
  <div class="press-grid">
    <dl class="facts">
      <dt>Developer</dt><dd>{{ site.name }}</dd>
      {% if site.basedIn %}<dt>Based in</dt><dd>{{ site.basedIn }}</dd>{% endif %}
      <dt>Website</dt><dd><a href="{{ site.url }}/">{{ site.url | replace("https://", "") }}</a></dd>
      {% if site.pressEmail %}<dt>Press</dt><dd><a href="mailto:{{ site.pressEmail }}">{{ site.pressEmail }}</a></dd>{% endif %}
      {% if channels.length %}<dt>Social</dt><dd>{% for c in channels %}<a href="{{ c[1] }}">{{ site.channelNames[c[0]] }}</a>{% if not loop.last %}, {% endif %}{% endfor %}</dd>{% endif %}
    </dl>
    <div class="prose">
      <h2>Description</h2>
      <p>{{ site.description.long }}</p>
      {% if site.history %}<h2>History</h2><p>{{ site.history }}</p>{% endif %}
      <h2>Projects</h2>
      <ul>
        {% for g in games %}<li><a href="/press/{{ g.slug }}/">{{ g.name }}</a>: {{ g.status }}</li>{% endfor %}
      </ul>
      {% if studioLogos.length %}
      <h2>Logo</h2>
      <div class="logos">
        {% for l in studioLogos %}<a href="/press/studio/{{ l }}"><img src="/press/studio/{{ l }}" alt="{{ site.name }} wordmark ({{ l }})"></a>{% endfor %}
      </div>
      {% endif %}
      {% if site.pressEmail %}<h2>Contact</h2><p><a href="mailto:{{ site.pressEmail }}">{{ site.pressEmail }}</a></p>{% endif %}
    </div>
  </div>
</section>
```

- [ ] **Step 4: Write `pages/press-game.njk`**

```njk
---
layout: base.njk
pagination:
  data: games
  size: 1
  alias: g
permalink: "/press/{{ g.slug }}/"
eleventyComputed:
  title: "{{ g.name }} press kit"
---
{% set images = pressImages[g.slug] %}
{% set logo = pressLogos[g.slug] %}
{% set yt = g.press.video | youtubeEmbed %}
<section class="wrap section press">
  <p class="kicker"><a href="/press/">Press kit</a> / {{ g.name }}</p>
  <h1 class="page-title">{{ g.name }}</h1>
  <p class="game-hook">{{ g.hook }}</p>
  <div class="press-grid">
    <dl class="facts">
      <dt>Developer</dt><dd><a href="/press/">{{ site.name }}</a></dd>
      <dt>Release</dt><dd>{{ g.press.release or "TBA" }}</dd>
      <dt>Platforms</dt><dd>{{ g.platforms | join(", ") }}</dd>
      <dt>Status</dt><dd>{{ g.status }}</dd>
      <dt>Price</dt><dd>{{ g.press.price or "TBA" }}</dd>
      {% if g.links.site %}<dt>Website</dt><dd><a href="{{ g.links.site }}">{{ g.links.site | replace("https://", "") }}</a></dd>{% endif %}
      {% if g.links.play %}<dt>Play</dt><dd><a href="{{ g.links.play }}">{{ g.links.play | replace("https://", "") }}</a></dd>{% endif %}
      {% if g.links.wishlist %}<dt>Steam</dt><dd><a href="{{ g.links.wishlist }}">Wishlist</a></dd>{% endif %}
      {% if site.pressEmail %}<dt>Press</dt><dd><a href="mailto:{{ site.pressEmail }}">{{ site.pressEmail }}</a></dd>{% endif %}
    </dl>
    <div class="prose">
      <h2>Description</h2>
      <p>{{ g.press.description }}</p>
      {% if g.press.features.length %}
      <h2>Features</h2>
      <ul>{% for f in g.press.features %}<li>{{ f }}</li>{% endfor %}</ul>
      {% endif %}
      {% if g.press.history %}<h2>History</h2><p>{{ g.press.history }}</p>{% endif %}
      {% if g.press.video %}
      <h2>Video</h2>
      {% if yt %}<iframe class="video" src="{{ yt }}" title="{{ g.name }} video" allowfullscreen loading="lazy"></iframe>
      {% else %}<video class="video" src="{{ g.press.video }}" controls preload="metadata"></video>{% endif %}
      {% endif %}
      {% if images.length %}
      <h2>Images</h2>
      <a class="btn" href="/press/{{ g.slug }}/{{ g.slug }}-images.zip">Download all (.zip)</a>
      <div class="shots{% if g.pixelArt %} pixel{% endif %}">
        {% for f in images %}<a href="/press/{{ g.slug }}/images/{{ f }}"><img src="{{ f | thumbUrl(g.slug) }}" alt="{{ g.name }} screenshot {{ loop.index }}" width="640" loading="lazy"></a>{% endfor %}
      </div>
      {% endif %}
      {% if logo %}<h2>Logo</h2><div class="logos"><a href="/press/{{ g.slug }}/{{ logo }}"><img src="/press/{{ g.slug }}/{{ logo }}" alt="{{ g.name }} logo"></a></div>{% endif %}
      {% if g.press.quotes.length %}
      <h2>Quotes</h2>
      {% for q in g.press.quotes %}<blockquote><p>{{ q.text }}</p><cite>{% if q.url %}<a href="{{ q.url }}">{{ q.source }}</a>{% else %}{{ q.source }}{% endif %}</cite></blockquote>{% endfor %}
      {% endif %}
      {% if g.press.credits.length %}
      <h2>Credits</h2>
      <dl class="facts">{% for c in g.press.credits %}<dt>{{ c.role }}</dt><dd>{{ c.name }}</dd>{% endfor %}</dl>
      {% endif %}
    </div>
  </div>
</section>
```

- [ ] **Step 5: Build and run the full check**

Run: `npm run build && npm run check`
Expected:
- the build prints `zip: _site/press/alloy/alloy-images.zip (2 images)` and `zip: _site/press/unhappy-campers/unhappy-campers-images.zip (4 images)`
- the check prints `check: required files present, all internal links resolve`
- `ls _site/press/alloy/thumbs` lists `alloy-01.webp alloy-02.webp`

- [ ] **Step 6: Prove the zips open in a real extractor**

Run (PowerShell):
```powershell
$t = Join-Path $env:TEMP "zipcheck"; Remove-Item -Recurse -Force $t -ErrorAction SilentlyContinue
Expand-Archive C:\Projects\toothandscale-site\_site\press\unhappy-campers\unhappy-campers-images.zip -DestinationPath $t
Get-ChildItem $t | Select-Object Name, Length
```
Expected: four PNGs, with sizes equal to the originals in `press/unhappy-campers/images/`.

- [ ] **Step 7: Visual check**

Screenshot `/press/`, `/press/alloy/` and `/press/unhappy-campers/` at 1366px and 390px. Confirm:
- the fact sheet sits left of the content on desktop and stacks on the phone
- Alloy thumbnails are crisp (nearest-neighbour), not blurred
- the teaser video plays
- release and price read "TBA"
- no empty headings (History, Logo, Quotes, Credits are absent)

- [ ] **Step 8: Commit**

```bash
git add press pages/press.njk pages/press-game.njk
git commit -m "Add press hub: studio and per-game fact sheets, images, zips, teaser"
```

---

## Chunk 5: Deploy, docs, finish

### Task 10: Deploy workflow

**Files:**
- Modify: `.github/workflows/deploy.yml` (full replacement)

- [ ] **Step 1: Replace `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      FTP_HOST: ${{ secrets.FTP_HOST }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm run check
      - name: Press zips open
        run: |
          shopt -s nullglob
          for z in _site/press/*/*.zip; do unzip -tq "$z"; done

      # Skipped until the FTP secrets are set in the repo. The FTP account must be rooted at
      # public_html (the main domain). The action deletes only files it uploaded itself, so the
      # subdomain folders and the old WordPress files are left alone.
      - name: Deploy via FTP
        if: env.FTP_HOST != ''
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.FTP_HOST }}
          username: ${{ secrets.FTP_USERNAME }}
          password: ${{ secrets.FTP_PASSWORD }}
          local-dir: ./_site/
          server-dir: ./
```

- [ ] **Step 2: Rehearse the CI steps locally from a clean state**

Run: `rm -rf node_modules _site && npm ci && npm test && npm run build && npm run check`
Expected: every step passes.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "Deploy workflow: test, build, check, FTP _site"
```

### Task 11: Repo `CLAUDE.md`

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write `CLAUDE.md`**

````markdown
# toothandscale.com

The Tooth and Scale studio site: an Eleventy 3 static site, FTP-deployed to `public_html` on push to `main` (`.github/workflows/deploy.yml`). The design spec is `docs/superpowers/specs/2026-10-29-studio-site-design.md`.

## Commands
- `npm run serve`: dev server at http://localhost:8080. Restart it after adding press images or games, because those lists are read when the config loads.
- `npm run build`: clean build to `_site/` plus the press zips.
- `npm run check`: required files present and every internal link resolves. Run it after every build.
- `npm test`: self-checks for `scripts/zip.mjs` and `scripts/check.mjs`.

## Where things live
- Studio facts, channels and the press email: `_data/site.json`. Games: `_data/games.json`. **An empty string hides that link or section everywhere.** Never add placeholder text; the only allowed placeholder is "TBA" for release and price, which the templates handle.
- Adding a game: add a `games.json` entry (required: `slug`, `name`, `hook`, `pitch`, `status`, `art.hero`, `art.tile`), cut `img/<slug>-hero.webp` (≥1280 wide) and `img/<slug>-tile.webp` (960×540) with ffmpeg (`flags=neighbor` for pixel art), and add press screenshots to `press/<slug>/images/` (full-size PNG).
- Templates: `_includes/` and `pages/`. Styles: `css/site.css` (one file, tokens on `:root`). The only script is the hero art picker in `index.njk`.
- All asset paths are root-absolute (`/img/...`), except media inside a devlog post, which are relative to the post folder.

## Writing a devlog post
1. Ask which work the post covers, and read the sources: the game repo's git log for the date range, its `docs/superpowers/` specs and plans, playtest reports, and Operator task summaries if pointed at them.
2. Branch: `git switch -c devlog/<slug>`.
3. Create `devlog/YYYY-MM-DD-<slug>/index.md` with **all** of:
   ```yaml
   ---
   title: Short, concrete title
   date: YYYY-MM-DD
   game: alloy          # a slug from _data/games.json, or "studio"
   summary: One sentence. Used on cards, in RSS and in link previews.
   cover: cover.png
   ---
   ```
   The build fails if any field is missing or `game` is unknown.
4. Media goes in the same folder, referenced relatively (`![Alt text](combust.png)`):
   - cover: 1200×630 or larger, `cover.png`
   - images: ≤1920px wide, PNG or JPG; for pixel art scale with `flags=neighbor`
   - clips: `.mp4` (H.264, `-movflags +faststart`, keep each under ~8 MB), embedded as `<video src="clip.mp4" controls muted loop playsinline></video>`
   - YouTube: a plain `<iframe>` with a `youtube-nocookie.com/embed/<id>` src
   - every image gets real alt text
5. `npm run build && npm run check`, then `npm run serve` and screenshot the post at 1366px and 390px. Show the owner the screenshots and the post text.
6. Only after the owner approves: merge to `main` and push. That deploys. Never push a post to `main` without approval.

## Voice
First person singular ("I"), since the studio is one person. Plain and specific: say what changed, why, and what it plays like, with real numbers (counts, timings, percentages) over adjectives. Be honest about what's unfinished or didn't work. No hype words ("epic", "revolutionary", "game-changing"), no exclamation marks, no "stay tuned". Short paragraphs; one idea each. End with what's next, in a sentence. Reference voice: the Reddit devlog copy in `C:\Projects\Alloy\marketing\2026-10-17-fun-30s-social\copy.md`. The owner edits this section as the voice settles.
````

- [ ] **Step 2: Confirm Eleventy ignores it**

Run: `npm run build && test ! -e _site/CLAUDE/index.html && echo ignored`
Expected: `ignored`

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Add repo CLAUDE.md: commands, data, devlog workflow, voice"
```

### Task 12: Final verification and handoff

- [ ] **Step 1: Full clean run**

Run: `rm -rf _site && npm test && npm run build && npm run check`
Expected: all pass.

- [ ] **Step 2: Full visual pass**

Screenshot every page (`/`, `/devlog/`, `/press/`, `/press/alloy/`, `/press/unhappy-campers/`, and `/404.html`) at 1366px and 390px. Confirm against the spec:
- Night Arcade look throughout
- no horizontal scroll on phones
- popover menu works
- Follow, devlog and contact sections are hidden while their data is empty
- `/devlog/` reads "No posts yet."

Also emulate `prefers-reduced-motion: reduce` (Playwright `browser_emulate_media`) and confirm the hero renders without animation.

- [ ] **Step 3: Update the project memory**

Update `C:\Users\hahnz\.claude\projects\c--Projects\memory\toothandscale-studio-site.md`:
- it's now Eleventy, with devlog and press
- the devlog workflow lives in the repo's `CLAUDE.md`
- cutover is still pending

Keep the existing facts that are still true.

- [ ] **Step 4: Report the cutover steps to the owner (do not perform them)**

These are outward-facing, so the owner does or approves each one:
1. Back up WordPress in cPanel (home directory files and the database).
2. `gh repo create Atlaszmh/toothandscale-site --private --source . --push`, then add the `FTP_HOST`, `FTP_USERNAME` and `FTP_PASSWORD` secrets for an account rooted at `public_html`.
3. The first deploy runs on push, or via workflow_dispatch.
4. Delete the WordPress files (`wp-admin/`, `wp-includes/`, `wp-content/`, `wp-*.php`, `xmlrpc.php`, `index.php`) from `public_html`, leaving subdomain folders.
5. Add the `press@toothandscale.com` forwarder, then set `pressEmail` in `_data/site.json`.
6. If the old page still shows, purge the Cloudflare cache.
