'use strict';

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'assets', 'source_sprites_gptimage2');
const RUNTIME_DIR = path.join(ROOT, 'assets', 'sprite_sheets_runtime');
const BUILDING_DIR = path.join(ROOT, 'assets', 'building_animations');
const CELL = 222;
const SHEET_ROWS = 8;
const ALPHA_THRESHOLD = 8;

const SHADOW_UNITS = [
  'shadow_hounds',
  'shadow_sentinels',
  'shadow_seers',
  'shadow_stalkers',
  'shadow_lurker',
  'shadow_archon',
  'shadow_eye',
  'shadow_wraith'
];

async function alphaBounds(input, width, height) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] <= ALPHA_THRESHOLD) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

async function splitTwoByTwo(sourcePath) {
  const meta = await sharp(sourcePath).metadata();
  const cellWidth = Math.floor(meta.width / 2);
  const cellHeight = Math.floor(meta.height / 2);
  const quadrants = [
    [0, 0],
    [cellWidth, 0],
    [0, cellHeight],
    [cellWidth, cellHeight]
  ];
  const rawFrames = await Promise.all(quadrants.map(([left, top]) => (
    sharp(sourcePath)
      .extract({ left, top, width: cellWidth, height: cellHeight })
      .ensureAlpha()
      .png()
      .toBuffer()
  )));

  const bounds = await Promise.all(rawFrames.map((frame) => alphaBounds(frame, cellWidth, cellHeight)));
  const validBounds = bounds.filter(Boolean);
  if (validBounds.length !== 4) throw new Error(`四帧透明主体识别失败: ${sourcePath}`);

  // All four frames keep the exact same crop rectangle. This preserves GPT Image's
  // in-cell motion while preventing per-frame auto-crop from producing visible zoom.
  const union = validBounds.reduce((result, box) => ({
    minX: Math.min(result.minX, box.minX),
    minY: Math.min(result.minY, box.minY),
    maxX: Math.max(result.maxX, box.maxX),
    maxY: Math.max(result.maxY, box.maxY)
  }), { minX: cellWidth, minY: cellHeight, maxX: 0, maxY: 0 });
  const padding = Math.ceil(Math.max(union.maxX - union.minX, union.maxY - union.minY) * 0.045);
  const left = Math.max(0, union.minX - padding);
  const top = Math.max(0, union.minY - padding);
  const right = Math.min(cellWidth - 1, union.maxX + padding);
  const bottom = Math.min(cellHeight - 1, union.maxY + padding);
  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;

  return Promise.all(rawFrames.map((frame) => (
    sharp(frame)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer()
  )));
}

async function buildShadowSheet(outputName, unitIds) {
  const composites = [];
  for (let row = 0; row < unitIds.length; row += 1) {
    const sourcePath = path.join(SOURCE_DIR, `${unitIds[row]}.png`);
    const frames = await splitTwoByTwo(sourcePath);
    frames.forEach((input, frame) => composites.push({ input, left: frame * CELL, top: row * CELL }));
  }

  await sharp({
    create: {
      width: CELL * 4,
      height: CELL * SHEET_ROWS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(RUNTIME_DIR, outputName));
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

async function findEnergyAnchor(frame) {
  const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sumWeight = 0;
  let sumX = 0;
  let sumY = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let y = 0; y < info.height * 0.88; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const alpha = data[offset + 3] / 255;
      const high = Math.max(r, g, b);
      const low = Math.min(r, g, b);
      const saturation = high - low;
      const weight = alpha * Math.max(0, high - 108) * (0.35 + saturation / 255);
      if (weight <= 0) continue;
      sumWeight += weight;
      sumX += x * weight;
      sumY += y * weight;
      sumR += r * weight;
      sumG += g * weight;
      sumB += b * weight;
    }
  }
  if (!sumWeight) return { x: info.width * 0.5, y: info.height * 0.45, color: '#8fddff' };
  return {
    x: sumX / sumWeight,
    y: sumY / sumWeight,
    color: rgbToHex({ r: sumR / sumWeight, g: sumG / sumWeight, b: sumB / sumWeight })
  };
}

function energyOverlay(width, height, anchor, level) {
  const opacity = [0, 0.12, 0.20, 0.30][level];
  const radius = [0, 24, 34, 46][level];
  const ringOpacity = [0, 0.20, 0.30, 0.42][level];
  const sparkOpacity = level === 3 ? 0.36 : 0;
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="pulse">
          <stop offset="0" stop-color="#ffffff" stop-opacity="${opacity * 1.35}"/>
          <stop offset="0.28" stop-color="${anchor.color}" stop-opacity="${opacity}"/>
          <stop offset="1" stop-color="${anchor.color}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="${anchor.x.toFixed(1)}" cy="${anchor.y.toFixed(1)}" r="${radius}" fill="url(#pulse)"/>
      <ellipse cx="${anchor.x.toFixed(1)}" cy="${anchor.y.toFixed(1)}" rx="${radius * 0.70}" ry="${radius * 0.28}"
        fill="none" stroke="${anchor.color}" stroke-opacity="${ringOpacity}" stroke-width="${Math.max(1.2, level)}"/>
      <g stroke="#ffffff" stroke-opacity="${sparkOpacity}" stroke-width="2" stroke-linecap="round">
        <path d="M ${anchor.x - radius * 0.88} ${anchor.y} L ${anchor.x - radius * 0.55} ${anchor.y}"/>
        <path d="M ${anchor.x + radius * 0.55} ${anchor.y} L ${anchor.x + radius * 0.88} ${anchor.y}"/>
        <path d="M ${anchor.x} ${anchor.y - radius * 0.88} L ${anchor.x} ${anchor.y - radius * 0.55}"/>
      </g>
    </svg>`);
}

async function stabilizeBuilding(filePath) {
  const meta = await sharp(filePath).metadata();
  if (meta.width !== meta.height * 4) {
    throw new Error(`建筑图集不是横向四帧: ${filePath} (${meta.width}x${meta.height})`);
  }
  const base = await sharp(filePath)
    .extract({ left: 0, top: 0, width: meta.height, height: meta.height })
    .ensureAlpha()
    .png()
    .toBuffer();
  const anchor = await findEnergyAnchor(base);
  const brightness = [1, 1.015, 1.03, 1.055];
  const saturation = [1, 1.025, 1.05, 1.08];
  const frames = [];
  for (let level = 0; level < 4; level += 1) {
    let frame = sharp(base).modulate({ brightness: brightness[level], saturation: saturation[level] });
    if (level > 0) {
      frame = frame.composite([{ input: energyOverlay(meta.height, meta.height, anchor, level), blend: 'screen' }]);
    }
    frames.push(await frame.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer());
  }
  const tempPath = `${filePath}.stable.tmp.png`;
  await sharp({
    create: {
      width: meta.width,
      height: meta.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(frames.map((input, index) => ({ input, left: index * meta.height, top: 0 })))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(tempPath);
  fs.renameSync(tempPath, filePath);
}

async function main() {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  await buildShadowSheet('shadow.png', SHADOW_UNITS);
  await buildShadowSheet('shadow_boss.png', ['boss_eclipse_sovereign']);

  const buildingFiles = fs.readdirSync(BUILDING_DIR)
    .filter((name) => name.toLowerCase().endsWith('.png'))
    .sort();
  for (const name of buildingFiles) await stabilizeBuilding(path.join(BUILDING_DIR, name));

  console.log(`影渊单位: ${SHADOW_UNITS.length + 1} 个独立四帧`);
  console.log(`稳定建筑: ${buildingFiles.length} 张四帧图集`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
