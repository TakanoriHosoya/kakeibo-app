// アプリアイコン（青地に白い ¥）を public/ へ書き出す。
// 依存パッケージを増やさないよう、PNG は zlib だけで組み立てている。
//
//   node scripts/generate-icons.mjs
//
// デザインを変えたいときはこのファイルを直して再実行する。出力はコミットしてある。

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BACKGROUND = [26, 115, 232]; // #1a73e8 アプリのアクセント色
const FOREGROUND = [255, 255, 255];

// --- 図形の距離関数（0 以下なら図形の内側） ---

// 角丸の四角形。cx,cy 中心、half は一辺の半分、r は角の半径
function roundedRectDistance(x, y, cx, cy, half, r) {
  const dx = Math.abs(x - cx) - (half - r);
  const dy = Math.abs(y - cy) - (half - r);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - r;
}

// 太さのある線分（両端は丸い）
function capsuleDistance(x, y, x1, y1, x2, y2, thickness) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lengthSquared = vx * vx + vy * vy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / lengthSquared));
  return Math.hypot(x - (x1 + t * vx), y - (y1 + t * vy)) - thickness / 2;
}

// ¥ の字形。cx,cy を中心に、高さ h で描く
function yenDistance(x, y, cx, cy, h) {
  const w = h * 0.86;
  const thickness = h * 0.13;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  const junction = cy - h * 0.04; // 2本の斜線が合流する高さ

  return Math.min(
    capsuleDistance(x, y, cx - w / 2, top, cx, junction, thickness),      // 左の斜線
    capsuleDistance(x, y, cx + w / 2, top, cx, junction, thickness),      // 右の斜線
    capsuleDistance(x, y, cx, junction, cx, bottom, thickness),           // 縦棒
    capsuleDistance(x, y, cx - w * 0.33, cy + h * 0.14, cx + w * 0.33, cy + h * 0.14, thickness), // 横棒（上）
    capsuleDistance(x, y, cx - w * 0.33, cy + h * 0.34, cx + w * 0.33, cy + h * 0.34, thickness), // 横棒（下）
  );
}

// --- 描画 ---

// maskable はプラットフォーム側で丸く切り抜かれるので、角丸を付けず字も小さめにする
function renderIcon(size, { maskable = false } = {}) {
  const samples = 3; // 1ピクセルあたり 3x3 で見て輪郭を滑らかにする
  const center = size / 2;
  const cornerRadius = maskable ? 0 : size * 0.22;
  const glyphHeight = size * (maskable ? 0.40 : 0.52);

  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let background = 0;
      let foreground = 0;

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = px + (sx + 0.5) / samples;
          const y = py + (sy + 0.5) / samples;
          if (roundedRectDistance(x, y, center, center, center, cornerRadius) <= 0) background++;
          if (yenDistance(x, y, center, center, glyphHeight) <= 0) foreground++;
        }
      }

      const total = samples * samples;
      const bgAlpha = background / total;
      const fgAlpha = (foreground / total) * bgAlpha; // 背景の外へはみ出させない

      const offset = (py * size + px) * 4;
      for (let c = 0; c < 3; c++) {
        // 背景色の上に前景色を重ねた結果を求める
        pixels[offset + c] = Math.round(BACKGROUND[c] * (1 - fgAlpha) + FOREGROUND[c] * fgAlpha);
      }
      pixels[offset + 3] = Math.round(bgAlpha * 255);
    }
  }

  return pixels;
}

// --- PNG の組み立て ---

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(pixels, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;  // ビット深度
  header[9] = 6;  // カラータイプ RGBA
  header[10] = 0; // 圧縮方式
  header[11] = 0; // フィルタ方式
  header[12] = 0; // インターレースなし

  // 各行の先頭にフィルタ種別（0 = なし）を足す
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- 出力 ---

const targets = [
  { file: 'icon-192.png', size: 192, options: {} },
  { file: 'icon-512.png', size: 512, options: {} },
  { file: 'icon-maskable-512.png', size: 512, options: { maskable: true } },
  { file: 'apple-touch-icon.png', size: 180, options: {} },
];

mkdirSync(PUBLIC_DIR, { recursive: true });

for (const { file, size, options } of targets) {
  const png = encodePng(renderIcon(size, options), size);
  writeFileSync(join(PUBLIC_DIR, file), png);
  console.log(`${file} (${size}x${size}, ${png.length} bytes)`);
}
