const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const zlib = require('zlib');

function readPng(filePath) {
  const buf = fs.readFileSync(filePath);
  const png = PNG.sync.read(buf);
  return png; // { width, height, data: Buffer RGBA }
}

function blankCanvas(width, height, [r, g, b]) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

// Area-average downscale resize (correct for downscaling only).
function resizeDown(src, targetW, targetH) {
  const out = Buffer.alloc(targetW * targetH * 4);
  const scaleX = src.width / targetW;
  const scaleY = src.height / targetH;
  for (let ty = 0; ty < targetH; ty++) {
    const sy0 = Math.floor(ty * scaleY);
    const sy1 = Math.max(sy0 + 1, Math.floor((ty + 1) * scaleY));
    for (let tx = 0; tx < targetW; tx++) {
      const sx0 = Math.floor(tx * scaleX);
      const sx1 = Math.max(sx0 + 1, Math.floor((tx + 1) * scaleX));
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        count = 0;
      for (let sy = sy0; sy < sy1 && sy < src.height; sy++) {
        for (let sx = sx0; sx < sx1 && sx < src.width; sx++) {
          const idx = (sy * src.width + sx) * 4;
          r += src.data[idx];
          g += src.data[idx + 1];
          b += src.data[idx + 2];
          a += src.data[idx + 3];
          count++;
        }
      }
      const oIdx = (ty * targetW + tx) * 4;
      out[oIdx] = Math.round(r / count);
      out[oIdx + 1] = Math.round(g / count);
      out[oIdx + 2] = Math.round(b / count);
      out[oIdx + 3] = Math.round(a / count);
    }
  }
  return { width: targetW, height: targetH, data: out };
}

// Straight-copy resize for exact same size (no-op but keeps interface uniform).
function identity(src) {
  return { width: src.width, height: src.height, data: Buffer.from(src.data) };
}

function blitOver(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width) continue;
      const sIdx = (y * src.width + x) * 4;
      const dIdx = (ty * dst.width + tx) * 4;
      const sa = src.data[sIdx + 3] / 255;
      if (sa <= 0) continue;
      for (let c = 0; c < 3; c++) {
        dst.data[dIdx + c] = Math.round(
          src.data[sIdx + c] * sa + dst.data[dIdx + c] * (1 - sa)
        );
      }
      dst.data[dIdx + 3] = Math.min(
        255,
        Math.round(sa * 255 + dst.data[dIdx + 3] * (1 - sa))
      );
    }
  }
}

function writePng(image, filePath, opaque) {
  const png = new PNG({ width: image.width, height: image.height });
  image.data.copy(png.data);
  if (opaque) {
    for (let i = 0; i < image.width * image.height; i++) {
      png.data[i * 4 + 3] = 255;
    }
  }
  const buf = PNG.sync.write(png, { colorType: opaque ? 2 : 6 });
  fs.writeFileSync(filePath, buf);
}

function verify(image, label) {
  function px(x, y) {
    const idx = (y * image.width + x) * 4;
    return [
      image.data[idx],
      image.data[idx + 1],
      image.data[idx + 2],
      image.data[idx + 3],
    ];
  }
  const cx = Math.floor(image.width / 2),
    cy = Math.floor(image.height / 2);
  console.log(
    `[verify] ${label} ${image.width}x${image.height} corner=${px(
      2,
      2
    )} center=${px(cx, cy)}`
  );
}

module.exports = {
  readPng,
  blankCanvas,
  resizeDown,
  identity,
  blitOver,
  writePng,
  verify,
};
