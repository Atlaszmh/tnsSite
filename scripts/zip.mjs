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
