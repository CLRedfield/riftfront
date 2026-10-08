'use strict';

const fs = require('node:fs');
const path = require('node:path');
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.error('缺少 sharp。请在可用的 Node 环境中安装 sharp，或设置 NODE_PATH 指向 Codex bundled node_modules。');
  process.exitCode = 1;
  throw error;
}

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'assets', 'sprite_sheets');
const OUTPUT_DIR = path.join(ROOT, 'assets', 'sprite_sheets_runtime');
const COLUMNS = 4;
const ROWS = 8;
const ALPHA_THRESHOLD = 16;
const SHEETS = [
  'fed_core.png',
  'fed_heavy.png',
  'swarm.png',
  'prism.png',
  'wasteland_frost.png',
  'jungle_magma.png',
  'steel_mirror_boss.png'
];

function frameBounds(width, height, frame, row) {
  const sx = Math.round(frame * width / COLUMNS);
  const ex = Math.round((frame + 1) * width / COLUMNS);
  const sy = Math.round(row * height / ROWS);
  const ey = Math.round((row + 1) * height / ROWS);
  return { sx, sy, sw: ex - sx, sh: ey - sy };
}

function isolateFrame(source, width, height, frame, row) {
  const bounds = frameBounds(width, height, frame, row);
  const rowHeight = height / ROWS;
  const overscan = Math.ceil(rowHeight * 0.64);
  const cropTop = Math.max(0, Math.floor(bounds.sy - overscan));
  const cropBottom = Math.min(height, Math.ceil(bounds.sy + rowHeight + overscan));
  const cropHeight = cropBottom - cropTop;
  const pixels = Buffer.alloc(bounds.sw * cropHeight * 4);

  for (let y = 0; y < cropHeight; y += 1) {
    const sourceOffset = ((cropTop + y) * width + bounds.sx) * 4;
    const targetOffset = y * bounds.sw * 4;
    source.copy(pixels, targetOffset, sourceOffset, sourceOffset + bounds.sw * 4);
  }

  const labels = new Int32Array(bounds.sw * cropHeight);
  const queue = new Int32Array(bounds.sw * cropHeight);
  const components = [];
  let label = 0;

  for (let start = 0; start < labels.length; start += 1) {
    if (labels[start] || pixels[start * 4 + 3] <= ALPHA_THRESHOLD) continue;
    label += 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = label;
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = bounds.sw;
    let minY = cropHeight;
    let maxX = 0;
    let maxY = 0;

    while (head < tail) {
      const index = queue[head++];
      const x = index % bounds.sw;
      const y = Math.floor(index / bounds.sw);
      area += 1;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < bounds.sw ? index + 1 : -1,
        y > 0 ? index - bounds.sw : -1,
        y + 1 < cropHeight ? index + bounds.sw : -1
      ];
      neighbors.forEach((neighbor) => {
        if (neighbor >= 0 && !labels[neighbor] && pixels[neighbor * 4 + 3] > ALPHA_THRESHOLD) {
          labels[neighbor] = label;
          queue[tail++] = neighbor;
        }
      });
    }
    components.push({ id: label, area, sumX, sumY, minX, minY, maxX, maxY });
  }

  const targetCenterY = (row + 0.5) * rowHeight;
  let main = null;
  let mainScore = -1;
  components.filter((component) => component.area >= 6).forEach((component) => {
    const centerGlobalY = cropTop + component.sumY / component.area;
    const distance = Math.abs(centerGlobalY - targetCenterY);
    const score = component.area / (1 + Math.pow(distance / (rowHeight * 0.34), 4));
    if (score > mainScore) { main = component; mainScore = score; }
  });

  if (!main) {
    throw new Error(`无法识别 frame=${frame}, row=${row} 的主体连通域`);
  }

  for (let index = 0; index < labels.length; index += 1) {
    if (labels[index] !== main.id) pixels[index * 4 + 3] = 0;
  }
  return {
    pixels,
    width: bounds.sw,
    height: cropHeight,
    anchorX: bounds.sw * 0.5,
    anchorY: targetCenterY - cropTop,
    minX: main.minX,
    minY: main.minY,
    maxX: main.maxX,
    maxY: main.maxY
  };
}

function cropRaw(source, width, left, top, cropWidth, cropHeight) {
  const output = Buffer.alloc(cropWidth * cropHeight * 4);
  for (let y = 0; y < cropHeight; y += 1) {
    const sourceOffset = ((top + y) * width + left) * 4;
    const targetOffset = y * cropWidth * 4;
    source.copy(output, targetOffset, sourceOffset, sourceOffset + cropWidth * 4);
  }
  return output;
}

async function renderCell(frame, outputSize, scale, offsetX, offsetY) {
  const scaledWidth = Math.max(1, Math.round(frame.width * scale));
  const scaledHeight = Math.max(1, Math.round(frame.height * scale));
  const resized = await sharp(frame.pixels, { raw: { width: frame.width, height: frame.height, channels: 4 } })
    .resize(scaledWidth, scaledHeight, { kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer();

  const rawLeft = Math.round(offsetX - frame.anchorX * scale);
  const rawTop = Math.round(offsetY - frame.anchorY * scale);
  const sourceLeft = Math.max(0, -rawLeft);
  const sourceTop = Math.max(0, -rawTop);
  const destinationLeft = Math.max(0, rawLeft);
  const destinationTop = Math.max(0, rawTop);
  const visibleWidth = Math.min(scaledWidth - sourceLeft, outputSize - destinationLeft);
  const visibleHeight = Math.min(scaledHeight - sourceTop, outputSize - destinationTop);
  const cell = sharp({ create: { width: outputSize, height: outputSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  if (visibleWidth <= 0 || visibleHeight <= 0) return cell.png().toBuffer();

  const visible = cropRaw(resized, scaledWidth, sourceLeft, sourceTop, visibleWidth, visibleHeight);
  return cell.composite([{
    input: visible,
    raw: { width: visibleWidth, height: visibleHeight, channels: 4 },
    left: destinationLeft,
    top: destinationTop
  }]).png().toBuffer();
}

async function buildSheet(filename) {
  const sourcePath = path.join(SOURCE_DIR, filename);
  const outputPath = path.join(OUTPUT_DIR, filename);
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const outputSize = Math.max(192, Math.round(info.width / COLUMNS));
  const composites = [];

  for (let row = 0; row < ROWS; row += 1) {
    const frames = [];
    let unionMinX = Infinity;
    let unionMinY = Infinity;
    let unionMaxX = -Infinity;
    let unionMaxY = -Infinity;
    for (let frame = 0; frame < COLUMNS; frame += 1) {
      const isolated = isolateFrame(data, info.width, info.height, frame, row);
      unionMinX = Math.min(unionMinX, isolated.minX - isolated.anchorX);
      unionMinY = Math.min(unionMinY, isolated.minY - isolated.anchorY);
      unionMaxX = Math.max(unionMaxX, isolated.maxX - isolated.anchorX);
      unionMaxY = Math.max(unionMaxY, isolated.maxY - isolated.anchorY);
      frames.push(isolated);
    }
    const unionWidth = Math.max(1, unionMaxX - unionMinX + 1);
    const unionHeight = Math.max(1, unionMaxY - unionMinY + 1);
    const scale = Math.min(outputSize * 0.94 / unionWidth, outputSize * 0.94 / unionHeight);
    const offsetX = outputSize * 0.5 - (unionMinX + unionMaxX) * 0.5 * scale;
    const offsetY = outputSize * 0.5 - (unionMinY + unionMaxY) * 0.5 * scale;

    for (let frame = 0; frame < COLUMNS; frame += 1) {
      composites.push({
        input: await renderCell(frames[frame], outputSize, scale, offsetX, offsetY),
        left: frame * outputSize,
        top: row * outputSize
      });
    }
  }

  await sharp({
    create: {
      width: outputSize * COLUMNS,
      height: outputSize * ROWS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).composite(composites).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(outputPath);
  console.log(`${filename}: ${info.width}×${info.height} -> ${outputSize * COLUMNS}×${outputSize * ROWS}`);
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const filename of SHEETS) await buildSheet(filename);
  console.log(`完成：${OUTPUT_DIR}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
