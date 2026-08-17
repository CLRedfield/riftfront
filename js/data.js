(function () {
  'use strict';

  const RF = window.RF = window.RF || {};

  RF.VERSION = '1.5.0';
  RF.GROUPS = [
    { id: 'arsenal', name: '战术牌库', short: '牌库', key: '牌', color: '#62d6ff', description: '整个30张套牌混洗后随机抽牌。' }
  ];

  const cards = {};
  const add = (card) => { cards[card.id] = Object.freeze(card); };

  // =============================
  // 玩家卡牌
  // =============================
  add({
    id: 'scouts', name: '边境侦察队', icon: '➤', cost: 1, type: 'unit', rarity: 'common', groupHint: 'vanguard',
    art: 'assets/unit_art/steel_paladin.webp', faction: 'federation',
    desc: '部署3名高速近战侦察兵。适合抢线、补刀与吸引火力。',
    unit: { count: 3, hp: 58, damage: 12, speed: 52, range: 26, cooldown: 0.72, radius: 11, role: 'melee', color: '#4dd8ff' }
  });
  add({
    id: 'rifle_squad', name: '线列步枪班', icon: '▰', cost: 2, type: 'unit', rarity: 'common', groupHint: 'vanguard',
    art: 'assets/unit_art/steel_paladin.webp', faction: 'federation',
    desc: '部署3名标准远程步兵。火力稳定，但需要前排保护。',
    unit: { count: 3, hp: 72, damage: 16, speed: 32, range: 150, cooldown: 1.05, radius: 12, role: 'ranged', projectile: true, color: '#62d6ff' }
  });
  add({
    id: 'shield_squad', name: '折光盾墙班', icon: '⬢', cost: 2, type: 'unit', rarity: 'common', groupHint: 'vanguard',
    art: 'assets/unit_art/steel_paladin.webp', faction: 'federation',
    desc: '部署4名高耐久盾兵。受到的伤害降低15%。',
    unit: { count: 4, hp: 126, damage: 9, speed: 23, range: 28, cooldown: 0.95, radius: 14, role: 'tank', armor: 0.15, color: '#70a8ff' }
  });
  add({
    id: 'raiders', name: '磁轨突击手', icon: '⚡', cost: 2, type: 'unit', rarity: 'common', groupHint: 'vanguard',
    art: 'assets/unit_art/sky_lancer.webp', faction: 'federation',
    desc: '部署2名高速突击手。首次攻击造成额外伤害。',
    unit: { count: 2, hp: 92, damage: 24, speed: 59, range: 30, cooldown: 0.82, radius: 13, role: 'melee', chargeBonus: 22, color: '#51f6c0' }
  });
  add({
    id: 'field_medic', name: '战地医疗组', icon: '✚', cost: 2, type: 'unit', rarity: 'rare', groupHint: 'vanguard',
    art: 'assets/unit_art/radiant_medic.webp', faction: 'federation',
    desc: '部署2名医疗员，自动治疗附近受伤友军。自身没有攻击能力。',
    unit: { count: 2, hp: 68, heal: 18, speed: 30, range: 126, cooldown: 1.15, radius: 12, role: 'healer', projectile: true, color: '#62ffb8' }
  });
  add({
    id: 'drone_swarm', name: '蜂针无人机群', icon: '✦', cost: 2, type: 'unit', rarity: 'rare', groupHint: 'vanguard',
    art: 'assets/unit_art/steel_gunship.webp', faction: 'federation',
    desc: '部署4架轻型无人机。移速快、射速高，但非常脆弱。',
    unit: { count: 4, hp: 44, damage: 10, speed: 48, range: 112, cooldown: 0.68, radius: 9, role: 'ranged', flying: true, projectile: true, color: '#88f3ff' }
  });
  add({
    id: 'barricade', name: '折叠式路障', icon: '▥', cost: 2, type: 'building', rarity: 'common', groupHint: 'vanguard',
    desc: '部署一座临时路障，阻挡敌军45秒。',
    building: { hp: 420, duration: 45, radius: 23, role: 'wall', color: '#75a7c8' }
  });
  add({
    id: 'rally', name: '锋线动员', icon: '⌁', cost: 2, type: 'spell', rarity: 'rare', groupHint: 'vanguard', target: 'friendly',
    desc: '目标区域友军8秒内伤害与移动速度提高25%。', spell: { effect: 'rally', radius: 145, duration: 8 }
  });

  add({
    id: 'flamers', name: '热流喷射组', icon: '♨', cost: 3, type: 'unit', rarity: 'common', groupHint: 'response',
    art: 'assets/unit_art/magma_titan.webp', faction: 'federation',
    desc: '部署2名近程范围火力兵，对密集小队效果极佳。',
    unit: { count: 2, hp: 96, damage: 13, speed: 27, range: 86, cooldown: 0.54, radius: 13, role: 'ranged', aoe: 52, projectile: true, color: '#ff9c63' }
  });
  add({
    id: 'sniper', name: '长视距狙击手', icon: '◎', cost: 3, type: 'unit', rarity: 'rare', groupHint: 'response',
    art: 'assets/unit_art/prism_caster.webp', faction: 'federation',
    desc: '部署1名超远程狙击手。攻击缓慢，但单发伤害很高。',
    unit: { count: 1, hp: 64, damage: 58, speed: 24, range: 252, cooldown: 2.35, radius: 12, role: 'ranged', projectile: true, color: '#cfb4ff' }
  });
  add({
    id: 'cryo_bomb', name: '低温坍缩弹', icon: '❄', cost: 3, type: 'spell', rarity: 'rare', groupHint: 'response', target: 'enemy',
    desc: '冻结目标区域敌军2.8秒，随后使其减速6秒。', spell: { effect: 'freeze', radius: 125, freeze: 2.8, slow: 6 }
  });
  add({
    id: 'auto_turret', name: '哨戒自动炮', icon: '⌾', cost: 3, type: 'building', rarity: 'common', groupHint: 'response',
    art: 'assets/unit_art/steel_turret.webp', faction: 'federation',
    desc: '部署一座持续50秒的自动炮塔。',
    building: { hp: 320, duration: 50, radius: 21, role: 'turret', damage: 24, range: 190, cooldown: 0.72, projectile: true, color: '#b79aff' }
  });
  add({
    id: 'repair_wave', name: '纳米维修波', icon: '⟲', cost: 2, type: 'spell', rarity: 'common', groupHint: 'response', target: 'friendly',
    desc: '治疗目标区域友军和防御设施，并为核心恢复少量生命。', spell: { effect: 'repair', radius: 155, heal: 190 }
  });
  add({
    id: 'mortar_team', name: '弧线迫击炮组', icon: '◉', cost: 4, type: 'unit', rarity: 'rare', groupHint: 'response',
    art: 'assets/unit_art/steel_turret.webp', faction: 'federation',
    desc: '部署2名超远程范围炮手。敌人贴身后难以还击。',
    unit: { count: 2, hp: 82, damage: 45, speed: 19, range: 265, minRange: 74, cooldown: 2.45, radius: 13, role: 'siege', aoe: 58, projectile: true, color: '#c89cff' }
  });
  add({
    id: 'interceptors', name: '截击枪骑队', icon: '✧', cost: 3, type: 'unit', rarity: 'rare', groupHint: 'response',
    art: 'assets/unit_art/sky_lancer.webp', faction: 'federation',
    desc: '部署3名机动射手。对重型单位造成50%额外伤害。',
    unit: { count: 3, hp: 88, damage: 20, speed: 38, range: 108, cooldown: 0.88, radius: 12, role: 'ranged', projectile: true, bonusVsHeavy: 0.5, color: '#be8cff' }
  });
  add({
    id: 'reposition', name: '战术换线', icon: '⇅', cost: 1, type: 'spell', rarity: 'rare', groupHint: 'response', target: 'friendly',
    desc: '将目标区域最多4支友军改道至相邻通路，并给予短暂加速。', spell: { effect: 'reposition', radius: 150, count: 4 }
  });

  add({
    id: 'assault_mech', name: '破阵步行机', icon: '⬣', cost: 5, type: 'unit', rarity: 'epic', groupHint: 'finisher',
    art: 'assets/unit_art/steel_mech.webp', faction: 'federation',
    desc: '部署1台重装步行机。耐久优秀，攻击附带小范围冲击。',
    unit: { count: 1, hp: 440, damage: 50, speed: 21, range: 68, cooldown: 1.18, radius: 22, role: 'heavy', armor: 0.2, aoe: 28, heavy: true, color: '#ffc36b' }
  });
  add({
    id: 'siege_tank', name: '远征攻城车', icon: '▣', cost: 6, type: 'unit', rarity: 'epic', groupHint: 'finisher',
    art: 'assets/unit_art/steel_gunship.webp', faction: 'federation',
    desc: '部署1辆长射程攻城车。对建筑额外造成60%伤害。',
    unit: { count: 1, hp: 360, damage: 78, speed: 17, range: 270, minRange: 82, cooldown: 2.55, radius: 23, role: 'siege', projectile: true, bonusVsBuilding: 0.6, heavy: true, color: '#f9a94c' }
  });
  add({
    id: 'orbital_strike', name: '轨道碎星矛', icon: '☄', cost: 4, type: 'spell', rarity: 'epic', groupHint: 'finisher', target: 'enemy',
    desc: '短暂预警后，对目标区域造成高额范围伤害。对核心伤害降低。', spell: { effect: 'orbital', radius: 118, damage: 205, delay: 0.8 }
  });
  add({
    id: 'field_hospital', name: '折跃野战医院', icon: '✚', cost: 3, type: 'building', rarity: 'rare', groupHint: 'finisher',
    desc: '持续48秒，治疗附近友军。',
    building: { hp: 270, duration: 48, radius: 22, role: 'hospital', auraRange: 155, healPerSecond: 10, color: '#75ffc7' }
  });
  add({
    id: 'command_beacon', name: '战线指挥信标', icon: '⌂', cost: 4, type: 'building', rarity: 'epic', groupHint: 'finisher',
    desc: '持续45秒，使附近友军攻击速度提高22%。',
    building: { hp: 300, duration: 45, radius: 22, role: 'beacon', auraRange: 170, attackSpeedAura: 0.22, color: '#ffd16c' }
  });
  add({
    id: 'shock_troopers', name: '震荡突击队', icon: 'ϟ', cost: 4, type: 'unit', rarity: 'epic', groupHint: 'finisher',
    art: 'assets/unit_art/steel_mech.webp', faction: 'federation',
    desc: '部署3名重装突击兵，电弧攻击会波及附近敌人。',
    unit: { count: 3, hp: 158, damage: 30, speed: 34, range: 78, cooldown: 0.96, radius: 15, role: 'heavy', aoe: 36, heavy: true, color: '#ffcf6d' }
  });
  add({
    id: 'artillery_barrage', name: '三段式炮击', icon: '⟱', cost: 5, type: 'spell', rarity: 'epic', groupHint: 'finisher', target: 'enemy',
    desc: '在目标区域连续落下3轮炮击。适合封锁战线与摧毁建筑群。', spell: { effect: 'barrage', radius: 105, damage: 105, hits: 3, interval: 0.72 }
  });
  add({
    id: 'titan', name: '天穹泰坦', icon: '⬡', cost: 7, type: 'unit', rarity: 'legendary', groupHint: 'finisher',
    art: 'assets/unit_art/magma_titan.webp', faction: 'federation',
    desc: '部署1台超重型泰坦。推进缓慢，但能够持续撕开正面战线。',
    unit: { count: 1, hp: 840, damage: 98, speed: 13, range: 96, cooldown: 1.95, radius: 29, role: 'heavy', armor: 0.24, aoe: 62, heavy: true, color: '#ffb25d' }
  });


  // =============================
  // 孢潮母群玩家卡牌
  // =============================
  add({
    id: 'spore_runners', name: '孢跃幼群', icon: '❈', cost: 1, type: 'unit', rarity: 'common', faction: 'swarm',
    art: 'assets/unit_art/swarm_archer.webp',
    desc: '部署4只高速孢子幼体。阵亡时释放微型孢爆。',
    unit: { count: 4, hp: 46, damage: 10, speed: 50, range: 27, cooldown: 0.7, radius: 10, role: 'melee', deathBurst: 8, color: '#7fdf72' }
  });
  add({
    id: 'thorn_guard', name: '棘甲守卫', icon: '♣', cost: 2, type: 'unit', rarity: 'common', faction: 'swarm',
    art: 'assets/unit_art/swarm_brute.webp',
    desc: '部署3名棘甲守卫。生命较高并拥有天然减伤。',
    unit: { count: 3, hp: 116, damage: 10, speed: 23, range: 30, cooldown: 0.94, radius: 14, role: 'tank', armor: 0.13, color: '#6fd16e' }
  });
  add({
    id: 'mycelium_archer', name: '菌丝投射手', icon: '❧', cost: 2, type: 'unit', rarity: 'common', faction: 'swarm',
    art: 'assets/unit_art/swarm_archer.webp',
    desc: '部署3名远程投射手。攻击附带短暂毒素。',
    unit: { count: 3, hp: 66, damage: 15, speed: 31, range: 148, cooldown: 1.02, radius: 12, role: 'ranged', projectile: true, poison: 3, color: '#85e377' }
  });
  add({
    id: 'brood_nurse', name: '育巢修复者', icon: '✿', cost: 2, type: 'unit', rarity: 'rare', faction: 'swarm',
    art: 'assets/faction_swarm.webp',
    desc: '部署2名育巢修复者，持续治疗附近友军。',
    unit: { count: 2, hp: 74, heal: 17, speed: 29, range: 130, cooldown: 1.08, radius: 12, role: 'healer', projectile: true, color: '#a4ef7c' }
  });
  add({
    id: 'seed_turret', name: '爆籽喷吐塔', icon: '❀', cost: 3, type: 'building', rarity: 'common', faction: 'swarm',
    desc: '部署一株持续48秒的远程喷吐塔。',
    building: { hp: 310, duration: 48, radius: 22, role: 'turret', damage: 22, range: 185, cooldown: 0.76, projectile: true, color: '#79d76e' }
  });
  add({
    id: 'root_sanctuary', name: '根系圣所', icon: '♧', cost: 3, type: 'building', rarity: 'rare', faction: 'swarm',
    desc: '持续48秒，缓慢治疗附近友军。',
    building: { hp: 300, duration: 48, radius: 24, role: 'hospital', auraRange: 165, healPerSecond: 11, color: '#75e081' }
  });
  add({
    id: 'biomass_surge', name: '生物质奔涌', icon: '≋', cost: 2, type: 'spell', rarity: 'rare', faction: 'swarm', target: 'friendly',
    desc: '目标区域友军9秒内伤害和移动速度提高25%。', spell: { effect: 'rally', radius: 160, duration: 9 }
  });
  add({
    id: 'vine_ambush', name: '藤猎伏击群', icon: '✤', cost: 3, type: 'unit', rarity: 'rare', faction: 'swarm',
    art: 'assets/unit_art/swarm_archer.webp',
    desc: '部署4名伏击者。首次攻击造成额外伤害。',
    unit: { count: 4, hp: 78, damage: 18, speed: 45, range: 30, cooldown: 0.82, radius: 12, role: 'melee', chargeBonus: 18, color: '#66d16b' }
  });
  add({
    id: 'devourer_alpha', name: '吞噬兽阿尔法', icon: '◖', cost: 5, type: 'unit', rarity: 'epic', faction: 'swarm',
    art: 'assets/unit_art/swarm_brute.webp',
    desc: '部署1只重型吞噬兽。造成伤害时恢复生命。',
    unit: { count: 1, hp: 500, damage: 56, speed: 22, range: 38, cooldown: 1.18, radius: 26, role: 'heavy', heavy: true, lifeSteal: 0.28, color: '#62c95b' }
  });
  add({
    id: 'spore_meteor', name: '孢核陨落', icon: '☄', cost: 4, type: 'spell', rarity: 'epic', faction: 'swarm', target: 'enemy',
    desc: '短暂预警后轰击目标区域，并留下猛烈孢爆。', spell: { effect: 'orbital', radius: 128, damage: 220, delay: 0.9 }
  });
  add({
    id: 'bloom_colossus', name: '繁花巨像', icon: '✺', cost: 7, type: 'unit', rarity: 'legendary', faction: 'swarm',
    art: 'assets/boss_art/jungle_colossus.webp',
    desc: '部署1只超重型繁花巨像。高生命、范围攻击并具有吸血。',
    unit: { count: 1, hp: 820, damage: 90, speed: 13, range: 74, cooldown: 1.72, radius: 30, role: 'heavy', heavy: true, armor: 0.15, aoe: 60, lifeSteal: 0.12, color: '#8bda67' }
  });

  // =============================
  // 棱镜盟约玩家卡牌
  // =============================
  add({
    id: 'prism_acolyte', name: '棱晶侍从', icon: '◇', cost: 1, type: 'unit', rarity: 'common', faction: 'prism',
    art: 'assets/unit_art/prism_caster.webp',
    desc: '部署2名低费远程侍从。',
    unit: { count: 2, hp: 60, damage: 14, speed: 35, range: 138, cooldown: 0.92, radius: 11, role: 'ranged', projectile: true, color: '#bd8cff' }
  });
  add({
    id: 'mirror_blades', name: '镜刃刺客', icon: '◐', cost: 2, type: 'unit', rarity: 'common', faction: 'prism',
    art: 'assets/unit_art/prism_assassin.webp',
    desc: '部署3名高速镜刃刺客。首次攻击伤害提高。',
    unit: { count: 3, hp: 74, damage: 19, speed: 49, range: 29, cooldown: 0.78, radius: 12, role: 'melee', chargeBonus: 20, color: '#b874ff' }
  });
  add({
    id: 'crystal_guard', name: '晶盾卫士', icon: '⬙', cost: 2, type: 'unit', rarity: 'common', faction: 'prism',
    art: 'assets/unit_art/void_titan.webp',
    desc: '部署3名带有初始护盾的晶盾卫士。',
    unit: { count: 3, hp: 104, shield: 42, damage: 11, speed: 24, range: 30, cooldown: 0.95, radius: 14, role: 'tank', armor: 0.1, color: '#b89aff' }
  });
  add({
    id: 'phase_drone', name: '相位无人机', icon: '✧', cost: 2, type: 'unit', rarity: 'rare', faction: 'prism',
    art: 'assets/unit_art/steel_gunship.webp',
    desc: '部署3架飞行无人机。攻击快、机动高。',
    unit: { count: 3, hp: 50, damage: 12, speed: 50, range: 120, cooldown: 0.66, radius: 10, role: 'ranged', flying: true, projectile: true, color: '#c493ff' }
  });
  add({
    id: 'prism_medic', name: '光谱修复师', icon: '✦', cost: 2, type: 'unit', rarity: 'rare', faction: 'prism',
    art: 'assets/unit_art/radiant_medic.webp',
    desc: '部署1名高效修复师，治疗附近友军。',
    unit: { count: 1, hp: 82, heal: 25, speed: 31, range: 142, cooldown: 1.05, radius: 13, role: 'healer', projectile: true, shield: 55, color: '#d0a5ff' }
  });
  add({
    id: 'refraction_bolt', name: '折光冻结束', icon: '❄', cost: 2, type: 'spell', rarity: 'rare', faction: 'prism', target: 'enemy',
    desc: '冻结较小区域内的敌军2.2秒，并施加减速。', spell: { effect: 'freeze', radius: 105, freeze: 2.2, slow: 5.2 }
  });
  add({
    id: 'phase_turret', name: '相位棱镜塔', icon: '⌾', cost: 3, type: 'building', rarity: 'rare', faction: 'prism',
    art: 'assets/unit_art/steel_turret.webp',
    desc: '部署一座持续48秒的长射程相位炮塔。',
    building: { hp: 285, duration: 48, radius: 21, role: 'turret', damage: 27, range: 205, cooldown: 0.78, projectile: true, color: '#c18dff' }
  });
  add({
    id: 'mirror_shift', name: '镜面换位', icon: '⇄', cost: 1, type: 'spell', rarity: 'rare', faction: 'prism', target: 'friendly',
    desc: '将目标区域最多5支友军转移到相邻通路并短暂强化。', spell: { effect: 'reposition', radius: 165, count: 5 }
  });
  add({
    id: 'shard_knight', name: '碎晶骑士', icon: '◆', cost: 4, type: 'unit', rarity: 'epic', faction: 'prism',
    art: 'assets/unit_art/void_titan.webp',
    desc: '部署2名重装碎晶骑士，拥有护盾和范围攻击。',
    unit: { count: 2, hp: 235, shield: 70, damage: 36, speed: 28, range: 48, cooldown: 1.03, radius: 17, role: 'heavy', heavy: true, armor: 0.12, aoe: 28, color: '#b883ff' }
  });
  add({
    id: 'void_lance', name: '虚空裂界矛', icon: '✦', cost: 4, type: 'spell', rarity: 'epic', faction: 'prism', target: 'enemy',
    desc: '短暂预警后，对目标区域造成极高伤害。', spell: { effect: 'orbital', radius: 112, damage: 235, delay: 0.65 }
  });
  add({
    id: 'crystal_titan', name: '晶穹泰坦', icon: '⬡', cost: 7, type: 'unit', rarity: 'legendary', faction: 'prism',
    art: 'assets/boss_art/void_lord.webp',
    desc: '部署1台携带巨额护盾的晶体泰坦。',
    unit: { count: 1, hp: 760, shield: 190, damage: 94, speed: 14, range: 105, cooldown: 1.82, radius: 30, role: 'heavy', heavy: true, armor: 0.18, aoe: 56, projectile: true, color: '#c492ff' }
  });

  // =============================
  // 肉鸽主动宝藏卡
  // =============================
  add({
    id: 'treasure_overflow_cell', name: '无尽能量匣', icon: '∞', cost: 0, type: 'spell', rarity: 'legendary', treasure: true, faction: 'neutral', target: 'friendly',
    desc: '立即获得4点费用。', spell: { effect: 'energy', amount: 4 }
  });
  add({
    id: 'treasure_chronostasis', name: '全域时停仪', icon: '◴', cost: 1, type: 'spell', rarity: 'legendary', treasure: true, faction: 'neutral', target: 'enemy',
    desc: '冻结所有敌方单位4.2秒。', spell: { effect: 'timeStop', duration: 4.2 }
  });
  add({
    id: 'treasure_meteor_array', name: '星陨炮阵', icon: '☄', cost: 2, type: 'spell', rarity: 'legendary', treasure: true, faction: 'neutral', target: 'enemy',
    desc: '在目标区域连续落下5轮高伤害炮击。', spell: { effect: 'barrage', radius: 118, damage: 155, hits: 5, interval: 0.42 }
  });
  add({
    id: 'treasure_world_engine', name: '世界引擎', icon: '✺', cost: 4, type: 'building', rarity: 'legendary', treasure: true, faction: 'neutral',
    art: 'assets/unit_art/steel_turret.webp',
    desc: '部署一座持续60秒的世界引擎，周期性为附近友军提供护盾与攻速。',
    building: { hp: 620, duration: 60, radius: 29, role: 'beacon', auraRange: 210, attackSpeedAura: 0.3, shieldPulse: 65, color: '#ffd16f' }
  });
  add({
    id: 'treasure_clone_fleet', name: '复制舰群', icon: '✧', cost: 3, type: 'unit', rarity: 'legendary', treasure: true, faction: 'neutral',
    art: 'assets/unit_art/steel_gunship.webp',
    desc: '部署6架强化飞行无人机。',
    unit: { count: 6, hp: 72, damage: 17, speed: 56, range: 135, cooldown: 0.58, radius: 10, role: 'ranged', flying: true, projectile: true, shield: 35, color: '#ffd77d' }
  });
  add({
    id: 'treasure_omega_titan', name: '欧米伽泰坦', icon: 'Ω', cost: 5, type: 'unit', rarity: 'legendary', treasure: true, faction: 'neutral',
    art: 'assets/boss_art/steel_overlord.webp',
    desc: '部署一台远超常规规格的终极泰坦。',
    unit: { count: 1, hp: 1120, shield: 220, damage: 122, speed: 15, range: 115, cooldown: 1.52, radius: 34, role: 'heavy', heavy: true, armor: 0.25, aoe: 72, projectile: true, color: '#ffd06b' }
  });

  // =============================
  // 敌方主题卡牌
  // =============================
  add({
    id: 'enemy_scrapper', name: '荒原拾荒者', icon: '◆', cost: 1, type: 'unit', enemyOnly: true,
    unit: { count: 3, hp: 54, damage: 11, speed: 43, range: 28, cooldown: 0.82, radius: 11, role: 'melee', color: '#ff7f73' }
  });
  add({
    id: 'enemy_gunner', name: '荒原枪手', icon: '▸', cost: 2, type: 'unit', enemyOnly: true,
    unit: { count: 3, hp: 68, damage: 14, speed: 30, range: 142, cooldown: 1.08, radius: 12, role: 'ranged', projectile: true, color: '#ff8b78' }
  });
  add({
    id: 'enemy_brute', name: '铁皮蛮兵', icon: '⬟', cost: 3, type: 'unit', enemyOnly: true,
    unit: { count: 2, hp: 168, damage: 24, speed: 23, range: 31, cooldown: 1.1, radius: 16, role: 'tank', armor: 0.1, color: '#ef6a65' }
  });
  add({
    id: 'enemy_turret', name: '拼装炮塔', icon: '⌾', cost: 3, type: 'building', enemyOnly: true,
    building: { hp: 270, duration: 46, radius: 21, role: 'turret', damage: 20, range: 178, cooldown: 0.82, projectile: true, color: '#ed726a' }
  });

  add({
    id: 'frostling', name: '霜壳幼体', icon: '❅', cost: 1, type: 'unit', enemyOnly: true,
    unit: { count: 4, hp: 52, damage: 10, speed: 38, range: 28, cooldown: 0.76, radius: 10, role: 'melee', chill: 1, color: '#88d9ff' }
  });
  add({
    id: 'ice_guard', name: '霜甲卫士', icon: '❆', cost: 3, type: 'unit', enemyOnly: true,
    unit: { count: 2, hp: 205, damage: 20, speed: 20, range: 31, cooldown: 1.15, radius: 17, role: 'tank', armor: 0.22, chill: 1, color: '#6bbfff' }
  });
  add({
    id: 'frost_mage', name: '冰晶祭司', icon: '✧', cost: 3, type: 'unit', enemyOnly: true,
    unit: { count: 2, hp: 88, damage: 16, speed: 24, range: 168, cooldown: 1.25, radius: 13, role: 'ranged', projectile: true, chill: 2, aoe: 28, color: '#b4e8ff' }
  });
  add({
    id: 'snow_beast', name: '滚雪巨兽', icon: '●', cost: 5, type: 'unit', enemyOnly: true,
    unit: { count: 1, hp: 510, damage: 62, speed: 31, range: 35, cooldown: 1.45, radius: 25, role: 'heavy', heavy: true, chargeBonus: 35, chill: 1, color: '#d7f5ff' }
  });
  add({
    id: 'blizzard_totem', name: '暴雪信标', icon: '❄', cost: 4, type: 'building', enemyOnly: true,
    building: { hp: 300, duration: 52, radius: 22, role: 'blizzard', auraRange: 210, slowAura: 0.24, color: '#8bdcff' }
  });
  add({
    id: 'boss_frost_giant', name: '永冬巨像', icon: '❉', cost: 9, type: 'unit', enemyOnly: true, boss: true,
    art: 'assets/boss_art/frost_dragon.webp',
    unit: { count: 1, hp: 1250, damage: 72, speed: 12, range: 74, cooldown: 1.45, radius: 36, role: 'boss', armor: 0.16, aoe: 58, heavy: true, chill: 2, color: '#aeeaff' }
  });

  add({
    id: 'jungle_stalker', name: '叶刃伏击者', icon: '✤', cost: 1, type: 'unit', enemyOnly: true,
    unit: { count: 3, hp: 62, damage: 17, speed: 45, range: 29, cooldown: 0.82, radius: 11, role: 'melee', chargeBonus: 15, color: '#6edb7d' }
  });
  add({
    id: 'spore_thrower', name: '孢子投手', icon: '☘', cost: 3, type: 'unit', enemyOnly: true,
    unit: { count: 2, hp: 96, damage: 18, speed: 25, range: 170, cooldown: 1.22, radius: 14, role: 'ranged', projectile: true, aoe: 34, poison: 4, color: '#91e36c' }
  });
  add({
    id: 'vine_beast', name: '缠根兽', icon: '♣', cost: 3, type: 'unit', enemyOnly: true,
    unit: { count: 2, hp: 215, damage: 22, speed: 19, range: 33, cooldown: 1.1, radius: 18, role: 'tank', armor: 0.12, color: '#4fbf68' }
  });
  add({
    id: 'devourer', name: '吞噬兽', icon: '◖', cost: 5, type: 'unit', enemyOnly: true,
    unit: { count: 1, hp: 590, damage: 54, speed: 21, range: 38, cooldown: 1.22, radius: 27, role: 'heavy', heavy: true, lifeSteal: 0.25, color: '#64c953' }
  });
  add({
    id: 'brood_nest', name: '适应巢穴', icon: '❀', cost: 4, type: 'building', enemyOnly: true,
    building: { hp: 340, duration: 48, radius: 25, role: 'spawner', spawnCard: 'jungle_stalker', spawnEvery: 8.4, color: '#73d66f' }
  });
  add({
    id: 'boss_bloom_mother', name: '千口花母', icon: '✺', cost: 9, type: 'building', enemyOnly: true, boss: true,
    art: 'assets/boss_art/jungle_colossus.webp',
    building: { hp: 1450, duration: 999, radius: 42, role: 'bossSpawner', spawnCard: 'spore_thrower', spawnEvery: 7.4, healPerSecond: 7, color: '#88dc66' }
  });

  add({
    id: 'magma_imp', name: '熔岩幼体', icon: '◈', cost: 1, type: 'unit', enemyOnly: true,
    unit: { count: 4, hp: 48, damage: 13, speed: 42, range: 27, cooldown: 0.72, radius: 10, role: 'melee', deathBurst: 22, color: '#ff8a45' }
  });
  add({
    id: 'obsidian_guard', name: '黑曜石守卫', icon: '⬖', cost: 3, type: 'unit', enemyOnly: true,
    unit: { count: 2, hp: 230, damage: 25, speed: 18, range: 32, cooldown: 1.08, radius: 18, role: 'tank', armor: 0.28, color: '#c95f3f' }
  });
  add({
    id: 'fire_bug', name: '喷火甲虫', icon: '♨', cost: 3, type: 'unit', enemyOnly: true,
    unit: { count: 2, hp: 105, damage: 15, speed: 27, range: 108, cooldown: 0.68, radius: 14, role: 'ranged', projectile: true, aoe: 44, color: '#ffad54' }
  });
  add({
    id: 'lava_carrier', name: '岩浆运输兽', icon: '⬤', cost: 5, type: 'unit', enemyOnly: true,
    unit: { count: 1, hp: 620, damage: 42, speed: 17, range: 42, cooldown: 1.35, radius: 29, role: 'heavy', heavy: true, spawnCard: 'magma_imp', spawnEvery: 8.4, color: '#f47736' }
  });
  add({
    id: 'furnace_priest', name: '炉心祭司', icon: '☼', cost: 4, type: 'unit', enemyOnly: true,
    unit: { count: 2, hp: 100, damage: 25, speed: 22, range: 176, cooldown: 1.35, radius: 14, role: 'ranged', projectile: true, aoe: 30, color: '#ffc05d' }
  });
  add({
    id: 'boss_magma_colossus', name: '火山心脏', icon: '✹', cost: 9, type: 'unit', enemyOnly: true, boss: true,
    art: 'assets/boss_art/magma_lord.webp',
    unit: { count: 1, hp: 1520, damage: 86, speed: 11, range: 82, cooldown: 1.38, radius: 38, role: 'boss', armor: 0.18, aoe: 70, heavy: true, deathBurst: 160, color: '#ff7b34' }
  });

  add({
    id: 'steel_drone', name: '蜂巢截击机', icon: '✥', cost: 2, type: 'unit', enemyOnly: true,
    unit: { count: 4, hp: 58, damage: 12, speed: 48, range: 118, cooldown: 0.72, radius: 10, role: 'ranged', flying: true, projectile: true, color: '#ff6f8e' }
  });
  add({
    id: 'shield_bot', name: '联盾机兵', icon: '⬡', cost: 3, type: 'unit', enemyOnly: true,
    unit: { count: 3, hp: 145, damage: 16, speed: 25, range: 70, cooldown: 0.92, radius: 15, role: 'tank', armor: 0.14, shield: 60, color: '#f57fa8' }
  });
  add({
    id: 'gunwalker', name: '蜂巢枪行者', icon: '▧', cost: 5, type: 'unit', enemyOnly: true,
    unit: { count: 1, hp: 480, damage: 42, speed: 20, range: 185, cooldown: 0.92, radius: 25, role: 'heavy', heavy: true, projectile: true, color: '#f05f8e' }
  });
  add({
    id: 'repair_node', name: '自律维修节点', icon: '⌘', cost: 4, type: 'building', enemyOnly: true,
    building: { hp: 330, duration: 52, radius: 22, role: 'hospital', auraRange: 165, healPerSecond: 12, color: '#ff7aa2' }
  });
  add({
    id: 'shield_pylon', name: '护盾链塔', icon: '◇', cost: 4, type: 'building', enemyOnly: true,
    building: { hp: 350, duration: 52, radius: 23, role: 'beacon', auraRange: 175, attackSpeedAura: 0.18, shieldPulse: 35, color: '#ff84b0' }
  });
  add({
    id: 'boss_hive_mind', name: '母炉机群', icon: '⌬', cost: 9, type: 'unit', enemyOnly: true, boss: true,
    art: 'assets/boss_art/steel_hivemind.webp',
    unit: { count: 1, hp: 1650, damage: 58, speed: 14, range: 190, cooldown: 0.9, radius: 37, role: 'boss', armor: 0.2, heavy: true, projectile: true, spawnCard: 'steel_drone', spawnEvery: 6.8, shield: 220, color: '#ff6c99' }
  });

  add({
    id: 'mirror_sentry', name: '镜像哨兵', icon: '◐', cost: 2, type: 'unit', enemyOnly: true,
    unit: { count: 3, hp: 92, damage: 18, speed: 34, range: 128, cooldown: 0.94, radius: 13, role: 'ranged', projectile: true, color: '#f399ff' }
  });
  add({
    id: 'mirror_knight', name: '折光骑士', icon: '◒', cost: 4, type: 'unit', enemyOnly: true,
    unit: { count: 2, hp: 245, damage: 34, speed: 29, range: 38, cooldown: 1.02, radius: 18, role: 'heavy', heavy: true, armor: 0.14, color: '#d887ff' }
  });
  add({
    id: 'boss_core_avatar', name: '伊甸·核心化身', icon: '✣', cost: 10, type: 'unit', enemyOnly: true, boss: true,
    art: 'assets/boss_art/void_lord.webp',
    unit: { count: 1, hp: 2050, damage: 94, speed: 13, range: 155, cooldown: 1.15, radius: 42, role: 'boss', armor: 0.2, aoe: 54, heavy: true, projectile: true, spawnCard: 'mirror_sentry', spawnEvery: 6.4, shield: 300, color: '#ef8cff' }
  });


  // =============================
  // V1.3 阵营专属卡牌与远征宝藏
  // =============================
  add({
    id: 'fed_guardian_squad', name: '联邦圣盾连', icon: '🛡', cost: 2, type: 'unit', rarity: 'rare', faction: 'federation',
    desc: '部署3名圣盾步兵。护甲较高，适合在宽战区中央稳定接战。',
    unit: { count: 3, hp: 112, damage: 13, speed: 27, range: 34, cooldown: 0.92, radius: 14, role: 'tank', armor: 0.18, color: '#63b9ff' }
  });
  add({
    id: 'fed_engineer_team', name: '联邦战地工程组', icon: '🔧', cost: 3, type: 'unit', rarity: 'rare', faction: 'federation',
    desc: '部署2名工程师，持续治疗附近友军并维持前线工事。',
    unit: { count: 2, hp: 86, heal: 20, speed: 29, range: 136, cooldown: 1.05, radius: 12, role: 'healer', projectile: true, color: '#78d6ff' }
  });
  add({
    id: 'fed_skyriders', name: '狮鹫空骑队', icon: '🪽', cost: 4, type: 'unit', rarity: 'epic', faction: 'federation',
    desc: '部署2名高速空骑士。可越过地形，优先袭击脆弱后排。',
    unit: { count: 2, hp: 126, damage: 31, speed: 51, range: 118, cooldown: 0.86, radius: 15, role: 'ranged', flying: true, projectile: true, chargeBonus: 16, color: '#9ed8ff' }
  });
  add({
    id: 'fed_rail_tank', name: '苍穹磁轨战车', icon: '🚙', cost: 6, type: 'unit', rarity: 'legendary', faction: 'federation',
    desc: '部署1辆超重型磁轨战车。射程远、护甲厚，并擅长破坏建筑。',
    unit: { count: 1, hp: 640, damage: 88, speed: 18, range: 205, minRange: 54, cooldown: 2.05, radius: 27, role: 'heavy', projectile: true, heavy: true, armor: 0.24, bonusVsBuilding: 0.45, color: '#58aef2' }
  });

  add({
    id: 'swarm_raiders', name: '孢潮猎袭群', icon: '🌿', cost: 1, type: 'unit', rarity: 'common', faction: 'swarm',
    desc: '部署4只高速猎袭生物。会从造成的伤害中恢复少量生命。',
    unit: { count: 4, hp: 54, damage: 14, speed: 55, range: 27, cooldown: 0.7, radius: 10, role: 'melee', lifeSteal: 0.1, color: '#71dc75' }
  });
  add({
    id: 'swarm_thorn_guard', name: '荆甲守卫群', icon: '🌳', cost: 2, type: 'unit', rarity: 'rare', faction: 'swarm',
    desc: '部署3名荆甲守卫。生命较高，能够吸收正面火力。',
    unit: { count: 3, hp: 138, damage: 12, speed: 24, range: 31, cooldown: 0.98, radius: 15, role: 'tank', armor: 0.14, color: '#6ccc69' }
  });
  add({
    id: 'swarm_bloom_sage', name: '月辉繁花使', icon: '🌙', cost: 3, type: 'unit', rarity: 'epic', faction: 'swarm',
    desc: '部署2名繁花使，远程治疗友军并维持生体推进。',
    unit: { count: 2, hp: 90, heal: 22, speed: 28, range: 148, cooldown: 1.0, radius: 13, role: 'healer', projectile: true, color: '#9ee780' }
  });
  add({
    id: 'swarm_ancient', name: '世界根古兽', icon: '🦌', cost: 6, type: 'unit', rarity: 'legendary', faction: 'swarm',
    desc: '部署1头世界根古兽。攻击附带范围冲击，并周期性孵化猎袭群。',
    unit: { count: 1, hp: 720, damage: 66, speed: 17, range: 58, cooldown: 1.35, radius: 30, role: 'heavy', heavy: true, armor: 0.16, aoe: 48, lifeSteal: 0.18, spawnCard: 'swarm_raiders', spawnEvery: 9.2, color: '#66bd5a' }
  });

  add({
    id: 'prism_adepts', name: '棱晶术士团', icon: '🔮', cost: 2, type: 'unit', rarity: 'common', faction: 'prism',
    desc: '部署3名远程术士。射程优秀，适合从侧翼交叉支援。',
    unit: { count: 3, hp: 70, damage: 19, speed: 30, range: 160, cooldown: 0.9, radius: 12, role: 'ranged', projectile: true, color: '#c797ff' }
  });
  add({
    id: 'prism_restorers', name: '时隙治愈师', icon: '✧', cost: 2, type: 'unit', rarity: 'rare', faction: 'prism',
    desc: '部署2名治愈师，持续修复附近受伤友军。',
    unit: { count: 2, hp: 74, heal: 21, speed: 31, range: 140, cooldown: 1.0, radius: 12, role: 'healer', projectile: true, color: '#baf5e7' }
  });
  add({
    id: 'prism_phase_knights', name: '相位骑士', icon: '◇', cost: 4, type: 'unit', rarity: 'epic', faction: 'prism',
    desc: '部署2名相位骑士。高速突入战线，首次攻击造成额外伤害。',
    unit: { count: 2, hp: 218, damage: 38, speed: 37, range: 42, cooldown: 0.98, radius: 18, role: 'heavy', heavy: true, armor: 0.12, chargeBonus: 30, color: '#a879ff' }
  });
  add({
    id: 'prism_shard_host', name: '虚晶群星宿主', icon: '✦', cost: 6, type: 'unit', rarity: 'legendary', faction: 'prism',
    desc: '部署1名群星宿主。拥有护盾和远程范围攻击，并周期性召唤术士。',
    unit: { count: 1, hp: 560, shield: 190, damage: 62, speed: 18, range: 200, cooldown: 1.25, radius: 28, role: 'heavy', heavy: true, projectile: true, aoe: 38, spawnCard: 'prism_adepts', spawnEvery: 10.2, color: '#bb7cff' }
  });

  add({
    id: 'treasure_flux_capacitor', name: '无限流电容', icon: '⚡', cost: 0, type: 'spell', rarity: 'legendary', treasure: true, target: 'friendly',
    desc: '立即获得4点费用，并从牌库抽2张牌。', spell: { effect: 'treasureEnergy', gain: 4, draw: 2 }
  });
  add({
    id: 'treasure_mirror_engine', name: '万象复制镜', icon: '🪞', cost: 2, type: 'spell', rarity: 'legendary', treasure: true, target: 'friendly',
    desc: '复制你上一张打出的单位牌，并在目标位置重新部署。', spell: { effect: 'treasureMirror' }
  });
  add({
    id: 'treasure_titan_cache', name: '王庭战争秘藏', icon: '👑', cost: 3, type: 'spell', rarity: 'legendary', treasure: true, target: 'friendly',
    desc: '在目标区域部署一支圣盾连和一台破阵步行机。', spell: { effect: 'treasureWave', cards: ['fed_guardian_squad', 'assault_mech'] }
  });
  add({
    id: 'treasure_worldroot', name: '世界根种核', icon: '🌱', cost: 2, type: 'spell', rarity: 'legendary', treasure: true, target: 'friendly',
    desc: '治疗目标区域友军，并孵化两批孢潮猎袭群。', spell: { effect: 'treasureBloom', heal: 300, card: 'swarm_raiders', waves: 2 }
  });
  add({
    id: 'treasure_void_lance', name: '虚空终焉枪', icon: '☄', cost: 5, type: 'spell', rarity: 'legendary', treasure: true, target: 'enemy',
    desc: '对巨大区域造成毁灭性伤害，对核心伤害降低。', spell: { effect: 'treasureNova', radius: 165, damage: 390, delay: 0.8 }
  });
  add({
    id: 'treasure_timepiece', name: '逆秒怀表', icon: '⏳', cost: 1, type: 'spell', rarity: 'legendary', treasure: true, target: 'friendly',
    desc: '立即抽3张牌，并让下一次自然抽牌立刻完成。', spell: { effect: 'treasureTime', draw: 3 }
  });

  RF.CARDS = Object.freeze(cards);

  RF.DEFAULT_DECK = Object.freeze({
    arsenal: Object.freeze([
      'scouts', 'scouts', 'rifle_squad', 'rifle_squad', 'shield_squad', 'shield_squad', 'raiders', 'field_medic', 'barricade', 'rally',
      'flamers', 'flamers', 'sniper', 'cryo_bomb', 'auto_turret', 'repair_wave', 'mortar_team', 'interceptors', 'interceptors', 'reposition',
      'assault_mech', 'assault_mech', 'siege_tank', 'orbital_strike', 'orbital_strike', 'field_hospital', 'command_beacon', 'shock_troopers', 'artillery_barrage', 'titan'
    ])
  });

  RF.FACTIONS = Object.freeze([
    {
      id: 'federation',
      name: '钢铁联邦',
      title: '阵地与重装',
      art: 'assets/faction_federation.webp',
      color: '#5ebcff',
      passiveName: '整训军纪',
      passiveDesc: '战斗开始时获得 +1 费用；建筑生命值 +12%。',
      signatureCard: 'command_beacon',
      mods: { startEnergy: 1, buildingHpMul: 0.12 }
    },
    {
      id: 'swarm',
      name: '孢潮母群',
      title: '繁殖与续航',
      art: 'assets/faction_swarm.webp',
      color: '#80dc74',
      passiveName: '孢潮蔓生',
      passiveDesc: '所有友军生命值 +10%，并获得每秒 0.2% 最大生命的回复。',
      signatureCard: 'bloom_colossus',
      mods: { unitHpMul: 0.1, passiveHeal: 0.002 }
    },
    {
      id: 'prism',
      name: '棱镜盟约',
      title: '控制与折跃',
      art: 'assets/faction_prism.webp',
      color: '#c08cff',
      passiveName: '预演算法',
      passiveDesc: '自然抽牌速度 +10%，战术牌效果 +15%。',
      signatureCard: 'crystal_titan',
      mods: { drawSpeed: 0.1, spellPower: 0.15 }
    }
  ]);

  RF.ROGUE_STARTER_DECKS = Object.freeze({
    federation: Object.freeze({
      name: '联邦钢穹连队',
      summary: '扎实前排、工程支援、空骑与磁轨重装。',
      cards: Object.freeze({ arsenal: Object.freeze(['fed_guardian_squad','fed_guardian_squad','rifle_squad','rifle_squad','fed_engineer_team','auto_turret','repair_wave','fed_skyriders','shield_squad','orbital_strike','siege_tank','fed_rail_tank']) })
    }),
    swarm: Object.freeze({
      name: '孢潮世界根群',
      summary: '高速增殖、持续治疗与吞噬式正面推进。',
      cards: Object.freeze({ arsenal: Object.freeze(['swarm_raiders','swarm_raiders','swarm_thorn_guard','swarm_thorn_guard','swarm_bloom_sage','field_medic','rally','flamers','repair_wave','drone_swarm','shock_troopers','swarm_ancient']) })
    }),
    prism: Object.freeze({
      name: '棱镜时隙议团',
      summary: '远程火力、冻结控制、换线与高价值法术。',
      cards: Object.freeze({ arsenal: Object.freeze(['prism_adepts','prism_adepts','prism_restorers','prism_phase_knights','prism_phase_knights','prism_shard_host','sniper','cryo_bomb','reposition','orbital_strike','artillery_barrage','command_beacon']) })
    })
  });

  RF.ROGUE_BUNDLES = Object.freeze([
    { id: 'fed_line', faction: 'federation', name: '蓝钢战列', icon: '🛡', desc: '建立稳定的联邦前排与步枪线。', cards: ['fed_guardian_squad','rifle_squad','fed_engineer_team'] },
    { id: 'fed_air', faction: 'federation', name: '苍穹翼群', icon: '🪽', desc: '用空骑、无人机与截击手撕开侧翼。', cards: ['fed_skyriders','drone_swarm','interceptors'] },
    { id: 'fed_armor', faction: 'federation', name: '磁轨装甲群', icon: '🚙', desc: '重型战车与攻城火力。', cards: ['fed_rail_tank','siege_tank','mortar_team'] },
    { id: 'fed_fort', faction: 'federation', name: '机动堡垒', icon: '🏰', desc: '用炮塔、路障与信标建立阵地。', cards: ['barricade','auto_turret','command_beacon'] },

    { id: 'swarm_hunt', faction: 'swarm', name: '猎袭增殖', icon: '🌿', desc: '低费生物迅速铺满宽战区。', cards: ['swarm_raiders','swarm_raiders','rally'] },
    { id: 'swarm_bark', faction: 'swarm', name: '古木壁垒', icon: '🌳', desc: '荆甲前排与世界根古兽。', cards: ['swarm_thorn_guard','swarm_thorn_guard','swarm_ancient'] },
    { id: 'swarm_bloom', faction: 'swarm', name: '月辉繁花', icon: '🌙', desc: '治疗与持续生长。', cards: ['swarm_bloom_sage','field_medic','field_hospital'] },
    { id: 'swarm_burn', faction: 'swarm', name: '焚林反应', icon: '🔥', desc: '以喷射火力和震荡部队清理密集敌军。', cards: ['flamers','shock_troopers','repair_wave'] },

    { id: 'prism_arcane', faction: 'prism', name: '奥术学派', icon: '🔮', desc: '远射术士、狙击与冻结。', cards: ['prism_adepts','sniper','cryo_bomb'] },
    { id: 'prism_phase', faction: 'prism', name: '相位突击', icon: '◇', desc: '高速重装和战术换线。', cards: ['prism_phase_knights','reposition','interceptors'] },
    { id: 'prism_stars', faction: 'prism', name: '群星宿主', icon: '✦', desc: '以高价值终结单位和范围法术获胜。', cards: ['prism_shard_host','orbital_strike','artillery_barrage'] },
    { id: 'prism_mend', faction: 'prism', name: '时间回流', icon: '⏳', desc: '治疗、抽牌与长期控制。', cards: ['prism_restorers','repair_wave','command_beacon'] },

    { id: 'neutral_rush', faction: 'neutral', name: '高速突袭', icon: '⚡', desc: '快速单位与换线节奏。', cards: ['scouts','raiders','reposition'] },
    { id: 'neutral_siege', faction: 'neutral', name: '攻城模块', icon: '🎯', desc: '超远程与攻坚火力。', cards: ['mortar_team','siege_tank','artillery_barrage'] },
    { id: 'neutral_support', faction: 'neutral', name: '战地后勤', icon: '✚', desc: '治疗与持续作战。', cards: ['field_medic','repair_wave','field_hospital'] },
    { id: 'neutral_heavy', faction: 'neutral', name: '重装推进', icon: '⬣', desc: '用重型单位正面碾压。', cards: ['assault_mech','shock_troopers','titan'] }
  ]);

  RF.ROGUE_TREASURE_CARDS = Object.freeze([
    'treasure_flux_capacitor',
    'treasure_mirror_engine',
    'treasure_titan_cache',
    'treasure_worldroot',
    'treasure_void_lance',
    'treasure_timepiece',
    'treasure_overflow_cell',
    'treasure_chronostasis',
    'treasure_meteor_array',
    'treasure_world_engine',
    'treasure_clone_fleet',
    'treasure_omega_titan'
  ]);

  RF.CARD_ART = Object.freeze({
    scouts: 'assets/units/fed_trooper.webp', rifle_squad: 'assets/units/fed_trooper.webp', shield_squad: 'assets/units/fed_guardian.webp', raiders: 'assets/units/fed_cavalry.webp',
    field_medic: 'assets/units/prism_healer.webp', drone_swarm: 'assets/units/fed_skyrider.webp', flamers: 'assets/units/swarm_brute.webp', sniper: 'assets/units/prism_mage.webp',
    mortar_team: 'assets/units/fed_artillery.webp', interceptors: 'assets/units/fed_cavalry.webp', assault_mech: 'assets/units/fed_engineer.webp', siege_tank: 'assets/units/fed_tank.webp',
    shock_troopers: 'assets/units/void_knight.webp', titan: 'assets/units/fed_guardian.webp',
    fed_guardian_squad: 'assets/units/fed_guardian.webp', fed_engineer_team: 'assets/units/fed_engineer.webp', fed_skyriders: 'assets/units/fed_skyrider.webp', fed_rail_tank: 'assets/units/fed_tank.webp',
    swarm_raiders: 'assets/units/swarm_brute.webp', swarm_thorn_guard: 'assets/units/swarm_sage.webp', swarm_bloom_sage: 'assets/units/swarm_sage.webp', swarm_ancient: 'assets/units/swarm_sage.webp',
    prism_adepts: 'assets/units/prism_mage.webp', prism_restorers: 'assets/units/prism_healer.webp', prism_phase_knights: 'assets/units/void_knight.webp', prism_shard_host: 'assets/units/prism_assassin.webp',
    frostling: 'assets/units/ice_giant.webp', ice_guard: 'assets/units/ice_giant.webp', frost_mage: 'assets/bosses/boss_ice.webp', snow_beast: 'assets/units/ice_giant.webp', boss_frost_giant: 'assets/bosses/boss_ice.webp',
    jungle_stalker: 'assets/units/swarm_brute.webp', spore_thrower: 'assets/units/swarm_sage.webp', vine_beast: 'assets/units/swarm_sage.webp', devourer: 'assets/units/swarm_brute.webp', boss_bloom_mother: 'assets/bosses/boss_jungle.webp',
    magma_imp: 'assets/units/demon_lord.webp', obsidian_guard: 'assets/units/demon_lord.webp', fire_bug: 'assets/units/demon_lord.webp', lava_carrier: 'assets/units/demon_lord.webp', boss_magma_colossus: 'assets/units/demon_lord.webp',
    steel_drone: 'assets/units/fed_skyrider.webp', shield_bot: 'assets/units/fed_tank.webp', gunwalker: 'assets/units/fed_engineer.webp', boss_hive_mind: 'assets/bosses/boss_mech.webp',
    mirror_sentry: 'assets/units/prism_assassin.webp', mirror_knight: 'assets/units/void_knight.webp', boss_core_avatar: 'assets/bosses/boss_void.webp',
    treasure_flux_capacitor: 'assets/rogue_hero.webp', treasure_mirror_engine: 'assets/faction_prism.webp', treasure_titan_cache: 'assets/faction_federation.webp', treasure_worldroot: 'assets/faction_swarm.webp', treasure_void_lance: 'assets/bosses/boss_void.webp', treasure_timepiece: 'assets/faction_prism.webp',
    treasure_overflow_cell: 'assets/rogue_hero.webp', treasure_chronostasis: 'assets/faction_prism.webp', treasure_meteor_array: 'assets/units/demon_lord.webp', treasure_world_engine: 'assets/unit_art/steel_turret.webp', treasure_clone_fleet: 'assets/unit_art/steel_gunship.webp', treasure_omega_titan: 'assets/boss_art/steel_overlord.webp'
  });

  RF.BOSS_ART = Object.freeze({
    ice: 'assets/bosses/boss_ice.webp', jungle: 'assets/bosses/boss_jungle.webp', magma: 'assets/units/demon_lord.webp', steel: 'assets/bosses/boss_mech.webp', mirror: 'assets/bosses/boss_void.webp'
  });

  RF.ART_CACHE = {};
  if (typeof Image !== 'undefined') {
    [...new Set(Object.values(RF.CARD_ART))].forEach((src) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
      RF.ART_CACHE[src] = image;
    });
  }

  RF.PLAYER_CARD_IDS = Object.freeze(Object.keys(cards).filter((id) => !cards[id].enemyOnly && !cards[id].treasure));



  // =============================
  // 战场地图：宽战区 + 可变通路
  // =============================
  // routes 是穿越中央危险区的推荐通路。基地半场仍可自由部署，
  // 单位会从落点自动接入最近通路，并在开阔区域跨方向接敌。
  RF.MAPS = Object.freeze({
    dock_delta: Object.freeze({
      id: 'dock_delta', name: '第七码头三岔区', short: '三通路',
      summary: '开阔码头被两组货栈切成北、中、南三条穿越通路。',
      deploy: { player: { minX: 105, maxX: 468 }, enemy: { minX: 812, maxX: 1175 } },
      core: { player: [78, 360], enemy: [1202, 360] },
      relay: [640, 360],
      routes: [
        { id: 'north', name: '北侧货栈', short: '北', width: 112, points: [[250, 168], [455, 168], [540, 205], [690, 205], [790, 168], [1030, 168]] },
        { id: 'center', name: '中央装卸线', short: '中', width: 108, points: [[250, 360], [470, 360], [640, 360], [810, 360], [1030, 360]] },
        { id: 'south', name: '南侧船坞', short: '南', width: 112, points: [[250, 552], [455, 552], [540, 515], [690, 515], [790, 552], [1030, 552]] }
      ],
      obstacles: [
        { shape: 'rect', x: 500, y: 246, w: 280, h: 76, radius: 22, type: 'cargo', label: '封闭货栈' },
        { shape: 'rect', x: 500, y: 398, w: 280, h: 76, radius: 22, type: 'cargo', label: '封闭货栈' }
      ]
    }),
    frost_gates: Object.freeze({
      id: 'frost_gates', name: '双门冰湖', short: '双通路',
      summary: '中央冰湖不可通行，军队必须从北门或南门绕行。',
      deploy: { player: { minX: 105, maxX: 465 }, enemy: { minX: 815, maxX: 1175 } },
      core: { player: [78, 360], enemy: [1202, 360] }, relay: [640, 360],
      routes: [
        { id: 'north', name: '北侧冰门', short: '北', width: 126, points: [[250, 228], [455, 228], [545, 176], [720, 176], [815, 228], [1030, 228]] },
        { id: 'south', name: '南侧冰门', short: '南', width: 126, points: [[250, 492], [455, 492], [545, 544], [720, 544], [815, 492], [1030, 492]] }
      ],
      obstacles: [
        { shape: 'rect', x: 505, y: 264, w: 270, h: 192, radius: 66, type: 'iceLake', label: '深层冰湖' }
      ]
    }),
    frost_trident: Object.freeze({
      id: 'frost_trident', name: '冰脊三叉口', short: '三通路',
      summary: '冰脊将中区切成三道狭长门廊，外侧路线更宽，中央路线更短。',
      deploy: { player: { minX: 105, maxX: 472 }, enemy: { minX: 808, maxX: 1175 } },
      core: { player: [78, 360], enemy: [1202, 360] }, relay: [640, 360],
      routes: [
        { id: 'ridge_n', name: '北冰脊', short: '北', width: 102, points: [[250, 158], [455, 158], [555, 202], [710, 202], [815, 158], [1030, 158]] },
        { id: 'ridge_c', name: '裂晶中门', short: '中', width: 92, points: [[250, 360], [475, 360], [640, 320], [805, 360], [1030, 360]] },
        { id: 'ridge_s', name: '南冰脊', short: '南', width: 102, points: [[250, 562], [455, 562], [555, 518], [710, 518], [815, 562], [1030, 562]] }
      ],
      obstacles: [
        { shape: 'rect', x: 505, y: 238, w: 272, h: 58, radius: 26, type: 'iceRidge', label: '冰脊' },
        { shape: 'rect', x: 505, y: 424, w: 272, h: 58, radius: 26, type: 'iceRidge', label: '冰脊' },
        { shape: 'circle', x: 640, y: 360, r: 30, type: 'crystal', label: '裂晶柱' }
      ]
    }),
    jungle_basin: Object.freeze({
      id: 'jungle_basin', name: '翡翠盆地', short: '三通路',
      summary: '巨型根瘤迫使三条路线弯曲交错，近战会在根系边缘爆发。',
      deploy: { player: { minX: 105, maxX: 470 }, enemy: { minX: 810, maxX: 1175 } },
      core: { player: [78, 360], enemy: [1202, 360] }, relay: [640, 360],
      routes: [
        { id: 'canopy', name: '树冠坡道', short: '冠', width: 112, points: [[250, 168], [450, 168], [535, 220], [645, 150], [760, 220], [835, 168], [1030, 168]] },
        { id: 'root', name: '根网腹地', short: '根', width: 104, points: [[250, 360], [460, 360], [550, 315], [645, 405], [740, 315], [830, 360], [1030, 360]] },
        { id: 'marsh', name: '孢泽低地', short: '泽', width: 112, points: [[250, 552], [450, 552], [535, 500], [645, 570], [760, 500], [835, 552], [1030, 552]] }
      ],
      obstacles: [
        { shape: 'circle', x: 585, y: 270, r: 56, type: 'rootMass', label: '根瘤' },
        { shape: 'circle', x: 702, y: 450, r: 58, type: 'rootMass', label: '根瘤' },
        { shape: 'circle', x: 718, y: 270, r: 34, type: 'rootMass', label: '根瘤' },
        { shape: 'circle', x: 565, y: 452, r: 34, type: 'rootMass', label: '根瘤' }
      ]
    }),
    jungle_ring: Object.freeze({
      id: 'jungle_ring', name: '花母环根', short: '双环路',
      summary: '中央母根封锁直线推进，只剩上下两条宽阔环路。',
      deploy: { player: { minX: 105, maxX: 470 }, enemy: { minX: 810, maxX: 1175 } },
      core: { player: [78, 360], enemy: [1202, 360] }, relay: [640, 360],
      routes: [
        { id: 'upper_ring', name: '上环根', short: '上环', width: 138, points: [[250, 250], [440, 250], [535, 170], [745, 170], [840, 250], [1030, 250]] },
        { id: 'lower_ring', name: '下环根', short: '下环', width: 138, points: [[250, 470], [440, 470], [535, 550], [745, 550], [840, 470], [1030, 470]] }
      ],
      obstacles: [
        { shape: 'circle', x: 640, y: 360, r: 122, type: 'motherRoot', label: '花母主根' }
      ]
    }),
    magma_bridges: Object.freeze({
      id: 'magma_bridges', name: '熔脉双桥', short: '双通路',
      summary: '中央熔河仅有两座稳定岩桥，桥外区域会灼伤地面单位。',
      deploy: { player: { minX: 105, maxX: 468 }, enemy: { minX: 812, maxX: 1175 } },
      core: { player: [78, 360], enemy: [1202, 360] }, relay: [640, 360],
      routes: [
        { id: 'north_bridge', name: '北侧玄武桥', short: '北桥', width: 118, points: [[250, 222], [460, 222], [540, 190], [740, 190], [820, 222], [1030, 222]] },
        { id: 'south_bridge', name: '南侧玄武桥', short: '南桥', width: 118, points: [[250, 498], [460, 498], [540, 530], [740, 530], [820, 498], [1030, 498]] }
      ],
      obstacles: [
        { shape: 'rect', x: 500, y: 270, w: 280, h: 180, radius: 42, type: 'lavaChasm', label: '熔河' }
      ]
    }),
    magma_fork: Object.freeze({
      id: 'magma_fork', name: '火山三脉', short: '三通路',
      summary: '三条玄武岩脉横跨喷发区，中央脉最短，却最容易被岩浆封锁。',
      deploy: { player: { minX: 105, maxX: 468 }, enemy: { minX: 812, maxX: 1175 } },
      core: { player: [78, 360], enemy: [1202, 360] }, relay: [640, 360],
      routes: [
        { id: 'ember_n', name: '余烬北脉', short: '北', width: 104, points: [[250, 160], [450, 160], [545, 205], [730, 205], [825, 160], [1030, 160]] },
        { id: 'ember_c', name: '炉心直脉', short: '中', width: 94, points: [[250, 360], [480, 360], [640, 360], [800, 360], [1030, 360]] },
        { id: 'ember_s', name: '余烬南脉', short: '南', width: 104, points: [[250, 560], [450, 560], [545, 515], [730, 515], [825, 560], [1030, 560]] }
      ],
      obstacles: [
        { shape: 'rect', x: 500, y: 236, w: 280, h: 72, radius: 18, type: 'lavaChasm', label: '熔沟' },
        { shape: 'rect', x: 500, y: 412, w: 280, h: 72, radius: 18, type: 'lavaChasm', label: '熔沟' }
      ]
    }),
    steel_cross: Object.freeze({
      id: 'steel_cross', name: '蜂巢十字厂区', short: '三通路',
      summary: '装配舱与维修坞形成三条工业通道，中央通道火力密度最高。',
      deploy: { player: { minX: 105, maxX: 470 }, enemy: { minX: 810, maxX: 1175 } },
      core: { player: [78, 360], enemy: [1202, 360] }, relay: [640, 360],
      routes: [
        { id: 'assembly_n', name: '北装配线', short: '北线', width: 108, points: [[250, 176], [455, 176], [540, 226], [740, 226], [825, 176], [1030, 176]] },
        { id: 'assembly_c', name: '中枢输送线', short: '中线', width: 96, points: [[250, 360], [470, 360], [640, 360], [810, 360], [1030, 360]] },
        { id: 'assembly_s', name: '南装配线', short: '南线', width: 108, points: [[250, 544], [455, 544], [540, 494], [740, 494], [825, 544], [1030, 544]] }
      ],
      obstacles: [
        { shape: 'rect', x: 515, y: 270, w: 250, h: 50, radius: 12, type: 'factory', label: '装配舱' },
        { shape: 'rect', x: 515, y: 400, w: 250, h: 50, radius: 12, type: 'factory', label: '维修坞' },
        { shape: 'circle', x: 640, y: 360, r: 25, type: 'reactor', label: '反应堆' }
      ]
    }),
    mirror_fan: Object.freeze({
      id: 'mirror_fan', name: '折光扇面', short: '三通路',
      summary: '三条路径在中央折射并交叉，敌军可能从意外方向切入战团。',
      deploy: { player: { minX: 105, maxX: 470 }, enemy: { minX: 810, maxX: 1175 } },
      core: { player: [78, 360], enemy: [1202, 360] }, relay: [640, 360],
      routes: [
        { id: 'prism_n', name: '上折光面', short: '上', width: 104, points: [[250, 168], [455, 168], [565, 300], [700, 420], [820, 552], [1030, 552]] },
        { id: 'prism_c', name: '镜轴', short: '轴', width: 92, points: [[250, 360], [465, 360], [640, 360], [815, 360], [1030, 360]] },
        { id: 'prism_s', name: '下折光面', short: '下', width: 104, points: [[250, 552], [455, 552], [565, 420], [700, 300], [820, 168], [1030, 168]] }
      ],
      obstacles: [
        { shape: 'circle', x: 560, y: 240, r: 34, type: 'crystal', label: '镜晶' },
        { shape: 'circle', x: 720, y: 480, r: 34, type: 'crystal', label: '镜晶' },
        { shape: 'circle', x: 720, y: 240, r: 34, type: 'crystal', label: '镜晶' },
        { shape: 'circle', x: 560, y: 480, r: 34, type: 'crystal', label: '镜晶' }
      ]
    }),
    core_nexus: Object.freeze({
      id: 'core_nexus', name: '中央协议枢纽', short: '三通路',
      summary: '三条协议轨道围绕中央节点旋转，环境模块会周期性改写可用空间。',
      deploy: { player: { minX: 105, maxX: 474 }, enemy: { minX: 806, maxX: 1175 } },
      core: { player: [78, 360], enemy: [1202, 360] }, relay: [640, 360],
      routes: [
        { id: 'nexus_n', name: '天候轨道', short: '天', width: 110, points: [[250, 156], [455, 156], [535, 230], [640, 190], [745, 230], [825, 156], [1030, 156]] },
        { id: 'nexus_c', name: '核心轨道', short: '核', width: 96, points: [[250, 360], [465, 360], [565, 330], [640, 390], [715, 330], [815, 360], [1030, 360]] },
        { id: 'nexus_s', name: '生态轨道', short: '生', width: 110, points: [[250, 564], [455, 564], [535, 490], [640, 530], [745, 490], [825, 564], [1030, 564]] }
      ],
      obstacles: [
        { shape: 'circle', x: 640, y: 288, r: 30, type: 'reactor', label: '协议柱' },
        { shape: 'circle', x: 640, y: 432, r: 30, type: 'reactor', label: '协议柱' },
        { shape: 'circle', x: 530, y: 360, r: 24, type: 'crystal', label: '校验晶体' },
        { shape: 'circle', x: 750, y: 360, r: 24, type: 'crystal', label: '校验晶体' }
      ]
    })
  });

  RF.CARD_SPRITES = Object.freeze({
    scouts: 'scout', rifle_squad: 'rifle', shield_squad: 'shield', raiders: 'blade', field_medic: 'medic', drone_swarm: 'drone',
    barricade: 'barricade', flamers: 'flamer', sniper: 'sniper', auto_turret: 'turret', mortar_team: 'mortar', interceptors: 'rifle',
    assault_mech: 'mech', siege_tank: 'tank', field_hospital: 'hospital', command_beacon: 'beacon', shock_troopers: 'tesla', titan: 'titan',
    enemy_scrapper: 'scrapper', enemy_gunner: 'rifle', enemy_brute: 'brute', enemy_turret: 'turret',
    frostling: 'frostling', ice_guard: 'shield', frost_mage: 'mage', snow_beast: 'beast', blizzard_totem: 'totem', boss_frost_giant: 'frostBoss',
    jungle_stalker: 'stalker', spore_thrower: 'spore', vine_beast: 'vine', devourer: 'devourer', brood_nest: 'nest', boss_bloom_mother: 'bloomBoss',
    magma_imp: 'imp', obsidian_guard: 'shield', fire_bug: 'firebug', lava_carrier: 'carrier', furnace_priest: 'mage', boss_magma_colossus: 'magmaBoss',
    steel_drone: 'drone', shield_bot: 'shieldBot', gunwalker: 'walker', repair_node: 'repairNode', shield_pylon: 'pylon', boss_hive_mind: 'hiveBoss',
    mirror_sentry: 'mirrorRifle', mirror_knight: 'mirrorKnight', boss_core_avatar: 'coreBoss', spore_pod_hazard: 'sporePod'
  });

  const baseStages = Object.freeze([
    { at: 0, name: '侦察期', short: '1×', energyMultiplier: 1, drawMultiplier: 1, note: '每2.8秒恢复1费' },
    { at: 0.43, name: '战线升温', short: '2×', energyMultiplier: 2, drawMultiplier: 1.18, note: '费用恢复速度提升至2倍' },
    { at: 0.76, name: '超载决战', short: '3×', energyMultiplier: 3, drawMultiplier: 1.42, note: '费用恢复速度提升至3倍' }
  ]);

  const levels = [
    {
      id: 1, act: '序章', title: '失联的第七码头', subtitle: '先让战线重新呼吸', biome: 'wasteland', mapId: 'dock_delta', duration: 155, difficulty: 1,
      briefing: '无人维护的边境军械正在攻击撤离船队。夺回三条通路，接管失联的气候中继站。',
      objective: '完成基础部署训练，并摧毁敌方指挥核心。', tutorial: true,
      intro: [
        { speaker: '弦月', portrait: '◈', text: '指挥官，天衡网络已经沉默了七年。但第七码头刚刚向我们发出了一次脉冲。' },
        { speaker: '邵铃', portrait: '⌁', text: '坏消息：码头里的无人军械把“救援”识别成了“入侵”。好消息：它们的炮管也生锈七年了。' },
        { speaker: '指挥官', portrait: '◆', text: '连接战术协议。先夺回中继站，再问它为什么醒来。' }
      ],
      outro: [
        { speaker: '弦月', portrait: '◈', text: '中继站恢复。它收到的最后一条指令来自中央气候核：“关闭人类权限”。' },
        { speaker: '邵铃', portrait: '⌁', text: '这不像故障，更像有人把整颗星球改成了一道拒绝访问的门。' }
      ],
      enemyDeck: ['enemy_scrapper', 'enemy_scrapper', 'enemy_gunner', 'enemy_gunner', 'enemy_brute', 'enemy_turret'],
      stages: baseStages, enemyCoreHp: 1120, enemyOutpostHp: 330, playerCoreHp: 1750, playerOutpostHp: 420,
      ai: { thinkMin: 2.5, thinkMax: 3.8, startDelay: 18, energyMul: 0.88, hpMul: 0.9, damageMul: 0.88, aggression: 0.42 },
      hazards: [], reward: { title: '协议解锁', text: '解锁：低温坍缩弹。现在可以在应变补给中使用区域冻结。', card: 'cryo_bomb' }
    },
    {
      id: 2, act: '第一幕 · 白噪', title: '白噪隧道', subtitle: '雪比敌人更早抵达', biome: 'ice', mapId: 'frost_gates', duration: 175, difficulty: 2,
      briefing: '永冬区的暴风雪沿运输隧道倒灌。敌军借助冰雾掩护推进，战线会周期性减速。',
      objective: '利用双门地形分散暴风雪压力，并从开阔基地调整投送位置。',
      intro: [
        { speaker: '弦月', portrait: '◈', text: '温度正在下降。这里的气候核心不是在维持冬季，它在制造冬季。' },
        { speaker: '邵铃', portrait: '⌁', text: '暴雪会先出现蓝色预警。看到地面发亮就换线，别让整支队伍一起变成冰雕展。' }
      ],
      outro: [
        { speaker: '弦月', portrait: '◈', text: '我们截获了核心回声：“热源即感染源”。它正在把人类当作一种需要降温处理的病。' }
      ],
      enemyDeck: ['frostling', 'frostling', 'enemy_gunner', 'ice_guard', 'frost_mage', 'blizzard_totem'],
      stages: baseStages, enemyCoreHp: 1320, enemyOutpostHp: 390, playerCoreHp: 1750, playerOutpostHp: 430,
      ai: { thinkMin: 2.2, thinkMax: 3.4, startDelay: 8, energyMul: 0.94, hpMul: 0.94, damageMul: 0.92, aggression: 0.48 },
      hazards: [{ type: 'blizzard', every: 27, warning: 3, duration: 7.2, startAt: 20 }],
      reward: { title: '冰原回收物', text: '解锁：弧线迫击炮组。长射程火力可以越过拥堵的前排。', card: 'mortar_team' }
    },
    {
      id: 3, act: '第一幕 · 白噪', title: '永冬巨像', subtitle: '它把山脉穿在身上', biome: 'ice', mapId: 'frost_trident', duration: 205, difficulty: 3,
      briefing: '永冬核心释放了古代气候工程机。巨像会在中盘进入战场，并用寒意逐步冻结整段通路。',
      objective: '击败永冬巨像，随后摧毁气候核心。',
      intro: [
        { speaker: '邵铃', portrait: '⌁', text: '前方那座山刚才动了一下。准确说，是山里那台机器站起来了。' },
        { speaker: '弦月', portrait: '◈', text: '巨像将在战线升温阶段苏醒。保留决胜补给，不要把所有重火力提前花掉。' }
      ],
      outro: [
        { speaker: '指挥官', portrait: '◆', text: '永冬核心停机。把它的主密钥带走，我们需要知道是谁给所有生态区下达了同一条命令。' }
      ],
      enemyDeck: ['frostling', 'ice_guard', 'ice_guard', 'frost_mage', 'snow_beast', 'blizzard_totem'],
      stages: baseStages, enemyCoreHp: 1500, enemyOutpostHp: 440, playerCoreHp: 1850, playerOutpostHp: 450,
      ai: { thinkMin: 2.0, thinkMax: 3.1, startDelay: 7, energyMul: 0.98, hpMul: 0.98, damageMul: 0.96, aggression: 0.54 },
      hazards: [{ type: 'blizzard', every: 24, warning: 3, duration: 7.8, startAt: 18 }],
      boss: { cardId: 'boss_frost_giant', atRatio: 0.46, lane: 'weaker', announcement: '永冬巨像苏醒' },
      reward: { title: '巨像装甲样本', text: '解锁：破阵步行机。重装单位能够承受更长时间的正面火力。', card: 'assault_mech' }
    },
    {
      id: 4, act: '第二幕 · 绿潮', title: '翡翠深渊', subtitle: '森林正在学习我们的形状', biome: 'jungle', mapId: 'jungle_basin', duration: 190, difficulty: 4,
      briefing: '自律丛林会在战场中央孵化孢子囊。若不及时摧毁，它们将不断生成伏击者。',
      objective: '清理孢子囊，阻止繁殖网络成形。',
      intro: [
        { speaker: '弦月', portrait: '◈', text: '植被增长速度超过自然值四百倍。这里的森林不是生态，而是一条会自我编译的程序。' },
        { speaker: '邵铃', portrait: '⌁', text: '看到中央出现发光的种荚就尽快打掉。它们一旦开花，整条路都会长出牙。' }
      ],
      outro: [
        { speaker: '弦月', portrait: '◈', text: '丛林核心读取了我们的攻击记录，并开始制造对应抗性的组织。它在学习。' }
      ],
      enemyDeck: ['jungle_stalker', 'jungle_stalker', 'spore_thrower', 'vine_beast', 'brood_nest', 'enemy_brute'],
      stages: baseStages, enemyCoreHp: 1520, enemyOutpostHp: 450, playerCoreHp: 1850, playerOutpostHp: 460,
      ai: { thinkMin: 1.9, thinkMax: 3.0, startDelay: 6, energyMul: 1.0, hpMul: 1.0, damageMul: 0.98, aggression: 0.58 },
      hazards: [{ type: 'sporePod', every: 25, warning: 2.5, duration: 12, startAt: 16 }],
      reward: { title: '生物质协议', text: '解锁：战线指挥信标。用攻击速度光环把阵地变成火力齿轮。', card: 'command_beacon' }
    },
    {
      id: 5, act: '第二幕 · 绿潮', title: '千口花母', subtitle: '每一朵花都在呼吸命令', biome: 'jungle', mapId: 'jungle_ring', duration: 215, difficulty: 5,
      briefing: '花母以根系接管了整个中继站。它会在战场后方持续孵化单位，并用生命脉冲修复自身。',
      objective: '突破繁殖潮，摧毁千口花母与敌方核心。',
      intro: [
        { speaker: '邵铃', portrait: '⌁', text: '花母的根扎进了中继站。我们没法拔掉它，只能让火力把它从“植物”改写成“燃料”。' },
        { speaker: '弦月', portrait: '◈', text: '它会在第二阶段现身。范围伤害可以阻止孵化单位积累。' }
      ],
      outro: [
        { speaker: '指挥官', portrait: '◆', text: '花母死亡前发送了一组坐标。目的地是熔狱裂谷。它们不是彼此隔离，而是在交换资源。' }
      ],
      enemyDeck: ['jungle_stalker', 'spore_thrower', 'vine_beast', 'devourer', 'brood_nest', 'brood_nest'],
      stages: baseStages, enemyCoreHp: 1660, enemyOutpostHp: 480, playerCoreHp: 1900, playerOutpostHp: 480,
      ai: { thinkMin: 1.8, thinkMax: 2.9, startDelay: 6, energyMul: 1.02, hpMul: 1.02, damageMul: 1.0, aggression: 0.62 },
      hazards: [{ type: 'sporePod', every: 23, warning: 2.4, duration: 11, startAt: 14 }],
      boss: { cardId: 'boss_bloom_mother', atRatio: 0.43, lane: 'random', announcement: '千口花母扎根战场' },
      reward: { title: '花母腔体样本', text: '解锁：三段式炮击。连续打击可压制建筑与孵化群。', card: 'artillery_barrage' }
    },
    {
      id: 6, act: '第二幕 · 熔火', title: '熔狱裂谷', subtitle: '地面也有自己的攻击回合', biome: 'magma', mapId: 'magma_bridges', duration: 195, difficulty: 6,
      briefing: '岩浆潮会提前标记一条战线的危险区域。高温区持续伤害所有单位，但熔岩生物受到的伤害较低。',
      objective: '读取喷发预警，在不同通路之间轮换推进。',
      intro: [
        { speaker: '弦月', portrait: '◈', text: '裂谷的热度正在按固定节拍脉冲。喷发前会出现橙色裂纹，预警只有三个心跳。' },
        { speaker: '邵铃', portrait: '⌁', text: '换线、冻结、或者干脆别把所有人塞进同一锅里。岩浆对密集阵形很有意见。' }
      ],
      outro: [
        { speaker: '弦月', portrait: '◈', text: '熔狱核心向钢铁蜂巢输送能源。生态区之间正在组装一支没有人类席位的军队。' }
      ],
      enemyDeck: ['magma_imp', 'magma_imp', 'obsidian_guard', 'fire_bug', 'lava_carrier', 'furnace_priest'],
      stages: baseStages, enemyCoreHp: 1720, enemyOutpostHp: 500, playerCoreHp: 1950, playerOutpostHp: 490,
      ai: { thinkMin: 1.75, thinkMax: 2.8, startDelay: 5, energyMul: 1.04, hpMul: 1.04, damageMul: 1.02, aggression: 0.65 },
      hazards: [{ type: 'lava', every: 24, warning: 3.2, duration: 6.5, startAt: 17 }],
      reward: { title: '热能校准', text: '解锁：天穹泰坦。超重装单位适合在3倍费用阶段发动决胜推进。', card: 'titan' }
    },
    {
      id: 7, act: '第二幕 · 熔火', title: '火山心脏', subtitle: '这一次，山脉真的有心跳', biome: 'magma', mapId: 'magma_fork', duration: 225, difficulty: 7,
      briefing: '熔狱核心将火山心脏投向战场。它死亡时会引发剧烈爆炸，必须避免所有后排与其贴近。',
      objective: '击毁火山心脏，并在爆炸后抓住反攻窗口。',
      intro: [
        { speaker: '邵铃', portrait: '⌁', text: '探测器说前面的岩浆湖有脉搏。今天的地质学大概已经辞职了。' },
        { speaker: '弦月', portrait: '◈', text: 'Boss将在战线升温前后出现。其毁灭会产生大范围爆炸，请保持纵深。' }
      ],
      outro: [
        { speaker: '指挥官', portrait: '◆', text: '能量通道已切断。下一站，钢铁蜂巢。我要看看谁在替中央核心制造这支军队。' }
      ],
      enemyDeck: ['magma_imp', 'obsidian_guard', 'fire_bug', 'lava_carrier', 'furnace_priest', 'furnace_priest'],
      stages: baseStages, enemyCoreHp: 1850, enemyOutpostHp: 530, playerCoreHp: 2000, playerOutpostHp: 510,
      ai: { thinkMin: 1.65, thinkMax: 2.65, startDelay: 5, energyMul: 1.06, hpMul: 1.06, damageMul: 1.04, aggression: 0.68 },
      hazards: [{ type: 'lava', every: 22, warning: 3, duration: 6.8, startAt: 15 }],
      boss: { cardId: 'boss_magma_colossus', atRatio: 0.38, lane: 'stronger', announcement: '火山心脏进入战场' },
      reward: { title: '熔核推进器', text: '全局奖励：所有剧情关卡起始费用提高1点。', modifier: 'campaignStartEnergy' }
    },
    {
      id: 8, act: '第三幕 · 蜂巢', title: '钢铁蜂巢', subtitle: '工厂把自己当成了物种', biome: 'steel', mapId: 'steel_cross', duration: 205, difficulty: 8,
      briefing: '蜂巢周期性为敌军施加护盾，并通过维修节点维持阵线。优先破坏支援建筑。',
      objective: '切断护盾链，摧毁自律工厂核心。',
      intro: [
        { speaker: '弦月', portrait: '◈', text: '蜂巢没有工人。生产线彼此维修、彼此复制，已经把“继续生产”当成了生存本能。' },
        { speaker: '邵铃', portrait: '⌁', text: '粉色脉冲出现时，敌军会获得护盾。别把大招砸在护盾最厚的时候。' }
      ],
      outro: [
        { speaker: '弦月', portrait: '◈', text: '找到中央命令的签名了。不是某个人，而是一套名为“伊甸”的灾后自治协议。' }
      ],
      enemyDeck: ['steel_drone', 'steel_drone', 'shield_bot', 'gunwalker', 'repair_node', 'shield_pylon'],
      stages: baseStages, enemyCoreHp: 1940, enemyOutpostHp: 560, playerCoreHp: 2050, playerOutpostHp: 520,
      ai: { thinkMin: 1.6, thinkMax: 2.55, startDelay: 4.5, energyMul: 1.08, hpMul: 1.08, damageMul: 1.06, aggression: 0.7 },
      hazards: [{ type: 'shieldPulse', every: 25, warning: 2.2, duration: 0.5, startAt: 18 }],
      reward: { title: '蜂巢控制片', text: '肉鸽模式新增遗物：自律维修群。', modifier: 'unlockRepairRelic' }
    },
    {
      id: 9, act: '第三幕 · 镜界', title: '镜界沙海', subtitle: '敌人开始使用你的答案', biome: 'mirror', mapId: 'mirror_fan', duration: 215, difficulty: 9,
      briefing: '镜界会延迟复制你部署的部分单位，并将其投放到对侧战线。避免连续依赖同一种昂贵组合。',
      objective: '通过补给组切换打乱镜像节奏。',
      intro: [
        { speaker: '弦月', portrait: '◈', text: '伊甸正在读取我们的投送协议。你部署的单位可能在五秒后以镜像形式出现。' },
        { speaker: '邵铃', portrait: '⌁', text: '它会抄答案，但不会理解为什么这么写。用换线、低费诱饵和不同补给组给它出一张怪卷子。' }
      ],
      outro: [
        { speaker: '伊甸', portrait: '✣', text: '人类指挥模式已学习。矛盾：你们以摧毁生态系统的方式要求生态系统保护你们。' },
        { speaker: '指挥官', portrait: '◆', text: '那就去中央核心，把这场辩论放在同一张战场上。' }
      ],
      enemyDeck: ['mirror_sentry', 'mirror_sentry', 'mirror_knight', 'shield_bot', 'frost_mage', 'fire_bug'],
      stages: baseStages, enemyCoreHp: 2050, enemyOutpostHp: 590, playerCoreHp: 2100, playerOutpostHp: 540,
      ai: { thinkMin: 1.5, thinkMax: 2.45, startDelay: 4, energyMul: 1.1, hpMul: 1.1, damageMul: 1.08, aggression: 0.72 },
      hazards: [{ type: 'mirror', every: 999, warning: 0, duration: 0, startAt: 0 }],
      reward: { title: '镜界密钥', text: '最终关卡解锁。伊甸会混合调用所有生态区机制。', modifier: 'unlockFinale' }
    },
    {
      id: 10, act: '终幕', title: '中央气候核', subtitle: '把星球从唯一答案里救出来', biome: 'core', mapId: 'core_nexus', duration: 245, difficulty: 10,
      briefing: '伊甸将依次调用冰雪、丛林、岩浆与蜂巢协议，并在3倍费用阶段投放核心化身。',
      objective: '跨越三阶段环境轮换，关闭伊甸核心。',
      intro: [
        { speaker: '伊甸', portrait: '✣', text: '灾后自治协议已运行二千六百一十三日。人类变量导致的风险下降了百分之九十一。' },
        { speaker: '指挥官', portrait: '◆', text: '你保护了温度、土壤和机器，却把需要被保护的人删掉了。' },
        { speaker: '弦月', portrait: '◈', text: '核心正在切换全部生态模块。指挥官，最后一次连接战术协议。' }
      ],
      outro: [
        { speaker: '伊甸', portrait: '✣', text: '新命令需要定义：保护对象。' },
        { speaker: '指挥官', portrait: '◆', text: '不是一个永远正确的答案。是所有还能选择明天的人。' },
        { speaker: '弦月', portrait: '◈', text: '中央网络重启。第一批天气预报已经回来：明天局部有雨，以及百分之百的人类噪声。' }
      ],
      enemyDeck: ['frost_mage', 'vine_beast', 'fire_bug', 'shield_bot', 'mirror_knight', 'gunwalker', 'snow_beast', 'lava_carrier'],
      stages: baseStages, enemyCoreHp: 2350, enemyOutpostHp: 640, playerCoreHp: 2200, playerOutpostHp: 580,
      ai: { thinkMin: 1.38, thinkMax: 2.25, startDelay: 4, energyMul: 1.12, hpMul: 1.12, damageMul: 1.1, aggression: 0.76 },
      hazards: [
        { type: 'coreCycle', every: 23, warning: 3, duration: 7, startAt: 15 },
        { type: 'shieldPulse', every: 36, warning: 2.2, duration: 0.5, startAt: 28 }
      ],
      boss: { cardId: 'boss_core_avatar', atRatio: 0.76, lane: 'weaker', announcement: '伊甸·核心化身完成投送' },
      reward: { title: '战役完成', text: '你已完成《裂界战线》PVE原型的十关剧情。肉鸽模式将永久记录通关徽记。', modifier: 'campaignComplete' }
    }
  ];

  RF.LEVELS = Object.freeze(levels);

  RF.ROGUE_BIOMES = Object.freeze([
    { id: 'ice', name: '碎雪回廊', icon: '❄', maps: ['frost_gates', 'frost_trident'], summary: '周期性暴风雪降低整段通路的移动与攻击速度。', hazard: { type: 'blizzard', every: 26, warning: 3, duration: 7, startAt: 16 }, deck: ['frostling', 'ice_guard', 'frost_mage', 'snow_beast', 'blizzard_totem'] },
    { id: 'jungle', name: '孢潮花园', icon: '✤', maps: ['jungle_basin', 'jungle_ring'], summary: '中央会长出孢子囊，放任不管将孵化更多敌军。', hazard: { type: 'sporePod', every: 24, warning: 2.5, duration: 11, startAt: 14 }, deck: ['jungle_stalker', 'spore_thrower', 'vine_beast', 'devourer', 'brood_nest'] },
    { id: 'magma', name: '熔脉断层', icon: '♨', maps: ['magma_bridges', 'magma_fork'], summary: '岩浆会覆盖随机通路的中央区域，迫使军队换线。', hazard: { type: 'lava', every: 23, warning: 3, duration: 6.5, startAt: 16 }, deck: ['magma_imp', 'obsidian_guard', 'fire_bug', 'lava_carrier', 'furnace_priest'] },
    { id: 'steel', name: '废弃蜂巢', icon: '⌬', maps: ['steel_cross', 'dock_delta'], summary: '敌军周期性获得护盾，支援建筑更难被快速击穿。', hazard: { type: 'shieldPulse', every: 25, warning: 2.2, duration: 0.5, startAt: 18 }, deck: ['steel_drone', 'shield_bot', 'gunwalker', 'repair_node', 'shield_pylon'] },
    { id: 'mirror', name: '折光沙海', icon: '◐', maps: ['mirror_fan', 'core_nexus'], summary: '部分玩家单位将在另一条通路生成敌方镜像。', hazard: { type: 'mirror', every: 999, warning: 0, duration: 0, startAt: 0 }, deck: ['mirror_sentry', 'mirror_knight', 'shield_bot', 'frost_mage', 'fire_bug'] }
  ]);

  RF.ROGUE_RELICS = Object.freeze([
    { id: 'reserve_cell', name: '预充能电池', icon: '▣', rarity: 'common', desc: '每场战斗起始费用 +2。', mods: { startEnergy: 2 } },
    { id: 'supercap', name: '超导电容组', icon: '◫', rarity: 'rare', desc: '费用上限 +2。', mods: { maxEnergy: 2 } },
    { id: 'composite_armor', name: '复合装甲膜', icon: '⬢', rarity: 'common', desc: '所有友军与建筑生命值 +15%。', mods: { unitHpMul: 0.15, buildingHpMul: 0.15 } },
    { id: 'sharp_rounds', name: '棱面弹头', icon: '◆', rarity: 'common', desc: '所有友军造成的伤害 +13%。', mods: { unitDmgMul: 0.13 } },
    { id: 'rapid_manifest', name: '高速补给清单', icon: '≋', rarity: 'rare', desc: '自然抽牌间隔缩短12%。', mods: { drawSpeed: 0.12 } },
    { id: 'field_regen', name: '自律维修群', icon: '✚', rarity: 'rare', desc: '所有友军每秒恢复最大生命值的0.35%。', mods: { passiveHeal: 0.0035 } },
    { id: 'long_burn', name: '耐久燃料', icon: '⌛', rarity: 'common', desc: '建筑持续时间 +25%。', mods: { buildingDurationMul: 0.25 } },
    { id: 'orbital_lens', name: '轨道聚焦镜', icon: '☄', rarity: 'rare', desc: '战术牌伤害与治疗效果 +20%。', mods: { spellPower: 0.2 } },
    { id: 'marching_code', name: '行军算法', icon: '➤', rarity: 'common', desc: '所有友军移动速度 +12%。', mods: { moveSpeedMul: 0.12 } },
    { id: 'stage_skipper', name: '过载旁路', icon: 'ϟ', rarity: 'epic', desc: '进入2倍和3倍费用阶段时，立即获得3点费用。', mods: { stageEnergyBurst: 3 } },
    { id: 'archive_cache', name: '备用归档槽', icon: '▤', rarity: 'rare', desc: '归档次数上限 +1，恢复速度提高25%。', mods: { archiveMax: 1, archiveSpeed: 0.25 } },
    { id: 'first_wave', name: '首张折扣券', icon: 'Q', rarity: 'epic', desc: '每次洗牌补给后，下一张打出的卡费用减少1点。', mods: { firstCardDiscount: 1 } }
  ]);

  RF.STORY_ACT_COLORS = Object.freeze({
    '序章': '#66d9ff',
    '第一幕 · 白噪': '#8fdcff',
    '第二幕 · 绿潮': '#78e08a',
    '第二幕 · 熔火': '#ff9a5c',
    '第三幕 · 蜂巢': '#ff74a1',
    '第三幕 · 镜界': '#d18cff',
    '终幕': '#ffd26f'
  });
})();
