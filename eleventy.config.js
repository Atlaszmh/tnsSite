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
