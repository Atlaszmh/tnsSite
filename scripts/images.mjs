import fs from "node:fs";

// Image files directly inside dir, sorted; [] when dir is missing. Shared by the build and zip.mjs
// so the press pages and the zips always list the same files.
export const listImages = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp|svg)$/i.test(f)).sort() : [];
