(function () {
  'use strict';

  const RF = window.RF = window.RF || {};
  RF.VERSION = '1.5.0';

  const SHEETS = {
    fedCore: 'assets/sprite_sheets/fed_core.png',
    fedHeavy: 'assets/sprite_sheets/fed_heavy.png',
    swarm: 'assets/sprite_sheets/swarm.png',
    prism: 'assets/sprite_sheets/prism.png',
    wastelandFrost: 'assets/sprite_sheets/wasteland_frost.png',
    jungleMagma: 'assets/sprite_sheets/jungle_magma.png',
    steelMirror: 'assets/sprite_sheets/steel_mirror_boss.png'
  };

  const MAP_ATLASES = {
    iceJungle: 'assets/map_bg/atlas_ice_jungle.png',
    magmaSteelDock: 'assets/map_bg/atlas_magma_steel_dock.png',
    mirrorCoreExtra: 'assets/map_bg/atlas_mirror_core_extra.png'
  };

  const spriteMap = {
    scouts: ['fedCore', 0], rifle_squad: ['fedCore', 1], shield_squad: ['fedCore', 2], raiders: ['fedCore', 3],
    field_medic: ['fedCore', 4], drone_swarm: ['fedCore', 5], flamers: ['fedCore', 6], sniper: ['fedCore', 7],
    mortar_team: ['fedHeavy', 0], interceptors: ['fedHeavy', 1], assault_mech: ['fedHeavy', 2], siege_tank: ['fedHeavy', 3],
    shock_troopers: ['fedHeavy', 4], titan: ['fedHeavy', 5], fed_guardian_squad: ['fedHeavy', 6], fed_skyriders: ['fedHeavy', 7],
    fed_engineer_team: ['fedCore', 4], fed_rail_tank: ['fedHeavy', 3],
    spore_runners: ['swarm', 0], thorn_guard: ['swarm', 1], mycelium_archer: ['swarm', 2], brood_nurse: ['swarm', 3],
    vine_ambush: ['swarm', 4], devourer_alpha: ['swarm', 5], bloom_colossus: ['swarm', 6], swarm_ancient: ['swarm', 7],
    swarm_raiders: ['swarm', 0], swarm_thorn_guard: ['swarm', 1], swarm_bloom_sage: ['swarm', 3],
    prism_acolyte: ['prism', 0], mirror_blades: ['prism', 1], crystal_guard: ['prism', 2], phase_drone: ['prism', 3],
    prism_medic: ['prism', 4], shard_knight: ['prism', 5], crystal_titan: ['prism', 6], prism_phase_knights: ['prism', 7],
    prism_adepts: ['prism', 0], prism_restorers: ['prism', 4], prism_shard_host: ['prism', 6],
    enemy_scrapper: ['wastelandFrost', 0], enemy_gunner: ['wastelandFrost', 1], enemy_brute: ['wastelandFrost', 2],
    frostling: ['wastelandFrost', 3], ice_guard: ['wastelandFrost', 4], frost_mage: ['wastelandFrost', 5], snow_beast: ['wastelandFrost', 6], boss_frost_giant: ['wastelandFrost', 7],
    jungle_stalker: ['jungleMagma', 0], spore_thrower: ['jungleMagma', 1], vine_beast: ['jungleMagma', 2], devourer: ['jungleMagma', 3],
    magma_imp: ['jungleMagma', 4], obsidian_guard: ['jungleMagma', 5], fire_bug: ['jungleMagma', 6], lava_carrier: ['jungleMagma', 7],
    furnace_priest: ['steelMirror', 0], boss_magma_colossus: ['steelMirror', 1], steel_drone: ['steelMirror', 2], shield_bot: ['steelMirror', 3],
    gunwalker: ['steelMirror', 4], boss_hive_mind: ['steelMirror', 5], mirror_sentry: ['steelMirror', 6], mirror_knight: ['steelMirror', 7], boss_core_avatar: ['steelMirror', 7],
    treasure_clone_fleet: ['fedCore', 5], treasure_omega_titan: ['fedHeavy', 5]
  };

  const spriteAliases = {
    drone: ['fedCore', 5], firebug: ['jungleMagma', 6], beast: ['jungleMagma', 2], imp: ['jungleMagma', 4],
    spore: ['swarm', 0], vine: ['swarm', 4], devourer: ['swarm', 5], frostling: ['wastelandFrost', 3],
    walker: ['steelMirror', 4], tank: ['fedHeavy', 3], mech: ['fedHeavy', 2], titan: ['fedHeavy', 5],
    mirrorKnight: ['steelMirror', 7], stalker: ['jungleMagma', 0], brute: ['wastelandFrost', 2]
  };

  const mapBackgrounds = {
    frost_gates: ['iceJungle', 0, 0], frost_trident: ['iceJungle', 1, 0], jungle_basin: ['iceJungle', 0, 1], jungle_ring: ['iceJungle', 1, 1],
    magma_bridges: ['magmaSteelDock', 0, 0], magma_fork: ['magmaSteelDock', 1, 0], steel_cross: ['magmaSteelDock', 0, 1], dock_delta: ['magmaSteelDock', 1, 1],
    mirror_fan: ['mirrorCoreExtra', 0, 0], core_nexus: ['mirrorCoreExtra', 1, 0]
  };

  // CARD_ART is frozen by the data modules. Build a new lookup instead of
  // mutating it; in strict mode the old assignment aborted this entire patch.
  RF.CARD_ART = Object.freeze({
    ...(RF.CARD_ART || {}),
    ...Object.fromEntries(Object.entries(spriteMap).map(([cardId, [sheetKey]]) => [cardId, SHEETS[sheetKey]]))
  });

  const imageCache = new Map();
  function getImage(src) {
    if (!src) return null;
    if (!imageCache.has(src)) {
      const img = new Image();
      img.src = src;
      imageCache.set(src, img);
    }
    return imageCache.get(src);
  }
  Object.values(SHEETS).forEach(getImage);
  Object.values(MAP_ATLASES).forEach(getImage);

  function getSpriteConfig(entity) {
    if (!entity) return null;
    const byCard = entity.cardId && spriteMap[entity.cardId];
    if (byCard) return byCard;
    if (entity.sprite && spriteAliases[entity.sprite]) return spriteAliases[entity.sprite];
    return null;
  }

  function drawGlowBurst(ctx, color, x, y, radius) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const proto = RF.BattleEngine && RF.BattleEngine.prototype;
  if (!proto) return;

  const oldDrawBackground = proto.drawBackground;
  const oldDrawGeneratedArtSprite = proto.drawGeneratedArtSprite;

  proto.drawBackground = function patchedDrawBackground(ctx) {
    const bg = mapBackgrounds[this.map?.id];
    if (bg) {
      const [atlasKey, gx, gy] = bg;
      const atlas = getImage(MAP_ATLASES[atlasKey]);
      if (atlas && atlas.complete && atlas.naturalWidth > 0) {
        const sw = Math.floor(atlas.naturalWidth / 2);
        const sh = Math.floor(atlas.naturalHeight / 2);
        ctx.save();
        ctx.drawImage(atlas, gx * sw, gy * sh, sw, sh, 0, 0, RF.BATTLE_CONSTANTS.WIDTH, RF.BATTLE_CONSTANTS.HEIGHT);
        const overlay = ctx.createLinearGradient(0, 0, 0, RF.BATTLE_CONSTANTS.HEIGHT);
        overlay.addColorStop(0, 'rgba(6,10,16,0.14)');
        overlay.addColorStop(1, 'rgba(4,7,11,0.28)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, RF.BATTLE_CONSTANTS.WIDTH, RF.BATTLE_CONSTANTS.HEIGHT);
        ctx.restore();
        return;
      }
    }
    oldDrawBackground.call(this, ctx);
  };

  proto.drawGeneratedArtSprite = function patchedDrawGeneratedArtSprite(ctx, entity, image, baseColor, player, attacking) {
    const cfg = getSpriteConfig(entity);
    if (!cfg) return oldDrawGeneratedArtSprite.call(this, ctx, entity, image, baseColor, player, attacking);
    const [sheetKey, row] = cfg;
    const spriteSheet = getImage(SHEETS[sheetKey]);
    if (!(spriteSheet && spriteSheet.complete && spriteSheet.naturalWidth > 0)) return oldDrawGeneratedArtSprite.call(this, ctx, entity, image, baseColor, player, attacking);
    const cellW = spriteSheet.naturalWidth / 4;
    const cellH = spriteSheet.naturalHeight / 8;
    let frame = 0;
    if (attacking) frame = 2;
    else if ((entity.attackFlashUntil || 0) + 0.12 > this.elapsed) frame = 3;
    else if (entity.moving) frame = 1;
    const size = entity.isBoss ? entity.radius * 6.2 : entity.heavy ? entity.radius * 5.0 : entity.flying ? entity.radius * 4.6 : entity.radius * 4.2;
    ctx.save();
    ctx.scale(player ? 1 : -1, 1);
    ctx.drawImage(spriteSheet, frame * cellW, row * cellH, cellW, cellH, -size * 0.52, -size * 0.72, size, size);
    if (attacking) drawGlowBurst(ctx, player ? 'rgba(130,225,255,0.42)' : 'rgba(255,152,96,0.42)', 0, -size * 0.05, size * 0.48);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = attacking ? '#fff0a8' : baseColor;
    ctx.lineWidth = entity.isBoss ? 4 : 2.5;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(0, size * 0.08, size * 0.24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  proto.drawProjectiles = function patchedDrawProjectiles(ctx) {
    this.projectiles.forEach((projectile) => {
      const t = Math.max(0, Math.min(1, (this.elapsed - projectile.start) / Math.max(0.001, projectile.end - projectile.start)));
      const x = projectile.x1 + (projectile.x2 - projectile.x1) * t;
      let y = projectile.y1 + (projectile.y2 - projectile.y1) * t;
      if (projectile.arc) y -= Math.sin(t * Math.PI) * 54;
      const tailT = Math.max(0, t - 0.12);
      const tx = projectile.x1 + (projectile.x2 - projectile.x1) * tailT;
      let ty = projectile.y1 + (projectile.y2 - projectile.y1) * tailT;
      if (projectile.arc) ty -= Math.sin(tailT * Math.PI) * 54;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = projectile.color;
      ctx.lineWidth = projectile.thick * 3.2;
      ctx.globalAlpha = 0.16;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.lineWidth = projectile.thick * 1.5;
      ctx.globalAlpha = 0.42;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.lineWidth = projectile.thick;
      ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      drawGlowBurst(ctx, projectile.color, x, y, projectile.thick * 4.5);
      ctx.restore();
    });
  };

  proto.drawParticles = function patchedDrawParticles(ctx) {
    this.particles.forEach((particle) => {
      const alpha = Math.max(0, Math.min(1, particle.life / particle.maxLife));
      const r = particle.radius || 3;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(particle.x - r * 1.6, particle.y);
      ctx.lineTo(particle.x + r * 1.6, particle.y);
      ctx.moveTo(particle.x, particle.y - r * 1.6);
      ctx.lineTo(particle.x, particle.y + r * 1.6);
      ctx.stroke();
      drawGlowBurst(ctx, particle.color, particle.x, particle.y, r * 3.2);
      ctx.restore();
    });
  };
})();
