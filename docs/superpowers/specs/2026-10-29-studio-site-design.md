# Tooth and Scale studio site: design

Date: 2026-10-29 · Status: approved in brainstorming, awaiting spec review

## Goal

Replace the old WordPress site at `toothandscale.com` with the Tooth and Scale studio site. It is for **players** and **press/creators**: show the games, link out to each game's own subdomain site, give press what it needs, and host a devlog that Claude drafts with the owner.

Already decided in conversation (not re-litigated here):
- Games on the site: **Alloy: Delvesmith** (live at `alloy.toothandscale.com`, playtest) and **Unhappy Campers** (in development, no site yet). Two Minute Empire is deliberately left off.
- No public contact today. A `press@toothandscale.com` cPanel forwarder will be added later; until then no contact renders.
- The channels (Discord, Steam, socials, newsletter) don't exist yet but will. The design plans for all of them and hides each one until its URL is set.
- The old WordPress site is backed up, then replaced.

## Visual direction: Night Arcade

- Dark only. Background `#0d0f14`, raised surface `#15181f`, text bone `#f1ead8`, muted text `#b9b4a6`, accent orange `#ff6b3d`, pixel-label gold `#ffcf5a`.
- Type: **Bricolage Grotesque** 800 uppercase for display; **Familjen Grotesk** for body; **Silkscreen** for small labels, nav and buttons (Google Fonts).
- Full-bleed game art with dark gradients, a 2px bone border and a hard 5px orange offset shadow on tiles and buttons. Pixel art always uses `image-rendering: pixelated` and nearest-neighbour resizing.
- Motion: one staggered fade-in on load, small hover lifts, all disabled under `prefers-reduced-motion`.
- Must work at phone width: 16px gutters, no horizontal scroll, and the nav collapses to a menu button.
- Reference mockups: `.superpowers/brainstorm/site-design/direction.html` (option B) and `home-layout.html` (option 1).

## Site map

| Path | Content |
|---|---|
| `/` | Home |
| `/devlog/` | All posts, newest first |
| `/devlog/<slug>/` | Post |
| `/devlog/feed.xml` | Atom feed (explicit `permalink: /devlog/feed.xml`) |
| `/press/` | Studio fact sheet |
| `/press/<game-slug>/` | Game fact sheet |
| `/404.html` | Not found (explicit `permalink: /404.html`; wired up through `.htaccess` `ErrorDocument`) |

There is no separate games or about page. The nav's Games and About items scroll to sections on the home page.

## Home page

1. **Nav:** Silkscreen wordmark "TOOTH & SCALE" in gold, then Games · Devlog · Press · About. On phones the links move into a native `popover` menu (`popovertarget` button, no script).
2. **Hero:** small label "INDEPENDENT GAME STUDIO", "TOOTH & SCALE" huge (the `&` in orange), the tagline, and full-bleed background art. The hero element carries every game's `art.hero` path as a JSON array in `data-art`. The site's only script, inline, picks one at random on each visit. The no-JS default is the first game's image, set by the home template as an inline `style="--hero: url(...)"` that the CSS uses. Below sit one tile per game (status chip and name) plus a "Latest devlog" tile (title of the newest post; the tile is omitted when there are no posts). A game tile links to `links.site`, or to `#game-<slug>` when there is no site.
3. **Games (`#games`):** one wide band per game (`id="game-<slug>"`) with art, hook, pitch, status, platforms and buttons. The buttons are **Play** (`links.play`), **Wishlist** (`links.wishlist`), **Site** (`links.site`) and **Press kit** (always present). Each link button renders only when its URL is set.
4. **From the devlog:** the three newest posts as cards (cover, game chip, date, summary). Hidden when there are no posts.
5. **About (`#about`):** `site.about`, a short studio blurb.
6. **Follow:** one button per non-empty `site.channels` entry. The whole section is hidden when all are empty.
7. **Footer:** wordmark, nav links, `pressEmail` when set, "© <build year> Tooth and Scale" (year taken at build time).

## Press hub (presskit() conventions)

**`/press/`:**
- **Facts:** developer, based in (when set), website, press contact (when set), socials (non-empty channels).
- **Description:** short and long. **History:** `site.history`, rendered when set.
- **Projects:** links to each `/press/<slug>/`.
- **Logo:** the site's Silkscreen wordmark as PNGs (on dark, on light, and transparent), in `press/studio/`. Claude renders them from the site's own wordmark with Playwright screenshots. There is no SVG until a real logo exists.
- **Contact:** shown when `pressEmail` is set.

**`/press/<slug>/`:**
- **Facts:** developer, release (`press.release`, or "TBA"), platforms, status, price (`press.price`, or "TBA"), links (site/play/wishlist when set).
- **Description, features** (bullets), **history**.
- **Video:** `press.video` is either a YouTube URL (rendered as an embed) or a path to a self-hosted `.mp4` (rendered with `<video controls>`). The first pass uses Alloy's 30-second teaser `marketing/2026-10-17-fun-30s-social/wide.mp4`, re-encoded smaller.
- **Images:** a grid of every file in `press/<slug>/images/`, with 640px-wide WebP thumbnails made by an `eleventy-img` shortcode in the press template (the only place it is used; `outputDir: _site/press/<slug>/thumbs/`, `urlPath: /press/<slug>/thumbs/`, default hashed filenames). For `pixelArt` games, thumbnails must use nearest-neighbour: if eleventy-img exposes no resize-kernel option, that shortcode calls `sharp` (already installed as eleventy-img's dependency) directly with `resize({ width: 640, kernel: "nearest" })` and writes to the same folder, each linking to the full-size PNG original, plus a **Download all (.zip)** button linking to `/press/<slug>/<slug>-images.zip`. The section and button render only when the folder has images.
- **Logo:** rendered when `press/<slug>/logo.*` exists.
- **Quotes/awards** and **credits:** each rendered only when the data is non-empty.

**Rule:** every optional section and field renders only when its data is non-empty. The only placeholder text is "TBA" for release and price.

**First-pass assets:**
- Alloy: the stills in `C:\Projects\Alloy\marketing\2026-10-17-fun-30s-social\stills\` (1920×1080 PNG) and the teaser.
- Unhappy Campers: the newest set in `C:\Projects\Camping Slop\LookSheets\` (e.g. `2026-10-27_022639/camp_Golden.png`, `camp_Night_lit.png`, `forest_Dusk.png`).

Copy comes from Alloy's `marketing/.../copy.md` and the Unhappy Campers GDD (`Camping Friendslop — GDD.md`, "Pitch and pillars").

## Devlog

**Layout:** one folder per post: `devlog/YYYY-MM-DD-<slug>/index.md` plus its media (cover, images, clips). The URL keeps the folder name, `/devlog/YYYY-MM-DD-<slug>/`, which is Eleventy's default for `index.md`, so no permalink logic is needed. Media are passthrough-copied to the same path, so relative references in the Markdown (`![](combust.png)`, `cover: cover.png`) resolve unchanged. Post media are originals sized for the web at authoring time (≤1920px wide; Claude resizes with ffmpeg when drafting). No image pipeline runs on posts.

**Frontmatter (all required):**
```yaml
title: Bosses got break gauges
date: 2026-11-02
game: alloy            # a slug from games.json, or "studio"
summary: One sentence, used for cards, RSS and og:description.
cover: cover.png       # relative to the post folder
```

**Index:** newest first, with cards. No pagination and no filters (add them when the post count makes them necessary).

**Post page:**
- cover banner, title, game chip, date
- body: images full width; the post wrapper gets class `pixel` when the post's game has `pixelArt: true`, and CSS makes `.pixel img` render `pixelated`; `.mp4` and YouTube are plain HTML in the Markdown
- a game call-to-action box from that game's `links` (none for `game: studio`), then previous/next links

**Meta:** per-post `og:title`, `og:description`, `og:image` (`site.url + page.url + cover`, the passthrough original), and `twitter:card=summary_large_image`. Other pages use `site.url + "/img/og.jpg"`.

**Feed:** Atom at `/devlog/feed.xml` via `@11ty/eleventy-plugin-rss`. Each entry's content is made absolute against **that entry's own URL** (`site.url + post.url`), not the site root, so a post's relative media (`combust.png`) resolve to `/devlog/<folder>/combust.png` in feed readers. It is linked from `<head>` and the devlog index.

**Authoring workflow (documented in the repo's `CLAUDE.md`):**
1. The owner asks for a post and points at its sources: a game repo, a date range, specs, Operator tasks.
2. Claude drafts on branch `devlog/<slug>`: post, cover and media.
3. Claude builds locally and shows the owner a screenshot of the rendered post.
4. Once the owner approves, Claude merges to `main`, which deploys. Branches are the drafts; there is no `draft` flag.

The `CLAUDE.md` also holds the post schema, image rules (cover 1200×630 or larger; originals in the post folder; the pixel-art flag comes from the game) and a **voice guide** seeded from the Alloy devlog copy: first person, plain, honest about what's unfinished, specific numbers over hype, no marketing superlatives. The owner edits the voice guide over time.

## Data

**`_data/site.json`:**
```json
{
  "name": "Tooth and Scale",
  "url": "https://toothandscale.com",
  "tagline": "...",
  "about": "...",
  "description": { "short": "...", "long": "..." },
  "history": "",
  "basedIn": "",
  "pressEmail": "",
  "channels": { "discord": "", "steam": "", "bluesky": "", "x": "", "tiktok": "", "youtube": "", "newsletter": "" }
}
```

**`_data/games.json`** (an array in display order):
```json
{
  "slug": "alloy",
  "name": "Alloy: Delvesmith",
  "hook": "Every element reacts.",
  "pitch": "...",
  "status": "Playtest",
  "platforms": ["Web browser"],
  "pixelArt": true,
  "art": { "hero": "/img/alloy-hero.webp", "tile": "/img/alloy-tile.webp" },
  "links": { "play": "https://alloy.toothandscale.com/", "wishlist": "", "site": "" },
  "press": { "release": "", "price": "", "description": "...", "features": [], "history": "", "video": "", "quotes": [], "credits": [] }
}
```

Alloy's `links.site` stays empty for now: its subdomain is the game itself, so it is `links.play`. When a game gets a separate marketing site, set `links.site`.

`art.hero` (1920×1080) and `art.tile` (960×540) are hand-made WebP files in `img/`, cut from the source stills with ffmpeg (nearest-neighbour for pixel art) when a game is added. They are committed, not built. The first pass makes `alloy-hero`, `alloy-tile`, `campers-hero` and `campers-tile`, and the old `img/alloy.webp` and `img/campers.webp` are deleted.

**All asset paths in templates and data are root-absolute** (`/css/site.css`, `/img/...`), so `404.html` works when it is served from any URL.

## Build and repo

- **Dependencies:** Eleventy 3 with `@11ty/eleventy-img` (press thumbnails only) and `@11ty/eleventy-plugin-rss`. Node ≥ 22.2 (`"engines": {"node": ">=22.2"}` in `package.json`; CI uses `node-version: 22`, which resolves to the latest 22.x). Nunjucks templates. One `css/site.css`. No client framework; one inline script (random hero art).
- **Passthrough copy** (`eleventy.config.js`, paths unchanged): `.htaccess`, `img/`, `css/`, `press/**/*.{png,jpg,webp,svg,mp4}` (press originals, logos, video), and `devlog/**/*.{png,jpg,gif,webp,mp4}` (post media). The `.htaccess` copy is load-bearing: without it, WordPress's `.htaccess` stays in charge after cutover.
- **Layout:** `_includes/` (base layout, partials), `_data/`, `devlog/`, `press/`, `img/`, `css/`, `scripts/check.mjs`, `eleventy.config.js`, `CLAUDE.md`, `.htaccess`, `.github/workflows/deploy.yml`.
- The current hand-written `index.html` is replaced. `img/og.jpg` and `.htaccess` are kept (the game images are re-cut, see Data); `.htaccess` gains `ErrorDocument 404 /404.html`.
- `_site/` and `node_modules/` are git-ignored (as is the already-ignored `.superpowers/`).

## Validation: `scripts/check.mjs`

Checks are split in two:
- **Data checks run inside the build.** `eleventy.config.js` throws, failing the build with a readable message:
  - for games, when it loads `_data/games.json` at config time and a game is missing `slug`, `name`, `hook`, `pitch`, `status`, `art.hero` or `art.tile`
  - for posts, in the `addCollection("posts")` callback, after frontmatter is parsed, when a post is missing a required field or its `game` isn't a known slug or `studio`
- **Link checks: `scripts/check.mjs`.** About 30 lines, no dependencies, run after the build and zip (`npm run check`; also in CI before deploy). It scans every `href` and `src` in `_site/**/*.html`, skips external URLs, `mailto:` and pure `#fragment`s, strips any query and fragment, and fails when the path doesn't resolve to a file in `_site` (directory URLs resolve to their `index.html`). The feed and the zips are ordinary files, so links to them are checked too.

Visual verification during development: Playwright screenshots at desktop (1366px) and phone (390px) widths of home, devlog index, a post, `/press/` and a game press page.

## Deploy

GitHub Actions on push to `main` (and manual dispatch):
1. Checkout, `setup-node` (22), `npm ci`, `npx @11ty/eleventy` (in practice step 1's build and step 2 run together as `npm run build`).
2. `npm run zip` runs `scripts/zip.mjs`, about 40 lines of Node with no dependencies. For each game slug in `games.json` whose `press/<slug>/images/` holds at least one file, it writes `_site/press/<slug>/<slug>-images.zip` (flat, file names only). It writes "stored" (uncompressed) entries with `zlib.crc32`, which needs Node ≥ 22.2; PNGs are already compressed, so deflate would gain nothing. It runs the same way locally (Windows, where Git Bash has no `zip`) and in CI. `npm run build` = Eleventy, then zip. Its self-check (`node scripts/zip.mjs --test`, also run in CI) writes a two-file zip to a temp dir and asserts the file names, sizes and CRCs read back from the central directory. In CI, `unzip -t` on the real zips also verifies they open.
3. `npm run check`, which also catches a zip link without a zip.
4. If `FTP_HOST` is set: SamKirkland/FTP-Deploy-Action v4.3.5 with `local-dir: ./_site/`, `server-dir: ./` (an FTP account rooted at `public_html`). The action keeps `.ftp-deploy-sync-state.json` on the server and deletes only files it uploaded earlier that have since left `_site`. WordPress files and subdomain folders are never touched; removing WordPress stays a manual step.

## Cutover (owner, with Claude's help)

1. In cPanel, back up home-directory files and the WordPress database.
2. Create the private GitHub repo `Atlaszmh/toothandscale-site`, push, and set `FTP_HOST`, `FTP_USERNAME` and `FTP_PASSWORD` for an account rooted at `public_html`.
3. Run the first deploy. The new `.htaccess` replaces WordPress's, so `index.html` serves.
4. Delete the WordPress files (`wp-admin/`, `wp-includes/`, `wp-content/`, `wp-*.php`, `xmlrpc.php`, `index.php`), leaving any subdomain folders.
5. Add the `press@toothandscale.com` forwarder and set `pressEmail`.
6. If the old page still shows, purge the Cloudflare cache.

## Out of scope

Changes to game subdomain sites; an Unhappy Campers site; Two Minute Empire; a newsletter backend; analytics (Cloudflare Web Analytics can be toggled in the dashboard later); a `/devlog` skill; devlog pagination or filters; a light theme.
