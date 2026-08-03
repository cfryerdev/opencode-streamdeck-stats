import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function crc32(buf) {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makePNG(width, height, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const src = ((y * width) + x) * 4;
      const dst = y * (width * 4 + 1) + 1 + x * 4;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ensureDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function savePNG(path, width, height, pixels) {
  ensureDir(path);
  writeFileSync(path, makePNG(width, height, pixels));
  console.log(`Wrote ${path} (${width}x${height})`);
}

// Draw the opencode "O" — a square ring — into a pixel buffer.
// Outer square from (ox,oy) to (ox+ow, oy+ow), with a centered square hole.
function drawO(px, W, H, ox, oy, ow, holeSize, r, g, b, a = 255) {
  const inset = (ow - holeSize) / 2;
  const hx1 = ox + inset;
  const hy1 = oy + inset;
  const hx2 = ox + inset + holeSize;
  const hy2 = oy + inset + holeSize;
  for (let y = oy; y < oy + ow; y++) {
    for (let x = ox; x < ox + ow; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const inside = x > hx1 && x < hx2 && y > hy1 && y < hy2;
      if (!inside) {
        const i = (y * W + x) * 4;
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
        px[i + 3] = a;
      }
    }
  }
}

// Plugin icon: 256x256 — dark background with white opencode "O"
function genPluginIcon() {
  const make = (size, path) => {
    const W = size, H = size;
    const px = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        px[i] = 26; px[i + 1] = 26; px[i + 2] = 36; px[i + 3] = 255;
      }
    }
    const outer = Math.round(size * 0.625);
    const offset = Math.round((size - outer) / 2);
    const hole = Math.round(outer * 0.5);
    drawO(px, W, H, offset, offset, outer, hole, 241, 236, 236, 255);
    savePNG(path, W, H, px);
  };

  make(256, "com.chrisfryer.opencode-stats.sdPlugin/plugin_icon.png");
  make(512, "com.chrisfryer.opencode-stats.sdPlugin/plugin_icon@2x.png");
}

// Action icon: 20x20 monochrome white "O" on transparent
function genActionIcon() {
  const make = (size, path) => {
    const W = size, H = size;
    const px = Buffer.alloc(W * H * 4);
    const outer = Math.round(size * 0.8);
    const offset = Math.round((size - outer) / 2);
    const hole = Math.round(outer * 0.5);
    drawO(px, W, H, offset, offset, outer, hole, 255, 255, 255, 255);
    savePNG(path, W, H, px);
  };

  make(20, "com.chrisfryer.opencode-stats.sdPlugin/imgs/actions/icon.png");
  make(40, "com.chrisfryer.opencode-stats.sdPlugin/imgs/actions/icon@2x.png");
}

// Category icon: 28x28 monochrome white "O" on transparent
function genCategoryIcon() {
  const make = (size, path) => {
    const W = size, H = size;
    const px = Buffer.alloc(W * H * 4);
    const outer = Math.round(size * 0.78);
    const offset = Math.round((size - outer) / 2);
    const hole = Math.round(outer * 0.5);
    drawO(px, W, H, offset, offset, outer, hole, 255, 255, 255, 255);
    savePNG(path, W, H, px);
  };

  make(28, "com.chrisfryer.opencode-stats.sdPlugin/category_icon.png");
  make(56, "com.chrisfryer.opencode-stats.sdPlugin/category_icon@2x.png");
}

// Key state image: 72x72 dark background with subtle opencode "O"
function genKeyImage() {
  const make = (size, path) => {
    const W = size, H = size;
    const px = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        px[i] = 26; px[i + 1] = 26; px[i + 2] = 36; px[i + 3] = 255;
      }
    }
    const outer = Math.round(size * 0.56);
    const offset = Math.round((size - outer) / 2);
    const hole = Math.round(outer * 0.5);
    drawO(px, W, H, offset, offset, outer, hole, 241, 236, 236, 50);
    savePNG(path, W, H, px);
  };

  make(72, "com.chrisfryer.opencode-stats.sdPlugin/imgs/actions/key.png");
  make(144, "com.chrisfryer.opencode-stats.sdPlugin/imgs/actions/key@2x.png");
}

genPluginIcon();
genActionIcon();
genCategoryIcon();
genKeyImage();
console.log("All icons generated.");
