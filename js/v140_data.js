(function () {
  'use strict';

  const RF = window.RF = window.RF || {};
  RF.VERSION = '1.4.0';

  const cards = { ...RF.CARDS };
  const add = (card) => { cards[card.id] = Object.freeze(card); };

  // =========================================================
  // 新阵营：影渊教团
  // 玩法关键词：诱导索敌、隐匿、建筑牵引、穿越障碍、目标标记
  // =========================================================
  add({
    id: 'shadow_hounds', name: '裂隙猎犬', icon: '◆', cost: 2, type: 'unit', rarity: 'common', faction: 'shadow',
    desc: '部署3只高速猎犬。只攻击建筑与核心，能够被防御建筑牵引改道。',
    unit: { count: 3, hp: 62, damage: 18, speed: 61, range: 27, cooldown: 0.72, radius: 10, role: 'melee', targetMode: 'buildings', sightRange: 320, chargeBonus: 20, color: '#a26cff' }
  });
  add({
    id: 'shadow_sentinels', name: '幽铠守望者', icon: '⬢', cost: 3, type: 'unit', rarity: 'common', faction: 'shadow',
    desc: '部署2名重甲守卫。高仇恨轮廓会吸引附近敌军，使后排更容易输出。',
    unit: { count: 2, hp: 190, damage: 19, speed: 25, range: 30, cooldown: 1.05, radius: 17, role: 'tank', armor: 0.2, aggroPriority: 72, tauntRadius: 135, mass: 2.2, sightRange: 235, color: '#7b55d9' }
  });
  add({
    id: 'shadow_seers', name: '灵能司祭', icon: '✦', cost: 3, type: 'unit', rarity: 'rare', faction: 'shadow',
    desc: '部署2名远程司祭。攻击附带腐蚀，并优先锁定脆弱的远程与治疗单位。',
    unit: { count: 2, hp: 82, damage: 23, speed: 28, range: 178, cooldown: 1.08, radius: 13, role: 'ranged', projectile: true, poison: 5, sightRange: 275, backlineHunter: true, targetPriority: 'ranged', canTargetAir: true, color: '#c389ff' }
  });
  add({
    id: 'shadow_stalkers', name: '帷幕后行者', icon: '◒', cost: 4, type: 'unit', rarity: 'epic', faction: 'shadow',
    desc: '部署2名隐匿刺客。出现后短暂无法被远距离索敌，首次接敌获得爆发加速。',
    unit: { count: 2, hp: 112, damage: 47, speed: 45, range: 29, cooldown: 1.0, radius: 13, role: 'melee', targetMode: 'troops', targetPriority: 'ranged', sightRange: 255, stealthDuration: 6.2, backlineHunter: true, firstAggroHaste: 3.2, color: '#8f52ec' }
  });
  add({
    id: 'shadow_lurker', name: '相位掘行兽', icon: '◖', cost: 4, type: 'unit', rarity: 'rare', faction: 'shadow',
    desc: '部署1只相位巨兽。移动时可穿越普通地形障碍，接战后吸取生命。',
    unit: { count: 1, hp: 365, damage: 41, speed: 32, range: 36, cooldown: 1.18, radius: 22, role: 'heavy', heavy: true, mass: 3.2, phaseMovement: true, lifeSteal: 0.18, sightRange: 285, color: '#6b43c7' }
  });
  add({
    id: 'shadow_obelisk', name: '诱导方尖碑', icon: '⬟', cost: 3, type: 'building', rarity: 'rare', faction: 'shadow',
    desc: '持续46秒。拥有极高索敌优先级，可将附近敌军和攻城单位牵引到中央。',
    building: { hp: 340, duration: 46, radius: 23, role: 'taunt', aggroPriority: 165, tauntRadius: 255, mass: 9, auraRange: 205, color: '#975fff' }
  });
  add({
    id: 'shadow_gate', name: '噩梦裂隙门', icon: '◐', cost: 4, type: 'building', rarity: 'epic', faction: 'shadow',
    desc: '持续44秒，每9.8秒召唤一批裂隙猎犬。',
    building: { hp: 300, duration: 44, radius: 25, role: 'spawner', spawnCard: 'shadow_hounds', spawnEvery: 9.8, aggroPriority: 38, color: '#7b4ed1' }
  });
  add({
    id: 'shadow_eclipse', name: '日蚀帷幕', icon: '☾', cost: 3, type: 'spell', rarity: 'rare', faction: 'shadow', target: 'friendly',
    desc: '目标区域友军进入短暂隐匿、清除敌方锁定，并获得移动与攻击加速。',
    spell: { effect: 'eclipseVeil', radius: 158, duration: 6.2 }
  });
  add({
    id: 'shadow_mark', name: '灵魂猎印', icon: '✧', cost: 2, type: 'spell', rarity: 'rare', faction: 'shadow', target: 'enemy',
    desc: '标记目标区域敌军8秒。被标记者受到的所有伤害提高25%。',
    spell: { effect: 'soulMark', radius: 142, duration: 8, damageTaken: 0.25 }
  });
  add({
    id: 'shadow_archon', name: '蚀界执政官', icon: '✣', cost: 7, type: 'unit', rarity: 'legendary', faction: 'shadow',
    desc: '部署一名重型灵能领主。拥有护盾、范围攻击与吸血，第一次锁定目标时进入狂热。',
    unit: { count: 1, hp: 760, shield: 190, damage: 88, speed: 18, range: 122, cooldown: 1.55, radius: 29, role: 'heavy', heavy: true, projectile: true, aoe: 54, lifeSteal: 0.12, sightRange: 335, firstAggroHaste: 4.2, canTargetAir: true, color: '#a45cff' }
  });

  // 敌方专属影渊单位与Boss。
  add({
    id: 'shadow_eye', name: '窥视之眼', icon: '◉', cost: 2, type: 'unit', enemyOnly: true,
    unit: { count: 2, hp: 76, damage: 18, speed: 30, range: 165, cooldown: 0.95, radius: 12, role: 'ranged', projectile: true, flying: true, canTargetAir: true, sightRange: 285, color: '#c06dff' }
  });
  add({
    id: 'shadow_wraith', name: '裂界幽魂', icon: '☽', cost: 3, type: 'unit', enemyOnly: true,
    unit: { count: 2, hp: 102, damage: 31, speed: 42, range: 35, cooldown: 0.92, radius: 13, role: 'melee', phaseMovement: true, stealthDuration: 4.8, sightRange: 260, color: '#8d5ae8' }
  });
  add({
    id: 'shadow_pylon', name: '蚀光诱导塔', icon: '⬟', cost: 3, type: 'building', enemyOnly: true,
    building: { hp: 330, duration: 48, radius: 23, role: 'taunt', aggroPriority: 175, tauntRadius: 265, mass: 9, auraRange: 210, color: '#9b60f2' }
  });
  add({
    id: 'boss_eclipse_sovereign', name: '影渊君王·瑟洛', icon: '☿', cost: 10, type: 'unit', enemyOnly: true, boss: true,
    unit: { count: 1, hp: 1840, shield: 320, damage: 92, speed: 15, range: 148, cooldown: 1.28, radius: 40, role: 'boss', heavy: true, projectile: true, aoe: 62, lifeSteal: 0.1, sightRange: 370, canTargetAir: true, color: '#9a55ed' }
  });

  // 新主动宝藏。
  add({
    id: 'treasure_black_sun', name: '黑日圣契', icon: '☀', cost: 4, type: 'spell', rarity: 'legendary', treasure: true, target: 'friendly',
    desc: '全体友军进入短暂隐匿并获得狂热，同时标记全部敌方单位。', spell: { effect: 'blackSun', duration: 7.2 }
  });
  add({
    id: 'treasure_bridge_compass', name: '王桥罗盘', icon: '⌖', cost: 2, type: 'spell', rarity: 'legendary', treasure: true, target: 'friendly',
    desc: '立即抽2张牌，并让所有友军重新选择最近可达目标，随后获得冲锋。', spell: { effect: 'bridgeCompass', draw: 2, duration: 5.6 }
  });
  add({
    id: 'treasure_soul_vault', name: '灵魂金库', icon: '◈', cost: 5, type: 'spell', rarity: 'legendary', treasure: true, target: 'friendly',
    desc: '在目标位置召唤一名蚀界执政官和一座诱导方尖碑。', spell: { effect: 'soulVault', cards: ['shadow_archon', 'shadow_obelisk'] }
  });

  // 让部分既有重型单位拥有《皇室战争》式建筑偏好，便于防御建筑牵引。
  const retargetCard = (id, patch) => {
    const card = cards[id];
    if (!card?.unit) return;
    cards[id] = Object.freeze({ ...card, unit: { ...card.unit, ...patch } });
  };
  retargetCard('siege_tank', { targetMode: 'buildings', sightRange: 335 });
  retargetCard('fed_rail_tank', { targetMode: 'buildings', sightRange: 330 });
  retargetCard('snow_beast', { targetMode: 'buildings', sightRange: 305 });
  retargetCard('lava_carrier', { targetMode: 'buildings', sightRange: 305 });
  retargetCard('boss_magma_colossus', { sightRange: 350 });

  RF.CARDS = Object.freeze(cards);

  const shadowFaction = Object.freeze({
    id: 'shadow', name: '影渊教团', title: '诱导与隐匿', art: 'assets/shadow/faction_shadow.webp', color: '#9c63ff',
    passiveName: '灵能渗透', passiveDesc: '单位第一次锁定目标时获得2.8秒狂热；全军索敌范围提高8%。',
    signatureCard: 'shadow_archon', mods: { sightRangeMul: 0.08, firstAggroHaste: 2.8 }
  });
  RF.FACTIONS = Object.freeze([...RF.FACTIONS.filter((faction) => faction.id !== 'shadow'), shadowFaction]);

  RF.ROGUE_STARTER_DECKS = Object.freeze({
    ...RF.ROGUE_STARTER_DECKS,
    shadow: Object.freeze({
      name: '影渊猎桥仪仗', summary: '猎犬攻城、方尖碑牵引、隐匿刺客与灵能领主。',
      cards: Object.freeze({ arsenal: Object.freeze([
        'shadow_hounds','shadow_hounds','shadow_sentinels','shadow_sentinels','shadow_seers','shadow_stalkers',
        'shadow_lurker','shadow_obelisk','shadow_gate','shadow_eclipse','shadow_mark','shadow_archon'
      ]) })
    })
  });

  RF.ROGUE_BUNDLES = Object.freeze([
    ...RF.ROGUE_BUNDLES,
    { id: 'shadow_hunt', faction: 'shadow', name: '裂隙猎桥群', icon: '◆', desc: '建筑偏好单位与诱导建筑形成牵引组合。', cards: ['shadow_hounds','shadow_hounds','shadow_obelisk'] },
    { id: 'shadow_veil', faction: 'shadow', name: '帷幕刺杀', icon: '☾', desc: '隐匿、后排猎杀与区域标记。', cards: ['shadow_stalkers','shadow_eclipse','shadow_mark'] },
    { id: 'shadow_psion', faction: 'shadow', name: '灵能议会', icon: '✦', desc: '远程腐蚀与重型执政官。', cards: ['shadow_seers','shadow_sentinels','shadow_archon'] },
    { id: 'shadow_gate_bundle', faction: 'shadow', name: '噩梦门庭', icon: '◐', desc: '用裂隙门持续制造攻城压力。', cards: ['shadow_gate','shadow_lurker','shadow_hounds'] }
  ]);

  RF.ROGUE_TREASURE_CARDS = Object.freeze([
    ...RF.ROGUE_TREASURE_CARDS,
    'treasure_black_sun','treasure_bridge_compass','treasure_soul_vault'
  ]);

  RF.ROGUE_RELICS = Object.freeze([
    ...RF.ROGUE_RELICS,
    { id: 'hunter_compass', name: '猎桥罗盘', icon: '⌖', rarity: 'rare', desc: '全军索敌范围 +14%，首次锁定目标的狂热持续时间 +1.4秒。', mods: { sightRangeMul: 0.14, firstAggroHaste: 1.4 } },
    { id: 'taunt_prism', name: '诱导棱柱', icon: '⬟', rarity: 'rare', desc: '己方建筑的牵引优先级提高40%，建筑生命值 +10%。', mods: { buildingAggroMul: 0.4, buildingHpMul: 0.1 } },
    { id: 'execution_sigil', name: '处决猎印', icon: '✧', rarity: 'epic', desc: '攻击被标记者的伤害额外提高18%。', mods: { markDamageBonus: 0.18 } },
    { id: 'rift_purse', name: '裂界钱袋', icon: '◈', rarity: 'common', desc: '每次击败精英Boss额外获得40裂界碎片。', mods: { eliteShardBonus: 40 } }
  ]);

  RF.CARD_ART = Object.freeze({
    ...RF.CARD_ART,
    shadow_hounds: 'assets/unit_art/prism_assassin.webp',
    shadow_sentinels: 'assets/units/void_knight.webp',
    shadow_seers: 'assets/unit_art/prism_caster.webp',
    shadow_stalkers: 'assets/unit_art/prism_assassin.webp',
    shadow_lurker: 'assets/unit_art/void_titan.webp',
    shadow_obelisk: 'assets/shadow/shadow_relic.webp',
    shadow_gate: 'assets/bosses/boss_void.webp',
    shadow_eclipse: 'assets/shadow/shadow_campaign.webp',
    shadow_mark: 'assets/shadow/shadow_relic.webp',
    shadow_archon: 'assets/bosses/boss_void.webp',
    shadow_eye: 'assets/unit_art/prism_caster.webp',
    shadow_wraith: 'assets/unit_art/prism_assassin.webp',
    shadow_pylon: 'assets/shadow/shadow_relic.webp',
    boss_eclipse_sovereign: 'assets/boss_art/void_lord.webp',
    treasure_black_sun: 'assets/shadow/shadow_campaign.webp',
    treasure_bridge_compass: 'assets/shadow/shadow_relic.webp',
    treasure_soul_vault: 'assets/boss_art/void_lord.webp'
  });
  RF.BOSS_ART = Object.freeze({ ...RF.BOSS_ART, shadow: 'assets/boss_art/void_lord.webp' });
  RF.CARD_SPRITES = Object.freeze({
    ...RF.CARD_SPRITES,
    shadow_hounds: 'stalker', shadow_sentinels: 'mirrorKnight', shadow_seers: 'mage', shadow_stalkers: 'mirrorRifle',
    shadow_lurker: 'devourer', shadow_obelisk: 'pylon', shadow_gate: 'nest', shadow_archon: 'coreBoss',
    shadow_eye: 'drone', shadow_wraith: 'mirrorKnight', shadow_pylon: 'pylon', boss_eclipse_sovereign: 'coreBoss'
  });

  // =========================================================
  // 三张新地图：桥梁选择仍清晰，但基地半场保持自由部署。
  // =========================================================
  RF.MAPS = Object.freeze({
    ...RF.MAPS,
    shadow_hourglass: Object.freeze({
      id: 'shadow_hourglass', name: '时砂双桥', short: '双桥牵引', summary: '两座弧形桥在中央靠近，防御建筑可把攻城单位牵引到交叉火力区。',
      deploy: { player: { minX: 105, maxX: 468 }, enemy: { minX: 812, maxX: 1175 } }, core: { player: [78,360], enemy: [1202,360] }, relay: [640,360],
      routes: [
        { id: 'upper_arc', name: '上弦桥', short: '上', width: 118, points: [[250,205],[430,205],[545,285],[700,285],[825,205],[1030,205]] },
        { id: 'lower_arc', name: '下弦桥', short: '下', width: 118, points: [[250,515],[430,515],[545,435],[700,435],[825,515],[1030,515]] }
      ],
      obstacles: [
        { shape: 'circle', x: 640, y: 360, r: 58, type: 'void', label: '影渊沙漏' },
        { shape: 'rect', x: 500, y: 114, w: 280, h: 74, radius: 28, type: 'ruin', label: '坍塌祭坛' },
        { shape: 'rect', x: 500, y: 532, w: 280, h: 74, radius: 28, type: 'ruin', label: '坍塌祭坛' }
      ]
    }),
    shadow_labyrinth: Object.freeze({
      id: 'shadow_labyrinth', name: '影渊三岔迷宫', short: '三桥迷宫', summary: '三条桥彼此靠近，中央诱导建筑能显著改变整支军队的目标与路线。',
      deploy: { player: { minX: 105, maxX: 472 }, enemy: { minX: 808, maxX: 1175 } }, core: { player: [78,360], enemy: [1202,360] }, relay: [640,360],
      routes: [
        { id: 'north_shadow', name: '暮影北桥', short: '北', width: 98, points: [[250,150],[450,150],[550,220],[720,220],[825,150],[1030,150]] },
        { id: 'center_shadow', name: '灵能中桥', short: '中', width: 94, points: [[250,360],[475,360],[640,360],[805,360],[1030,360]] },
        { id: 'south_shadow', name: '蚀光南桥', short: '南', width: 98, points: [[250,570],[450,570],[550,500],[720,500],[825,570],[1030,570]] }
      ],
      obstacles: [
        { shape: 'rect', x: 505, y: 255, w: 270, h: 64, radius: 24, type: 'voidWall', label: '虚空屏障' },
        { shape: 'rect', x: 505, y: 401, w: 270, h: 64, radius: 24, type: 'voidWall', label: '虚空屏障' },
        { shape: 'circle', x: 640, y: 360, r: 27, type: 'crystal', label: '诱导晶核' }
      ]
    }),
    shadow_crescent: Object.freeze({
      id: 'shadow_crescent', name: '月蚀回廊', short: '弯月双路', summary: '两条路线在敌方半场交汇，快速单位可以转向追击，建筑牵引也更有价值。',
      deploy: { player: { minX: 105, maxX: 465 }, enemy: { minX: 815, maxX: 1175 } }, core: { player: [78,360], enemy: [1202,360] }, relay: [650,360],
      routes: [
        { id: 'crescent_n', name: '新月外环', short: '外', width: 116, points: [[250,180],[430,150],[580,190],[710,280],[845,300],[1030,330]] },
        { id: 'crescent_s', name: '残月内环', short: '内', width: 116, points: [[250,540],[430,570],[580,530],[710,440],[845,420],[1030,390]] }
      ],
      obstacles: [
        { shape: 'circle', x: 640, y: 360, r: 92, type: 'eclipse', label: '日蚀盆地' },
        { shape: 'circle', x: 520, y: 360, r: 24, type: 'obelisk', label: '旧方尖碑' },
        { shape: 'circle', x: 760, y: 360, r: 24, type: 'obelisk', label: '旧方尖碑' }
      ]
    }),
    shadow_throne: Object.freeze({
      id: 'shadow_throne', name: '终末王桥', short: '王桥三路', summary: '三条王桥围绕深渊王座，中央路线短而危险，外侧路线适合绕开牵引建筑。',
      deploy: { player: { minX: 105, maxX: 470 }, enemy: { minX: 810, maxX: 1175 } }, core: { player: [78,360], enemy: [1202,360] }, relay: [640,360],
      routes: [
        { id: 'throne_n', name: '北王桥', short: '北', width: 102, points: [[250,165],[445,165],[540,235],[735,235],[830,165],[1030,165]] },
        { id: 'throne_c', name: '王座直桥', short: '王', width: 88, points: [[250,360],[480,360],[640,360],[800,360],[1030,360]] },
        { id: 'throne_s', name: '南王桥', short: '南', width: 102, points: [[250,555],[445,555],[540,485],[735,485],[830,555],[1030,555]] }
      ],
      obstacles: [
        { shape: 'circle', x: 640, y: 270, r: 33, type: 'obelisk', label: '王座尖碑' },
        { shape: 'circle', x: 640, y: 450, r: 33, type: 'obelisk', label: '王座尖碑' },
        { shape: 'rect', x: 520, y: 310, w: 240, h: 100, radius: 30, type: 'throne', label: '深渊王座' }
      ]
    })
  });

  const stages = Object.freeze([
    { at: 0, name: '试探期', short: '1×', energyMultiplier: 1, drawMultiplier: 1, note: '每2.8秒恢复1费' },
    { at: 0.4, name: '桥头交锋', short: '2×', energyMultiplier: 2, drawMultiplier: 1.2, note: '费用恢复速度提升至2倍' },
    { at: 0.72, name: '王桥决战', short: '3×', energyMultiplier: 3, drawMultiplier: 1.46, note: '费用恢复速度提升至3倍' }
  ]);

  // =========================================================
  // 全新十关剧情：影渊篇
  // =========================================================
  RF.LEVELS = Object.freeze([
    {
      id: 1, act: '影渊篇 · 第一幕', title: '桥头诱饵', subtitle: '不是最近的路，而是最近的目标', biome: 'shadow', mapId: 'shadow_hourglass', duration: 165, difficulty: 1, tutorial: true,
      briefing: '敌方会用方尖碑牵引你的部队。单位拥有独立索敌半径和目标锁定，防御建筑也可以反过来把攻城猎犬拉进交叉火力。',
      objective: '学习建筑牵引、目标锁定与双桥路径，摧毁敌方核心。',
      intro: [
        { speaker: '弦月', portrait: '◈', text: '中央网络恢复后，第一批异常信号来自一座从地图上消失了两百年的王桥。' },
        { speaker: '邵铃', portrait: '⌁', text: '敌人会被“看见的最近目标”吸引。别只看伤害，建筑摆在哪里，现在会决定整支军队怎么走。' },
        { speaker: '指挥官', portrait: '◆', text: '那就先用一座炮塔，把它们请到我们准备好的地方。' }
      ],
      outro: [
        { speaker: '弦月', portrait: '◈', text: '截获自称“影渊教团”的通信。他们不是要摧毁中央网络，而是要让网络只听见一种声音。' }
      ],
      enemyDeck: ['shadow_hounds','shadow_hounds','shadow_eye','shadow_sentinels','shadow_pylon','shadow_seers'], stages,
      enemyCoreHp: 1180, enemyOutpostHp: 350, playerCoreHp: 1780, playerOutpostHp: 430,
      ai: { thinkMin: 2.35, thinkMax: 3.5, startDelay: 13, energyMul: 0.9, hpMul: 0.9, damageMul: 0.88, aggression: 0.46 },
      hazards: [], reward: { title: '诱导协议', text: '解锁新阵营卡：诱导方尖碑。', card: 'shadow_obelisk' }
    },
    {
      id: 2, act: '影渊篇 · 第一幕', title: '猎犬过桥', subtitle: '它们不在乎士兵，只认建筑', biome: 'shadow', mapId: 'frost_gates', duration: 178, difficulty: 2,
      briefing: '裂隙猎犬只攻击建筑与核心。把防御建筑放在正确距离，能够把它们从主塔旁边牵走。',
      objective: '利用建筑拉扯两批攻城猎犬，并击破双门前哨。',
      intro: [
        { speaker: '邵铃', portrait: '⌁', text: '猎犬会无视挡路的小队，直奔塔和核心。它们看见中央建筑时会改道，这就是我们的绳子。' },
        { speaker: '弦月', portrait: '◈', text: '冰门狭窄。一次错误的牵引会让两批猎犬在同一座塔前汇合。' }
      ],
      outro: [{ speaker: '指挥官', portrait: '◆', text: '它们的索敌规则可以预测。可预测，就能被利用。' }],
      enemyDeck: ['shadow_hounds','shadow_hounds','shadow_hounds','shadow_eye','ice_guard','shadow_pylon'], stages,
      enemyCoreHp: 1350, enemyOutpostHp: 400, playerCoreHp: 1820, playerOutpostHp: 450,
      ai: { thinkMin: 2.1, thinkMax: 3.2, startDelay: 8, energyMul: 0.96, hpMul: 0.95, damageMul: 0.94, aggression: 0.52 },
      hazards: [{ type: 'blizzard', every: 29, warning: 3, duration: 6.5, startAt: 20 }],
      boss: { cardId: 'boss_eclipse_sovereign', atRatio: 0.58, lane: 'weaker', announcement: '影渊猎主越过冰门', power: 'nightmareGate', powerName: '猎犬门庭', powerEvery: 21 },
      reward: { title: '猎桥兽印', text: '解锁新阵营卡：裂隙猎犬。', card: 'shadow_hounds' }
    },
    {
      id: 3, act: '影渊篇 · 第二幕', title: '隐幕丛林', subtitle: '看不见的敌人仍会留下脚印', biome: 'jungle', mapId: 'jungle_basin', duration: 188, difficulty: 3,
      briefing: '帷幕后行者会在出现后的数秒内躲过远距离索敌。靠近、范围伤害或等待其攻击都能揭露它们。',
      objective: '守住后排与治疗单位，击退隐匿刺客和孢潮混编军。',
      intro: [
        { speaker: '弦月', portrait: '◈', text: '影渊部队正在借用孢潮地下根系。它们能穿过障碍，并在我军后排附近重新显形。' },
        { speaker: '邵铃', portrait: '⌁', text: '别把狙击手单独放在角落。隐匿不是无敌，只是让懒惰的阵形先付学费。' }
      ],
      outro: [{ speaker: '弦月', portrait: '◈', text: '我们发现一条规律：每次刺客显形，远处都会有一座方尖碑同步亮起。' }],
      enemyDeck: ['shadow_stalkers','shadow_wraith','jungle_stalker','spore_thrower','shadow_seers','brood_nest'], stages,
      enemyCoreHp: 1480, enemyOutpostHp: 425, playerCoreHp: 1870, playerOutpostHp: 460,
      ai: { thinkMin: 1.95, thinkMax: 3.0, startDelay: 7, energyMul: 0.98, hpMul: 0.98, damageMul: 0.97, aggression: 0.58 },
      hazards: [{ type: 'sporePod', every: 25, warning: 2.6, duration: 10, startAt: 16 }, { type: 'shadowMist', every: 31, warning: 2.5, duration: 7, startAt: 24 }],
      reward: { title: '帷幕残片', text: '解锁新阵营卡：日蚀帷幕。', card: 'shadow_eclipse' }
    },
    {
      id: 4, act: '影渊篇 · 第二幕', title: '三岔误导', subtitle: '一座建筑，可以改写三条军路', biome: 'shadow', mapId: 'shadow_labyrinth', duration: 200, difficulty: 4,
      briefing: '敌方会在中央部署高优先级方尖碑，强迫附近部队改道。摧毁诱导建筑后，单位会重新锁定最近可达目标。',
      objective: '穿过三岔迷宫，优先拆除诱导方尖碑。',
      intro: [
        { speaker: '邵铃', portrait: '⌁', text: '这张地图最危险的不是墙，是墙后面那根会“喊名字”的柱子。' },
        { speaker: '指挥官', portrait: '◆', text: '让低费小队先触发牵引，主力从另一座桥通过。' }
      ],
      outro: [{ speaker: '弦月', portrait: '◈', text: '教团正在把索敌算法写进地形。下一处节点叫“灵魂市集”，那里交易的不是货物。' }],
      enemyDeck: ['shadow_sentinels','shadow_eye','shadow_pylon','shadow_pylon','shadow_seers','shadow_lurker'], stages,
      enemyCoreHp: 1600, enemyOutpostHp: 455, playerCoreHp: 1900, playerOutpostHp: 475,
      ai: { thinkMin: 1.85, thinkMax: 2.85, startDelay: 6, energyMul: 1.01, hpMul: 1.0, damageMul: 0.99, aggression: 0.62 },
      hazards: [{ type: 'shadowMist', every: 28, warning: 2.4, duration: 7.5, startAt: 18 }],
      boss: { cardId: 'boss_eclipse_sovereign', atRatio: 0.45, lane: 'stronger', announcement: '三岔守门者夺取索敌协议', power: 'aggroHijack', powerName: '诱导劫持', powerEvery: 18 },
      reward: { title: '灵能校准', text: '解锁新阵营卡：灵能司祭。', card: 'shadow_seers' }
    },
    {
      id: 5, act: '影渊篇 · 第三幕', title: '王塔试炼', subtitle: '防御建筑也是路径机关', biome: 'magma', mapId: 'magma_bridges', duration: 208, difficulty: 5,
      briefing: '攻城战车、裂隙猎犬和熔岩运输兽都偏好建筑。利用中央炮塔牵引，能让两座前哨同时开火。',
      objective: '在岩浆喷发中用建筑牵引三种攻城单位。',
      intro: [
        { speaker: '弦月', portrait: '◈', text: '教团把旧王庭的“牵引试炼”搬进了熔岩桥。所有重型攻城单位都被改写为建筑优先。' },
        { speaker: '邵铃', portrait: '⌁', text: '别把炮塔贴着核心。把它放得刚好能被看见，又刚好能让两座前哨一起打。' }
      ],
      outro: [{ speaker: '指挥官', portrait: '◆', text: '他们不是只在训练军队，也在筛选能理解规则的人。' }],
      enemyDeck: ['shadow_hounds','siege_tank','lava_carrier','shadow_pylon','fire_bug','obsidian_guard'], stages,
      enemyCoreHp: 1750, enemyOutpostHp: 495, playerCoreHp: 1960, playerOutpostHp: 500,
      ai: { thinkMin: 1.75, thinkMax: 2.72, startDelay: 5.5, energyMul: 1.04, hpMul: 1.03, damageMul: 1.02, aggression: 0.65 },
      hazards: [{ type: 'lava', every: 23, warning: 3, duration: 6.3, startAt: 15 }],
      reward: { title: '相位甲壳', text: '解锁新阵营卡：相位掘行兽。', card: 'shadow_lurker' }
    },
    {
      id: 6, act: '影渊篇 · 第三幕', title: '灵魂市集', subtitle: '每一次锁定，都有人收取利息', biome: 'mirror', mapId: 'mirror_fan', duration: 216, difficulty: 6,
      briefing: 'Boss会周期性抽取我军生命并恢复自身。被灵魂猎印标记的敌人受到更多伤害，适合在吸血后快速反打。',
      objective: '击败收税者，打断灵魂抽取循环。',
      intro: [
        { speaker: '邵铃', portrait: '⌁', text: '市集的账本写着每一支部队“第一次看见了谁”。教团把索敌记录当成灵魂凭证。' },
        { speaker: '弦月', portrait: '◈', text: 'Boss每隔一段时间抽取全场生命。标记它，在恢复后立刻集中火力。' }
      ],
      outro: [{ speaker: '弦月', portrait: '◈', text: '账本指向月蚀回廊。教团的君王正在那里改写整个战区的目标优先级。' }],
      enemyDeck: ['shadow_seers','shadow_stalkers','mirror_sentry','shadow_eye','shadow_sentinels','shadow_gate'], stages,
      enemyCoreHp: 1890, enemyOutpostHp: 525, playerCoreHp: 2020, playerOutpostHp: 515,
      ai: { thinkMin: 1.65, thinkMax: 2.6, startDelay: 5, energyMul: 1.06, hpMul: 1.05, damageMul: 1.04, aggression: 0.68 },
      hazards: [{ type: 'mirror', every: 999, warning: 0, duration: 0, startAt: 0 }],
      boss: { cardId: 'boss_eclipse_sovereign', atRatio: 0.42, lane: 'weaker', announcement: '灵魂收税者降临市集', power: 'soulDrain', powerName: '灵魂什一税', powerEvery: 17.5 },
      reward: { title: '猎印法典', text: '解锁新阵营卡：灵魂猎印。', card: 'shadow_mark' }
    },
    {
      id: 7, act: '影渊篇 · 第四幕', title: '折跃狩场', subtitle: '强军也会被放错桥', biome: 'shadow', mapId: 'shadow_crescent', duration: 222, difficulty: 7,
      briefing: 'Boss会把最强的友军折跃到另一条通路，并清除其目标锁定。保留低费支援，避免单一路线完全失去前排。',
      objective: '适应强制换路，在弯月双路中维持两侧战线。',
      intro: [
        { speaker: '弦月', portrait: '◈', text: '月蚀回廊会把单位的目标和位置同时重写。我们最强的小队可能突然出现在另一座桥上。' },
        { speaker: '指挥官', portrait: '◆', text: '那就不要让任何一路只靠一个答案。' }
      ],
      outro: [{ speaker: '邵铃', portrait: '⌁', text: '君王似乎很不喜欢我们学会他的规则。好消息，这通常代表我们学对了。' }],
      enemyDeck: ['shadow_lurker','shadow_stalkers','shadow_gate','shadow_eye','shadow_archon','shadow_pylon'], stages,
      enemyCoreHp: 2010, enemyOutpostHp: 555, playerCoreHp: 2070, playerOutpostHp: 535,
      ai: { thinkMin: 1.55, thinkMax: 2.48, startDelay: 4.5, energyMul: 1.08, hpMul: 1.07, damageMul: 1.06, aggression: 0.71 },
      hazards: [{ type: 'shadowMist', every: 26, warning: 2.3, duration: 8, startAt: 15 }],
      boss: { cardId: 'boss_eclipse_sovereign', atRatio: 0.4, lane: 'stronger', announcement: '月蚀猎王开启折跃狩场', power: 'riftSwap', powerName: '王桥易位', powerEvery: 18.5 },
      reward: { title: '帷幕后行术', text: '解锁新阵营卡：帷幕后行者。', card: 'shadow_stalkers' }
    },
    {
      id: 8, act: '影渊篇 · 第四幕', title: '日蚀蜂巢', subtitle: '当机器也学会隐藏', biome: 'steel', mapId: 'steel_cross', duration: 228, difficulty: 8,
      briefing: '教团让机械蜂巢获得隐匿与护盾。日蚀期间敌军会脱离现有锁定，再从最近目标开始重新索敌。',
      objective: '在护盾脉冲和日蚀重置之间选择爆发窗口。',
      intro: [
        { speaker: '弦月', portrait: '◈', text: '蜂巢正在运行一种不属于机械阵营的协议：隐藏自身，然后等待敌方重新选择目标。' },
        { speaker: '邵铃', portrait: '⌁', text: '日蚀出现时别浪费单体爆发。等它们重新显形，再把账一起结。' }
      ],
      outro: [{ speaker: '指挥官', portrait: '◆', text: '教团正在把四个生态区的规则合并。下一站就是他们的合唱中枢。' }],
      enemyDeck: ['shield_bot','gunwalker','shadow_eye','shadow_stalkers','shield_pylon','shadow_gate'], stages,
      enemyCoreHp: 2140, enemyOutpostHp: 585, playerCoreHp: 2120, playerOutpostHp: 550,
      ai: { thinkMin: 1.48, thinkMax: 2.38, startDelay: 4, energyMul: 1.1, hpMul: 1.09, damageMul: 1.08, aggression: 0.73 },
      hazards: [{ type: 'shieldPulse', every: 25, warning: 2.1, duration: 0.5, startAt: 16 }, { type: 'shadowMist', every: 33, warning: 2.4, duration: 8, startAt: 24 }],
      boss: { cardId: 'boss_eclipse_sovereign', atRatio: 0.46, lane: 'weaker', announcement: '蚀光蜂后隐藏全军', power: 'eclipseVeil', powerName: '黑日幕墙', powerEvery: 20, powerDuration: 7 },
      reward: { title: '噩梦门芯', text: '解锁新阵营卡：噩梦裂隙门。', card: 'shadow_gate' }
    },
    {
      id: 9, act: '影渊篇 · 终幕', title: '影渊合唱', subtitle: '每一座门都在唱同一个名字', biome: 'shadow', mapId: 'core_nexus', duration: 238, difficulty: 9,
      briefing: '三条通路会持续出现裂隙门。Boss发动猎犬门庭时，所有通路同时涌出建筑偏好单位。',
      objective: '优先拆除裂隙门，避免多路攻城单位汇合。',
      intro: [
        { speaker: '弦月', portrait: '◈', text: '中枢里没有指挥官，只有一千多个同步吟唱的目标选择器。' },
        { speaker: '邵铃', portrait: '⌁', text: '简单说，每扇门都想让所有人去打同一座塔。我们得让它们闭嘴。' }
      ],
      outro: [{ speaker: '影渊君王', portrait: '☿', text: '你们学会了选择目标，却仍未学会为何必须有目标。来王桥，我会给你唯一的答案。' }],
      enemyDeck: ['shadow_gate','shadow_gate','shadow_hounds','shadow_seers','shadow_archon','shadow_pylon','shadow_wraith'], stages,
      enemyCoreHp: 2290, enemyOutpostHp: 620, playerCoreHp: 2170, playerOutpostHp: 570,
      ai: { thinkMin: 1.42, thinkMax: 2.3, startDelay: 4, energyMul: 1.12, hpMul: 1.11, damageMul: 1.1, aggression: 0.76 },
      hazards: [{ type: 'timeLock', every: 38, warning: 2.3, duration: 6, startAt: 25 }],
      boss: { cardId: 'boss_eclipse_sovereign', atRatio: 0.38, lane: 'weaker', announcement: '影渊合唱唤醒门庭主宰', power: 'nightmareGate', powerName: '万门齐开', powerEvery: 17 },
      reward: { title: '执政官印记', text: '解锁新阵营传奇：蚀界执政官。', card: 'shadow_archon' }
    },
    {
      id: 10, act: '影渊篇 · 终幕', title: '最后的桥', subtitle: '没有唯一目标，只有持续选择', biome: 'shadow', mapId: 'shadow_throne', duration: 255, difficulty: 10,
      briefing: '影渊君王会轮流发动诱导劫持、王桥易位、日蚀隐匿和灵魂抽取。三座王桥的距离与牵引建筑位置将决定最终战线。',
      objective: '适应四种索敌规则变化，击败影渊君王并摧毁王座核心。',
      intro: [
        { speaker: '影渊君王', portrait: '☿', text: '军队需要目标，网络需要目标，文明也需要目标。选择太多，只会制造噪声。' },
        { speaker: '指挥官', portrait: '◆', text: '那不是噪声。那是每个人都还活着的证据。' },
        { speaker: '弦月', portrait: '◈', text: '王桥协议全部开启。索敌半径、路线与锁定随时可能被改写。' }
      ],
      outro: [
        { speaker: '影渊君王', portrait: '☿', text: '目标……丢失。' },
        { speaker: '邵铃', portrait: '⌁', text: '不，是目标太多了。欢迎回到真正的世界。' },
        { speaker: '弦月', portrait: '◈', text: '王桥网络解除单一指令。所有地区重新获得独立选择权。' }
      ],
      enemyDeck: ['shadow_hounds','shadow_sentinels','shadow_seers','shadow_stalkers','shadow_lurker','shadow_gate','shadow_pylon','shadow_archon'], stages,
      enemyCoreHp: 2550, enemyOutpostHp: 675, playerCoreHp: 2250, playerOutpostHp: 600,
      ai: { thinkMin: 1.32, thinkMax: 2.15, startDelay: 3.5, energyMul: 1.15, hpMul: 1.14, damageMul: 1.12, aggression: 0.8 },
      hazards: [{ type: 'shadowMist', every: 25, warning: 2.2, duration: 7.5, startAt: 14 }, { type: 'shieldPulse', every: 36, warning: 2.1, duration: 0.5, startAt: 25 }],
      boss: { cardId: 'boss_eclipse_sovereign', atRatio: 0.34, lane: 'stronger', announcement: '影渊君王·瑟洛登临最后的桥', power: 'eclipseDominion', powerName: '唯一目标', powerEvery: 15.8, powerDuration: 7.2 },
      reward: { title: '影渊篇完成', text: '完成全新十关战役，并永久解锁影渊教团的完整标准卡牌。', modifier: 'campaignComplete' }
    }
  ]);

  RF.ROGUE_BIOMES = Object.freeze([
    ...RF.ROGUE_BIOMES.filter((biome) => biome.id !== 'shadow'),
    Object.freeze({
      id: 'shadow', name: '影渊王桥', icon: '☾', maps: ['shadow_hourglass','shadow_labyrinth','shadow_crescent','shadow_throne'],
      summary: '高优先级方尖碑会牵引军队，隐匿单位则会暂时脱离远程索敌。',
      hazard: { type: 'shadowMist', every: 27, warning: 2.4, duration: 7.5, startAt: 15 },
      deck: ['shadow_hounds','shadow_sentinels','shadow_seers','shadow_stalkers','shadow_lurker','shadow_gate','shadow_pylon']
    })
  ]);

  RF.STORY_ACT_COLORS = Object.freeze({
    '影渊篇 · 第一幕': '#8ea6ff', '影渊篇 · 第二幕': '#a178ff', '影渊篇 · 第三幕': '#bd65ff',
    '影渊篇 · 第四幕': '#d05dff', '影渊篇 · 终幕': '#ff7adc'
  });

  RF.PLAYER_CARD_IDS = Object.freeze(Object.keys(RF.CARDS).filter((id) => !RF.CARDS[id].enemyOnly && !RF.CARDS[id].treasure));
  if (RF.UI?.factionNames) RF.UI.factionNames.shadow = '影渊教团';
  if (RF.UI?.biomeNames) RF.UI.biomeNames.shadow = '影渊';
  if (RF.UI?.biomeIcons) RF.UI.biomeIcons.shadow = '☾';
})();
