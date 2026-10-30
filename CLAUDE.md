# toothandscale.com

The Tooth and Scale studio site: an Eleventy 3 static site, FTP-deployed to `public_html` on push to `main` (`.github/workflows/deploy.yml`). The design spec is `docs/superpowers/specs/2026-10-29-studio-site-design.md`.

## Commands
- `npm run serve`: dev server at http://localhost:8080. Restart it after adding press images or games, because those lists are read when the config loads.
- `npm run build`: clean build to `_site/` plus the press zips.
- `npm run check`: required files present and every internal link resolves. Run it after every build.
- `npm test`: self-checks for `scripts/zip.mjs` and `scripts/check.mjs`.

## Where things live
- Studio facts, channels and the press email: `_data/site.json`. Games: `_data/games.json`. **An empty string hides that link or section everywhere.** Never add placeholder text; the only allowed placeholder is "TBA" for release and price, which the templates handle.
- Never put an email address anywhere in the site (pages, templates, feeds, devlog posts).
- `.htaccess` is inherited by other live sites nested in public_html (hellolittlewolf.net WordPress, hlw/). Never drop `index.php` from `DirectoryIndex` or the cPanel PHP handler block. If the PHP version is changed in cPanel, copy the new handler block from the server into this file, or the next deploy reverts it.
- Adding a game: add a `games.json` entry (required: `slug`, `name`, `hook`, `pitch`, `status`, `art.hero`, `art.tile`), cut `img/<slug>-hero.webp` (≥1280 wide) and `img/<slug>-tile.webp` (960×540) with ffmpeg (`flags=neighbor` for pixel art), and add press screenshots to `press/<slug>/images/` (full-size PNG). Games with `pixelArt: true` get lossless nearest-neighbour press thumbnails.
- Press wordmark PNGs in `press/studio/` were rendered in a browser with the site fonts (Silkscreen, plus Bricolage Grotesque 800 in orange `#ff6b3d` for the "&"), not with ffmpeg. Silkscreen's own & looks like a dollar sign, so the wordmark's & is always set in Bricolage. In HTML that is `TOOTH <span>&amp;</span> SCALE` inside `.wordmark`.
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
   The build fails if `title`, `game`, `summary` or `cover` is missing, or `game` is unknown.
   - `date` is optional: the folder prefix is the source of truth. The build fails if the folder has no `YYYY-MM-DD-` prefix or a frontmatter `date` disagrees with it.
   - `cover` must be a bare filename that sits next to `index.md` (for example `cover.png`), because templates build `post.url + cover`.
4. Media goes in the same folder, referenced relatively (`![Alt text](combust.png)`):
   - cover: 1200×630, ideally `cover.jpg` around 200 KB (it loads on every card and in link previews; pixel-art covers can stay PNG)
   - images: ≤1920px wide; only png, jpg, jpeg, gif, webp, svg, mp4 and webm are copied to the site. For pixel art scale with `flags=neighbor`
   - clips: `.mp4` (H.264, `-movflags +faststart`, keep each under ~8 MB), embedded as `<video src="clip.mp4" controls muted loop playsinline></video>`
   - YouTube: a plain `<iframe>` with a `youtube-nocookie.com/embed/<id>` src
   - every image gets real alt text
5. `npm run build && npm run check`, then `npm run serve` and screenshot the post at 1366px and 390px. Show the owner the screenshots and the post text.
6. Only after the owner approves: merge to `main` and push. That deploys. Never push a post to `main` without approval.

## Voice
First person singular ("I"), since the studio is one person. Plain and specific: say what changed, why, and what it plays like, with real numbers (counts, timings, percentages) over adjectives. Be honest about what's unfinished or didn't work. No hype words ("epic", "revolutionary", "game-changing"), no exclamation marks, no "stay tuned". Short paragraphs; one idea each. End with what's next, in a sentence. Reference voice: the Reddit devlog copy in `C:\Projects\Alloy\marketing\2026-10-17-fun-30s-social\copy.md`. The owner edits this section as the voice settles.
