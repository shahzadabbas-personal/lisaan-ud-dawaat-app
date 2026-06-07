// Generates simple PNG app icons (no external deps) using zlib.
// Dark-green tile with a centered cream crescent-ish disc.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const BG = [11, 61, 46]; // #0b3d2e
const FG = [240, 233, 212]; // cream

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function makePng(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const cx = size * 0.5;
  const cy = size * 0.5;
  const rOuter = size * 0.34;
  // offset cut circle to suggest a crescent
  const ox = size * 0.6;
  const oy = size * 0.42;
  const rCut = size * 0.3;
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter byte: none
    for (let x = 0; x < size; x++) {
      const inDisc = (x - cx) ** 2 + (y - cy) ** 2 <= rOuter ** 2;
      const inCut = (x - ox) ** 2 + (y - oy) ** 2 <= rCut ** 2;
      const fg = inDisc && !inCut;
      const c = fg ? FG : BG;
      raw[p++] = c[0];
      raw[p++] = c[1];
      raw[p++] = c[2];
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  writeFileSync(join(outDir, name), makePng(size));
  console.log("wrote", name);
}
