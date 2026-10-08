(async function () {
  'use strict';

  const audit = document.getElementById('audit');
  const runtime = window.RF?.UNIT_SPRITE_RUNTIME;
  if (!runtime) {
    audit.innerHTML = '<p class="error">运行时切帧接口未加载。</p>';
    return;
  }

  const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法读取 ${src}`));
    image.src = `../${src}`;
  });

  const loadedSheets = {};
  await Promise.all(Object.entries(runtime.sheets).map(async ([key, src]) => {
    loadedSheets[key] = await loadImage(src);
  }));

  const cardsBySheetAndRow = new Map();
  Object.entries(runtime.sprites).forEach(([cardId, config]) => {
    const [sheetKey, row] = config;
    const key = `${sheetKey}:${row}`;
    if (!cardsBySheetAndRow.has(key)) cardsBySheetAndRow.set(key, []);
    cardsBySheetAndRow.get(key).push(cardId);
  });

  const fragment = document.createDocumentFragment();
  Object.entries(runtime.sheets).forEach(([sheetKey, src]) => {
    const section = document.createElement('section');
    const title = document.createElement('h2');
    title.textContent = `${sheetKey} · ${src}`;
    section.appendChild(title);
    const rows = document.createElement('div');
    rows.className = 'rows';

    const mappedRows = Array.from({ length: runtime.rows }, (_, row) => row)
      .filter((row) => cardsBySheetAndRow.has(`${sheetKey}:${row}`));
    for (const row of mappedRows) {
      const unit = document.createElement('article');
      unit.className = 'unit';
      const cardIds = cardsBySheetAndRow.get(`${sheetKey}:${row}`) || [];
      const meta = document.createElement('div');
      meta.className = 'unit-meta';
      meta.innerHTML = `<strong>${cardIds.join(' / ') || `未映射行 ${row}`}</strong><code>${sheetKey} · row ${row}</code>`;
      unit.appendChild(meta);

      const canvas = document.createElement('canvas');
      const cell = 144;
      canvas.width = cell * runtime.columns;
      canvas.height = cell;
      canvas.setAttribute('aria-label', `${sheetKey} 第 ${row} 行的局内四帧`);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      for (let frame = 0; frame < runtime.columns; frame += 1) {
        const x = frame * cell;
        const background = ctx.createRadialGradient(x + cell / 2, cell * .44, 4, x + cell / 2, cell * .5, cell * .62);
        background.addColorStop(0, frame === 2 ? '#273022' : '#142635');
        background.addColorStop(1, '#071019');
        ctx.fillStyle = background;
        ctx.fillRect(x, 0, cell, cell);
        ctx.strokeStyle = 'rgba(135, 220, 250, .14)';
        ctx.strokeRect(x + .5, .5, cell - 1, cell - 1);

        const isolatedFrame = runtime.getIsolatedFrame(sheetKey, loadedSheets[sheetKey], frame, row);
        const size = 126;
        ctx.save();
        ctx.translate(x + cell / 2, cell / 2);
        ctx.scale(frame === 3 ? -1 : 1, 1);
        ctx.drawImage(isolatedFrame, -size * .52, -size * .72, size, size);
        ctx.restore();

        ctx.fillStyle = 'rgba(225, 246, 252, .72)';
        ctx.font = '700 10px system-ui, sans-serif';
        ctx.fillText(`F${frame}${frame === 3 ? ' · 敌方向' : ''}`, x + 8, 14);
        ctx.strokeStyle = 'rgba(118, 217, 250, .34)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x + 12, cell * .79);
        ctx.lineTo(x + cell - 12, cell * .79);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      unit.appendChild(canvas);
      rows.appendChild(unit);
    }
    section.appendChild(rows);
    fragment.appendChild(section);
  });

  const buildingAnimations = window.RF?.BUILDING_ANIMATIONS || {};
  if (Object.keys(buildingAnimations).length) {
    const section = document.createElement('section');
    const title = document.createElement('h2');
    title.textContent = `stable buildings · ${Object.keys(buildingAnimations).length} atlases`;
    section.appendChild(title);
    const rows = document.createElement('div');
    rows.className = 'rows';

    for (const [buildingId, src] of Object.entries(buildingAnimations)) {
      const image = await loadImage(src);
      const unit = document.createElement('article');
      unit.className = 'unit';
      const meta = document.createElement('div');
      meta.className = 'unit-meta';
      meta.innerHTML = `<strong>${buildingId}</strong><code>${src}</code>`;
      unit.appendChild(meta);

      const canvas = document.createElement('canvas');
      const cell = 144;
      canvas.width = cell * 4;
      canvas.height = cell;
      canvas.setAttribute('aria-label', `${buildingId} 的稳定四帧`);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const sourceCellWidth = image.naturalWidth / 4;
      for (let frame = 0; frame < 4; frame += 1) {
        const x = frame * cell;
        const background = ctx.createRadialGradient(x + cell / 2, cell * .45, 4, x + cell / 2, cell * .5, cell * .65);
        background.addColorStop(0, '#173044');
        background.addColorStop(1, '#071019');
        ctx.fillStyle = background;
        ctx.fillRect(x, 0, cell, cell);
        ctx.drawImage(image, frame * sourceCellWidth, 0, sourceCellWidth, image.naturalHeight, x + 4, 4, cell - 8, cell - 8);
        ctx.fillStyle = 'rgba(225, 246, 252, .72)';
        ctx.font = '700 10px system-ui, sans-serif';
        ctx.fillText(`F${frame}`, x + 8, 14);
      }
      unit.appendChild(canvas);
      rows.appendChild(unit);
    }
    section.appendChild(rows);
    fragment.appendChild(section);
  }

  audit.replaceChildren(fragment);
})();
