(function () {
  'use strict';

  const RF = window.RF;
  const proto = RF?.BattleEngine?.prototype;
  if (!RF || !proto) return;

  RF.VERSION = '1.6.3';
  const DECK_TEXTURE = 'assets/map_bg/rift_bridge_deck_v162.png';
  const OBSTACLE_ATLAS = 'assets/map_bg/terrain_obstacles_v162.png';
  const images = new Map();
  const getImage = (src) => {
    if (!images.has(src)) {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
      images.set(src, image);
    }
    return images.get(src);
  };
  const deckTexture = getImage(DECK_TEXTURE);
  const obstacleAtlas = getImage(OBSTACLE_ATLAS);

  const PROP_CELLS = Object.freeze({
    cargo: [0, 0],
    iceLake: [1, 0],
    iceRidge: [1, 0],
    rootMass: [2, 0],
    motherRoot: [2, 0],
    lavaChasm: [3, 0],
    factory: [0, 1],
    reactor: [1, 1],
    crystal: [2, 1],
    void: [1, 1],
    eclipse: [1, 1],
    obelisk: [2, 1],
    ruin: [0, 1],
    voidWall: [3, 1],
    throne: [0, 1],
    fallback: [3, 1]
  });

  function ready(image) {
    return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, radius);
      return;
    }
    const r = Math.min(radius, width * 0.5, height * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawPropCell(ctx, type, cx, cy, width, height, alpha = 1) {
    if (!ready(obstacleAtlas)) return false;
    const [column, row] = PROP_CELLS[type] || PROP_CELLS.fallback;
    const cellWidth = obstacleAtlas.naturalWidth / 4;
    const cellHeight = obstacleAtlas.naturalHeight / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      obstacleAtlas,
      column * cellWidth,
      row * cellHeight,
      cellWidth,
      cellHeight,
      cx - width * 0.5,
      cy - height * 0.5,
      width,
      height
    );
    ctx.restore();
    return true;
  }

  const oldDrawLanes = proto.drawLanes;
  proto.drawLanes = function drawTexturedLanes(ctx) {
    if (!ready(deckTexture)) return oldDrawLanes.call(this, ctx);
    const pattern = ctx.createPattern(deckTexture, 'repeat');
    if (!pattern) return oldDrawLanes.call(this, ctx);
    if (typeof pattern.setTransform === 'function' && typeof DOMMatrix !== 'undefined') {
      pattern.setTransform(new DOMMatrix().scale(0.19));
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.routes.forEach((route, lane) => {
      const width = Number(route.width || 108);

      // 深色投影只负责抬起桥面，不再用多层高亮粗描边模拟材质。
      ctx.shadowColor = 'rgba(0, 0, 0, .76)';
      ctx.shadowBlur = 22;
      ctx.strokeStyle = 'rgba(0, 3, 7, .78)';
      ctx.lineWidth = width + 20;
      this.drawRouteSegment(ctx, lane);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#17242d';
      ctx.lineWidth = width + 8;
      this.drawRouteSegment(ctx, lane);
      ctx.stroke();

      ctx.strokeStyle = pattern;
      ctx.lineWidth = width;
      this.drawRouteSegment(ctx, lane);
      ctx.stroke();

      // 两侧阵营染色压在材质之上，保留方向性但不盖住板材细节。
      ctx.globalAlpha = .28;
      ctx.strokeStyle = '#3faed2';
      ctx.lineWidth = width * .78;
      this.drawRouteSegment(ctx, lane, 245, 622);
      ctx.stroke();
      ctx.strokeStyle = '#bd6259';
      this.drawRouteSegment(ctx, lane, 658, 1035);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 桥面横向接缝既打散“粗管道”轮廓，也给移动方向提供稳定参照。
      for (let x = 318; x <= 962; x += 92) {
        const point = this.routePointAtX(lane, x);
        const angle = this.routeAngleAtX(lane, x);
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(angle + Math.PI * 0.5);
        ctx.strokeStyle = x < 640 ? 'rgba(126,220,245,.24)' : 'rgba(255,166,145,.21)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-width * .31, 0);
        ctx.lineTo(width * .31, 0);
        ctx.stroke();
        ctx.fillStyle = 'rgba(220,242,248,.28)';
        ctx.beginPath(); ctx.arc(-width * .34, 0, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(width * .34, 0, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      ctx.strokeStyle = 'rgba(219, 241, 247, .24)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 27]);
      ctx.lineDashOffset = -this.elapsed * 9;
      this.drawRouteSegment(ctx, lane);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      const labelPoint = this.routePointAtX(lane, 500);
      const label = `${route.short || `R-${lane + 1}`} · ${route.name}`;
      ctx.font = '800 11px system-ui, sans-serif';
      const labelWidth = Math.min(184, Math.max(100, ctx.measureText(label).width + 24));
      ctx.fillStyle = 'rgba(4, 12, 18, .80)';
      roundedRect(ctx, labelPoint.x - labelWidth / 2, labelPoint.y - width * .5 - 29, labelWidth, 21, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(226, 244, 250, .75)';
      ctx.textAlign = 'center';
      ctx.fillText(label, labelPoint.x, labelPoint.y - width * .5 - 14);
    });

    const relay = this.map.relay || [640, 360];
    const pulse = 0.92 + Math.sin(this.elapsed * 2.2) * 0.06;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(relay[0], relay[1], 2, relay[0], relay[1], 58);
    glow.addColorStop(0, 'rgba(173, 235, 255, .24)');
    glow.addColorStop(1, 'rgba(78, 184, 226, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(relay[0], relay[1], 58 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    drawPropCell(ctx, 'reactor', relay[0], relay[1], 78 * pulse, 78 * pulse, .92);
    ctx.fillStyle = 'rgba(231, 249, 255, .86)';
    ctx.font = '900 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SYNC', relay[0], relay[1] + 4);

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(225, 244, 250, .48)';
    ctx.font = '800 10px system-ui, sans-serif';
    ctx.fillText(`RF // ${this.map.name} // ROUTES ${String(this.routeCount).padStart(2, '0')}`, 96, 602);
    ctx.restore();
  };

  const oldDrawMapObstacles = proto.drawMapObstacles;
  proto.drawMapObstacles = function drawGeneratedTerrainProps(ctx) {
    if (!ready(obstacleAtlas)) return oldDrawMapObstacles.call(this, ctx);
    this.obstacles.forEach((obstacle) => {
      const circle = obstacle.shape === 'circle';
      const cx = circle ? Number(obstacle.x) : Number(obstacle.x) + Number(obstacle.w) * 0.5;
      const cy = circle ? Number(obstacle.y) : Number(obstacle.y) + Number(obstacle.h) * 0.5;
      const rawWidth = circle ? Number(obstacle.r) * 2 : Number(obstacle.w);
      const rawHeight = circle ? Number(obstacle.r) * 2 : Number(obstacle.h);
      const wide = obstacle.type === 'iceLake' || obstacle.type === 'iceRidge' || obstacle.type === 'lavaChasm';
      const wallLike = !circle && rawWidth / Math.max(1, rawHeight) > 2;
      const width = rawWidth * (wide ? 1.34 : wallLike ? 1.12 : 1.28);
      const height = wallLike
        ? Math.max(rawHeight * 1.52, rawWidth * 0.42)
        : rawHeight * (wide ? 1.34 : 1.55);

      ctx.save();
      ctx.globalAlpha = .30;
      ctx.fillStyle = '#010408';
      ctx.beginPath();
      ctx.ellipse(cx, cy + rawHeight * .18, rawWidth * .56, rawHeight * .34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawPropCell(ctx, obstacle.type, cx, cy, width, height);

      if (obstacle.label) {
        ctx.save();
        ctx.font = '750 9px system-ui, sans-serif';
        const labelWidth = Math.max(48, ctx.measureText(obstacle.label).width + 16);
        ctx.fillStyle = 'rgba(3, 10, 15, .72)';
        roundedRect(ctx, cx - labelWidth * .5, cy + rawHeight * .28, labelWidth, 17, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(229, 246, 251, .68)';
        ctx.textAlign = 'center';
        ctx.fillText(obstacle.label, cx, cy + rawHeight * .28 + 12);
        ctx.restore();
      }
    });
  };
})();
