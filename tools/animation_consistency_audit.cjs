'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const BUILDING_DIR = path.join(ROOT, 'assets', 'building_animations');

async function rawImage(input) {
  return sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function compareFrames(image, frame) {
  const frameWidth = image.info.width / 4;
  const height = image.info.height;
  let absoluteDifference = 0;
  let samples = 0;
  let alphaIntersection = 0;
  let alphaUnion = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const baseOffset = (y * image.info.width + x) * 4;
      const frameOffset = (y * image.info.width + frame * frameWidth + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        absoluteDifference += Math.abs(image.data[baseOffset + channel] - image.data[frameOffset + channel]);
        samples += 1;
      }
      const baseVisible = image.data[baseOffset + 3] > 8;
      const frameVisible = image.data[frameOffset + 3] > 8;
      if (baseVisible && frameVisible) alphaIntersection += 1;
      if (baseVisible || frameVisible) alphaUnion += 1;
    }
  }
  return {
    difference: absoluteDifference / Math.max(1, samples) / 255,
    alphaIou: alphaIntersection / Math.max(1, alphaUnion)
  };
}

async function auditBuildingAnimations() {
  const names = fs.readdirSync(BUILDING_DIR).filter((name) => name.endsWith('.png')).sort();
  const currentMetrics = [];
  const originalMetrics = [];
  for (const name of names) {
    const relativePath = `assets/building_animations/${name}`;
    const current = await rawImage(path.join(ROOT, relativePath));
    if (current.info.width !== current.info.height * 4) throw new Error(`${name} 不是横向四帧`);
    for (let frame = 1; frame < 4; frame += 1) currentMetrics.push(compareFrames(current, frame));

    try {
      const originalBuffer = execFileSync('git', ['show', `HEAD:${relativePath}`], { cwd: ROOT, encoding: null });
      const original = await rawImage(originalBuffer);
      for (let frame = 1; frame < 4; frame += 1) originalMetrics.push(compareFrames(original, frame));
    } catch (error) {
      // A Git baseline is useful locally but is not required in exported builds.
    }
  }

  const average = (list, key) => list.reduce((sum, item) => sum + item[key], 0) / Math.max(1, list.length);
  return {
    files: names.length,
    currentDifference: average(currentMetrics, 'difference'),
    currentAlphaIou: average(currentMetrics, 'alphaIou'),
    originalDifference: originalMetrics.length ? average(originalMetrics, 'difference') : null,
    originalAlphaIou: originalMetrics.length ? average(originalMetrics, 'alphaIou') : null
  };
}

function auditUnitCoverage() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'v160_asset_manifest.json'), 'utf8'));
  const patch = fs.readFileSync(path.join(ROOT, 'js', 'v150_art_patch.js'), 'utf8');
  const mapBody = patch.match(/const spriteMap = \{([\s\S]*?)\n  \};/);
  if (!mapBody) throw new Error('无法读取 spriteMap');
  const mapped = new Set(Array.from(mapBody[1].matchAll(/\b([a-z][a-z0-9_]*)\s*:\s*\['/g), (match) => match[1]));
  const unitIds = Object.keys(manifest.units || {});
  const missing = unitIds.filter((id) => !mapped.has(id));
  return { unitCards: unitIds.length, mapped: mapped.size, missing };
}

(async () => {
  const units = auditUnitCoverage();
  const buildings = await auditBuildingAnimations();
  console.log(`单位映射: ${units.mapped}/${units.unitCards}; 缺失: ${units.missing.join(', ') || '无'}`);
  console.log(`建筑图集: ${buildings.files}/21`);
  console.log(`当前跨帧平均像素差: ${(buildings.currentDifference * 100).toFixed(2)}%`);
  console.log(`当前轮廓 Alpha IoU: ${(buildings.currentAlphaIou * 100).toFixed(2)}%`);
  if (buildings.originalDifference !== null) {
    console.log(`Git 基线平均像素差: ${(buildings.originalDifference * 100).toFixed(2)}%`);
    console.log(`Git 基线轮廓 Alpha IoU: ${(buildings.originalAlphaIou * 100).toFixed(2)}%`);
  }
  if (units.missing.length || buildings.files !== 21 || buildings.currentAlphaIou < 0.9) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
