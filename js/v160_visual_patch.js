(function () {
  'use strict';

  const RF = window.RF = window.RF || {};
  RF.VERSION = '1.6.0';

  const THUMBNAILS = {
  "scouts": "assets/card_thumbnails/units/scouts.webp",
  "rifle_squad": "assets/card_thumbnails/units/rifle_squad.webp",
  "shield_squad": "assets/card_thumbnails/units/shield_squad.webp",
  "raiders": "assets/card_thumbnails/units/raiders.webp",
  "field_medic": "assets/card_thumbnails/units/field_medic.webp",
  "drone_swarm": "assets/card_thumbnails/units/drone_swarm.webp",
  "flamers": "assets/card_thumbnails/units/flamers.webp",
  "sniper": "assets/card_thumbnails/units/sniper.webp",
  "mortar_team": "assets/card_thumbnails/units/mortar_team.webp",
  "interceptors": "assets/card_thumbnails/units/interceptors.webp",
  "assault_mech": "assets/card_thumbnails/units/assault_mech.webp",
  "siege_tank": "assets/card_thumbnails/units/siege_tank.webp",
  "shock_troopers": "assets/card_thumbnails/units/shock_troopers.webp",
  "titan": "assets/card_thumbnails/units/titan.webp",
  "fed_guardian_squad": "assets/card_thumbnails/units/fed_guardian_squad.webp",
  "fed_engineer_team": "assets/card_thumbnails/units/fed_engineer_team.webp",
  "fed_skyriders": "assets/card_thumbnails/units/fed_skyriders.webp",
  "fed_rail_tank": "assets/card_thumbnails/units/fed_rail_tank.webp",
  "spore_runners": "assets/card_thumbnails/units/spore_runners.webp",
  "thorn_guard": "assets/card_thumbnails/units/thorn_guard.webp",
  "mycelium_archer": "assets/card_thumbnails/units/mycelium_archer.webp",
  "brood_nurse": "assets/card_thumbnails/units/brood_nurse.webp",
  "vine_ambush": "assets/card_thumbnails/units/vine_ambush.webp",
  "devourer_alpha": "assets/card_thumbnails/units/devourer_alpha.webp",
  "bloom_colossus": "assets/card_thumbnails/units/bloom_colossus.webp",
  "swarm_raiders": "assets/card_thumbnails/units/swarm_raiders.webp",
  "swarm_thorn_guard": "assets/card_thumbnails/units/swarm_thorn_guard.webp",
  "swarm_bloom_sage": "assets/card_thumbnails/units/swarm_bloom_sage.webp",
  "swarm_ancient": "assets/card_thumbnails/units/swarm_ancient.webp",
  "prism_acolyte": "assets/card_thumbnails/units/prism_acolyte.webp",
  "mirror_blades": "assets/card_thumbnails/units/mirror_blades.webp",
  "crystal_guard": "assets/card_thumbnails/units/crystal_guard.webp",
  "phase_drone": "assets/card_thumbnails/units/phase_drone.webp",
  "prism_medic": "assets/card_thumbnails/units/prism_medic.webp",
  "shard_knight": "assets/card_thumbnails/units/shard_knight.webp",
  "crystal_titan": "assets/card_thumbnails/units/crystal_titan.webp",
  "prism_adepts": "assets/card_thumbnails/units/prism_adepts.webp",
  "prism_restorers": "assets/card_thumbnails/units/prism_restorers.webp",
  "prism_phase_knights": "assets/card_thumbnails/units/prism_phase_knights.webp",
  "prism_shard_host": "assets/card_thumbnails/units/prism_shard_host.webp",
  "enemy_scrapper": "assets/card_thumbnails/units/enemy_scrapper.webp",
  "enemy_gunner": "assets/card_thumbnails/units/enemy_gunner.webp",
  "enemy_brute": "assets/card_thumbnails/units/enemy_brute.webp",
  "frostling": "assets/card_thumbnails/units/frostling.webp",
  "ice_guard": "assets/card_thumbnails/units/ice_guard.webp",
  "frost_mage": "assets/card_thumbnails/units/frost_mage.webp",
  "snow_beast": "assets/card_thumbnails/units/snow_beast.webp",
  "boss_frost_giant": "assets/card_thumbnails/units/boss_frost_giant.webp",
  "jungle_stalker": "assets/card_thumbnails/units/jungle_stalker.webp",
  "spore_thrower": "assets/card_thumbnails/units/spore_thrower.webp",
  "vine_beast": "assets/card_thumbnails/units/vine_beast.webp",
  "devourer": "assets/card_thumbnails/units/devourer.webp",
  "magma_imp": "assets/card_thumbnails/units/magma_imp.webp",
  "obsidian_guard": "assets/card_thumbnails/units/obsidian_guard.webp",
  "fire_bug": "assets/card_thumbnails/units/fire_bug.webp",
  "lava_carrier": "assets/card_thumbnails/units/lava_carrier.webp",
  "furnace_priest": "assets/card_thumbnails/units/furnace_priest.webp",
  "boss_magma_colossus": "assets/card_thumbnails/units/boss_magma_colossus.webp",
  "steel_drone": "assets/card_thumbnails/units/steel_drone.webp",
  "shield_bot": "assets/card_thumbnails/units/shield_bot.webp",
  "gunwalker": "assets/card_thumbnails/units/gunwalker.webp",
  "boss_hive_mind": "assets/card_thumbnails/units/boss_hive_mind.webp",
  "mirror_sentry": "assets/card_thumbnails/units/mirror_sentry.webp",
  "mirror_knight": "assets/card_thumbnails/units/mirror_knight.webp",
  "boss_core_avatar": "assets/card_thumbnails/units/boss_core_avatar.webp",
  "treasure_clone_fleet": "assets/card_thumbnails/units/treasure_clone_fleet.webp",
  "treasure_omega_titan": "assets/card_thumbnails/units/treasure_omega_titan.webp",
  "shadow_hounds": "assets/card_thumbnails/units/shadow_hounds.webp",
  "shadow_sentinels": "assets/card_thumbnails/units/shadow_sentinels.webp",
  "shadow_seers": "assets/card_thumbnails/units/shadow_seers.webp",
  "shadow_stalkers": "assets/card_thumbnails/units/shadow_stalkers.webp",
  "shadow_lurker": "assets/card_thumbnails/units/shadow_lurker.webp",
  "shadow_archon": "assets/card_thumbnails/units/shadow_archon.webp",
  "shadow_eye": "assets/card_thumbnails/units/shadow_eye.webp",
  "shadow_wraith": "assets/card_thumbnails/units/shadow_wraith.webp",
  "boss_eclipse_sovereign": "assets/card_thumbnails/units/boss_eclipse_sovereign.webp",
  "barricade": "assets/card_thumbnails/buildings/barricade.webp",
  "auto_turret": "assets/card_thumbnails/buildings/auto_turret.webp",
  "field_hospital": "assets/card_thumbnails/buildings/field_hospital.webp",
  "command_beacon": "assets/card_thumbnails/buildings/command_beacon.webp",
  "treasure_world_engine": "assets/card_thumbnails/buildings/treasure_world_engine.webp",
  "seed_turret": "assets/card_thumbnails/buildings/seed_turret.webp",
  "root_sanctuary": "assets/card_thumbnails/buildings/root_sanctuary.webp",
  "brood_nest": "assets/card_thumbnails/buildings/brood_nest.webp",
  "boss_bloom_mother": "assets/card_thumbnails/buildings/boss_bloom_mother.webp",
  "phase_turret": "assets/card_thumbnails/buildings/phase_turret.webp",
  "enemy_turret": "assets/card_thumbnails/buildings/enemy_turret.webp",
  "blizzard_totem": "assets/card_thumbnails/buildings/blizzard_totem.webp",
  "repair_node": "assets/card_thumbnails/buildings/repair_node.webp",
  "shield_pylon": "assets/card_thumbnails/buildings/shield_pylon.webp",
  "shadow_obelisk": "assets/card_thumbnails/buildings/shadow_obelisk.webp",
  "shadow_gate": "assets/card_thumbnails/buildings/shadow_gate.webp",
  "shadow_pylon": "assets/card_thumbnails/buildings/shadow_pylon.webp"
};
  const BUILDING_ANIMATIONS = {
  "barricade": "assets/building_animations/barricade.png",
  "auto_turret": "assets/building_animations/auto_turret.png",
  "field_hospital": "assets/building_animations/field_hospital.png",
  "command_beacon": "assets/building_animations/command_beacon.png",
  "treasure_world_engine": "assets/building_animations/treasure_world_engine.png",
  "seed_turret": "assets/building_animations/seed_turret.png",
  "root_sanctuary": "assets/building_animations/root_sanctuary.png",
  "brood_nest": "assets/building_animations/brood_nest.png",
  "boss_bloom_mother": "assets/building_animations/boss_bloom_mother.png",
  "phase_turret": "assets/building_animations/phase_turret.png",
  "enemy_turret": "assets/building_animations/enemy_turret.png",
  "blizzard_totem": "assets/building_animations/blizzard_totem.png",
  "repair_node": "assets/building_animations/repair_node.png",
  "shield_pylon": "assets/building_animations/shield_pylon.png",
  "shadow_obelisk": "assets/building_animations/shadow_obelisk.png",
  "shadow_gate": "assets/building_animations/shadow_gate.png",
  "shadow_pylon": "assets/building_animations/shadow_pylon.png"
};
  const FORT_ANIMATIONS = {
    player_core: 'assets/building_animations/player_core.png',
    enemy_core: 'assets/building_animations/enemy_core.png',
    player_outpost: 'assets/building_animations/player_outpost.png',
    enemy_outpost: 'assets/building_animations/enemy_outpost.png'
  };

  RF.THUMBNAIL_ART = Object.freeze({ ...(RF.THUMBNAIL_ART || {}), ...THUMBNAILS });
  RF.BUILDING_ANIMATIONS = Object.freeze({ ...(RF.BUILDING_ANIMATIONS || {}), ...BUILDING_ANIMATIONS, ...FORT_ANIMATIONS });

  if (RF.UI?.factionNames) RF.UI.factionNames.shadow = '影渊教团';
  if (RF.UI?.biomeNames) RF.UI.biomeNames.shadow = '影渊';
  if (RF.UI?.biomeIcons) RF.UI.biomeIcons.shadow = '☾';

  const style = document.createElement('style');
  style.id = 'v160-visual-style';
  style.textContent = `
    .card-art.has-image,
    .hand-art.has-image {
      background-position: center, center !important;
      background-size: 100% 100%, contain !important;
      background-repeat: no-repeat, no-repeat !important;
      background-color: #07121d;
    }
    .card-art.has-image {
      border-color: rgba(147, 224, 255, .24);
      box-shadow: inset 0 -22px 28px rgba(3, 8, 13, .34), 0 8px 18px rgba(0, 0, 0, .18);
    }
    .hand-art.has-image {
      border-radius: 12px;
      box-shadow: inset 0 -18px 22px rgba(3, 8, 13, .26);
    }
    .card-tile.has-generated-art {
      overflow: hidden;
      background-image: radial-gradient(circle at 50% 22%, rgba(100, 207, 255, .08), transparent 42%);
    }
    .card-tile.has-generated-art:hover .card-art {
      transform: translateY(-1px) scale(1.018);
      filter: saturate(1.08) brightness(1.04);
    }
    .card-art, .hand-art { transition: transform .18s ease, filter .18s ease; }
  `;
  document.head.appendChild(style);

  const imageCache = new Map();
  function getImage(src) {
    if (!src || typeof Image === 'undefined') return null;
    if (!imageCache.has(src)) {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
      imageCache.set(src, image);
    }
    return imageCache.get(src);
  }
  Object.values(BUILDING_ANIMATIONS).forEach(getImage);
  Object.values(FORT_ANIMATIONS).forEach(getImage);

  function stablePhase(value) {
    const text = String(value || '0');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return Math.abs(hash % 997) / 997;
  }

  function ambientFrame(elapsed, phase, role, attacking) {
    if (attacking) return 3;
    const auraRoles = ['hospital', 'beacon', 'spawner', 'bossSpawner', 'blizzard', 'taunt'];
    const sequence = auraRoles.includes(role) ? [0, 1, 2, 3, 2, 1] : [0, 1, 2, 1];
    const speed = role === 'wall' ? 1.15 : auraRoles.includes(role) ? 2.05 : 1.7;
    return sequence[Math.floor((elapsed * speed + phase * sequence.length)) % sequence.length];
  }

  function drawGroundPulse(ctx, radius, color, elapsed, phase, role) {
    if (!['hospital', 'beacon', 'spawner', 'bossSpawner', 'blizzard', 'taunt'].includes(role)) return;
    const pulse = 0.82 + Math.sin(elapsed * 2.8 + phase * 6.28) * 0.10;
    ctx.save();
    ctx.globalAlpha = role === 'taunt' ? 0.42 : 0.28;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.68, radius * 1.45 * pulse, radius * 0.48 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const proto = RF.BattleEngine && RF.BattleEngine.prototype;
  if (!proto) return;

  const oldDrawBuildingSprite = proto.drawBuildingSprite;
  proto.drawBuildingSprite = function drawV160Building(ctx, entity, baseColor, player, attacking) {
    const src = BUILDING_ANIMATIONS[entity?.cardId];
    const image = src ? getImage(src) : null;
    if (!(image && image.complete && image.naturalWidth > 0)) {
      return oldDrawBuildingSprite.call(this, ctx, entity, baseColor, player, attacking);
    }

    const role = entity.role || RF.CARDS?.[entity.cardId]?.building?.role || 'building';
    const phase = stablePhase(entity.id || entity.cardId);
    const frame = ambientFrame(this.elapsed, phase, role, attacking);
    const cellW = image.naturalWidth / 4;
    const cellH = image.naturalHeight;
    const radius = Math.max(18, Number(entity.radius || 22));
    const size = entity.isBoss ? radius * 5.35 : role === 'wall' ? radius * 4.75 : radius * 4.55;
    const bob = role === 'spawner' || role === 'bossSpawner' ? Math.sin(this.elapsed * 2.2 + phase * 6.28) * 1.8 : 0;

    drawGroundPulse(ctx, radius, baseColor, this.elapsed, phase, role);
    ctx.save();
    if (!player) ctx.scale(-1, 1);
    ctx.globalAlpha = entity.stealthUntil > this.elapsed ? 0.55 : 1;
    ctx.drawImage(image, frame * cellW, 0, cellW, cellH, -size * 0.5, -size * 0.71 + bob, size, size);
    ctx.restore();

    if (attacking) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, -radius * 0.25, 0, 0, -radius * 0.25, radius * 1.9);
      g.addColorStop(0, player ? 'rgba(190,246,255,.42)' : 'rgba(255,198,150,.40)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, -radius * 0.25, radius * 1.9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  };

  const oldDrawFort = proto.drawFort;
  proto.drawFort = function drawV160Fort(ctx, fort) {
    if (!fort?.alive) return oldDrawFort.call(this, ctx, fort);
    const key = `${fort.side}_${fort.kind}`;
    const src = FORT_ANIMATIONS[key];
    const image = src ? getImage(src) : null;
    if (!(image && image.complete && image.naturalWidth > 0)) return oldDrawFort.call(this, ctx, fort);

    const player = fort.side === 'player';
    const attacking = Number(fort.attackFlashUntil || 0) > this.elapsed;
    const phase = stablePhase(fort.id || key);
    const frame = ambientFrame(this.elapsed, phase, fort.kind === 'core' ? 'beacon' : 'turret', attacking);
    const cellW = image.naturalWidth / 4;
    const cellH = image.naturalHeight;
    const size = fort.kind === 'core' ? fort.radius * 4.35 : fort.radius * 4.15;

    ctx.save();
    ctx.translate(fort.x, fort.y);
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, fort.radius * 0.78, fort.radius * 1.20, fort.radius * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawGroundPulse(ctx, fort.radius, player ? '#67dcff' : '#ff806f', this.elapsed, phase, 'beacon');
    ctx.shadowColor = player ? '#64dcff' : '#ff725f';
    ctx.shadowBlur = fort.kind === 'core' ? 22 : 13;
    if (!player) ctx.scale(-1, 1);
    ctx.drawImage(image, frame * cellW, 0, cellW, cellH, -size * 0.5, -size * 0.69, size, size);
    ctx.restore();

    if (fort.shield > 0) {
      ctx.save();
      ctx.strokeStyle = '#d9a8ff';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.78;
      ctx.beginPath();
      ctx.arc(fort.x, fort.y, fort.radius + 8, -Math.PI * .1, Math.PI * 1.45);
      ctx.stroke();
      ctx.restore();
    }
    this.drawHealthBar(
      ctx,
      fort.x - (fort.kind === 'core' ? 55 : 34),
      fort.y + fort.radius + 10,
      fort.kind === 'core' ? 110 : 68,
      8,
      fort.hp / fort.maxHp,
      player ? '#67d9ff' : '#ff7767',
      fort.shield,
      fort.maxHp
    );
  };
})();
