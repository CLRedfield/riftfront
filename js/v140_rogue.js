(function () {
  'use strict';

  const RF = window.RF;
  const UI = RF.UI;
  if (UI?.factionNames) UI.factionNames.shadow = '影渊教团';
  if (UI?.biomeNames) UI.biomeNames.shadow = '影渊';
  if (UI?.biomeIcons) UI.biomeIcons.shadow = '☾';
  const escape = UI.escapeHtml;
  const deckList = (deck) => Array.isArray(deck?.arsenal) ? deck.arsenal : [];
  const shuffle = (list) => {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  const factionOf = (id) => RF.FACTIONS.find((item) => item.id === id) || RF.FACTIONS[0];
  const artFor = (card) => card?.art || RF.CARD_ART?.[card?.id] || '';

  const BOSS_CARDS = {
    ice: 'boss_frost_giant', jungle: 'boss_bloom_mother', magma: 'boss_magma_colossus',
    steel: 'boss_hive_mind', mirror: 'boss_core_avatar', shadow: 'boss_eclipse_sovereign'
  };
  const BOSS_POWERS = {
    ice: [
      { bossName: '霜瞳女王', name: '极寒脉冲', power: 'iceNova', desc: '周期性冻结所有友军并留下减速。', every: 18.2, danger: 10 },
      { bossName: '零度占卜者', name: '霜印诅咒', power: 'frostCurse', desc: '周期性让整副手牌费用临时提高。', every: 17.4, duration: 9, danger: 13 },
      { bossName: '白噪巨像', name: '绝对零度', power: 'absoluteZero', desc: '所有中央通路同时被暴风雪覆盖。', every: 21.5, duration: 6.5, danger: 17 }
    ],
    jungle: [
      { bossName: '腐化古树', name: '孢潮繁育', power: 'sporeBrood', desc: '孵化伏击者和孢子投手，同时恢复自身。', every: 17.2, danger: 11 },
      { bossName: '千口花母', name: '狂野萌发', power: 'worldBloom', desc: '在多个位置同时生成孢子囊与增援。', every: 19.2, waves: 3, danger: 15 },
      { bossName: '世界根孵化者', name: '根系引力井', power: 'gravityHeart', desc: '制造牵引、减速并灼伤友军的引力区。', every: 20.5, duration: 8, danger: 18 }
    ],
    magma: [
      { bossName: '熔岩巨龙', name: '熔核震击', power: 'magmaCrash', desc: '制造岩浆喷发，同时让敌军进入狂热。', every: 17.5, danger: 12 },
      { bossName: '火山王冠', name: '星火陨落', power: 'meteorCrown', desc: '连续锁定多个友军位置并召唤陨石。', every: 18.5, hits: 3, damage: 118, danger: 16 },
      { bossName: '黑曜狱主', name: '熔界总喷发', power: 'worldEruption', desc: '全部通路同时喷发岩浆。', every: 22, duration: 5.8, danger: 19 }
    ],
    steel: [
      { bossName: '机械主宰', name: '蜂巢矩阵', power: 'shieldMatrix', desc: '周期性为全体敌军重新生成护盾。', every: 16.8, danger: 11 },
      { bossName: '自修执政官', name: '母炉自修', power: 'repairProtocol', desc: '恢复核心、前哨与机械单位并附加护盾。', every: 19.5, healRatio: 0.11, danger: 15 },
      { bossName: '钟摆蜂后', name: '时间封锁', power: 'timeTyranny', desc: '暂停自然抽牌并大幅降低费用恢复。', every: 21, duration: 7.5, danger: 18 }
    ],
    mirror: [
      { bossName: '镜界抄写员', name: '镜像抄录', power: 'mirrorClone', desc: '复制场上一支友军并投放到另一通路。', every: 17.3, danger: 12 },
      { bossName: '虚空吞噬者', name: '吞牌仪式', power: 'voidDevour', desc: '永久吞噬本场牌库中的卡牌并恢复生命。', every: 20.2, devourCount: 1, danger: 17 },
      { bossName: '时隙君王', name: '时间暴政', power: 'timeTyranny', desc: '封锁抽牌、减慢费用并冻结部分友军。', every: 19.6, duration: 8, danger: 19 }
    ],
    shadow: [
      { bossName: '猎桥司祭', name: '诱导劫持', power: 'aggroHijack', desc: '在中央生成高优先级方尖碑，并清除现有锁定。', every: 18, danger: 13 },
      { bossName: '月蚀猎王', name: '王桥易位', power: 'riftSwap', desc: '把最强友军折跃到其他通路，迫使阵形重组。', every: 18.5, danger: 16 },
      { bossName: '影渊君王', name: '唯一目标', power: 'eclipseDominion', desc: '轮流发动牵引、换路、隐匿与灵魂抽取。', every: 16, duration: 7.2, danger: 20 }
    ]
  };
  const MUTATORS = [
    { id: 'fortified', name: '加固核心', desc: '敌方核心生命值提高15%。', danger: 8, coreMul: 1.15 },
    { id: 'overclocked', name: '过载后勤', desc: '敌方费用恢复速度额外提高8%。', danger: 10, energyMul: 1.08 },
    { id: 'dense_hazard', name: '生态躁动', desc: '地图环境机制触发间隔缩短18%。', danger: 12, hazardMul: 0.82 },
    { id: 'armored_outposts', name: '装甲前哨', desc: '敌方前哨生命值提高22%。', danger: 9, outpostMul: 1.22 },
    { id: 'elite_wave', name: '精英战群', desc: '敌方单位生命与伤害额外提高7%。', danger: 13, statMul: 1.07 },
    { id: 'ambush', name: '伏击开局', desc: '敌军更早部署，并倾向进攻薄弱通路。', danger: 11, startDelay: -2, aggression: 0.08 }
  ];
  const CURSES = [
    { id: 'thin_reserves', name: '空洞储备', desc: '每场战斗起始费用 -1。', mods: { startEnergy: -1 } },
    { id: 'fragile_shell', name: '脆化外壳', desc: '友军生命值 -8%。', mods: { unitHpMul: -0.08 } },
    { id: 'slow_manifest', name: '迟缓清单', desc: '自然抽牌速度降低8%。', mods: { drawSpeed: -0.08 } },
    { id: 'dulled_edges', name: '钝化武装', desc: '友军伤害降低7%。', mods: { unitDmgMul: -0.07 } }
  ];

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .elite-badge{position:absolute;right:12px;top:12px;z-index:3;padding:6px 10px;border-radius:999px;background:linear-gradient(135deg,#ffbd5c,#ff694c);color:#271104;font-size:11px;font-weight:950;box-shadow:0 5px 18px rgba(255,100,70,.28)}
      .rogue-economy-panel{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;margin-top:18px;padding:17px 19px;border-radius:22px;background:linear-gradient(135deg,rgba(255,189,82,.09),rgba(145,83,255,.09));border:1px solid rgba(255,201,105,.18)}
      .rogue-economy-panel h3{margin:0 0 7px}.rogue-economy-panel p{margin:0;color:#afc2d1}.rogue-economy-stats{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.rogue-economy-stats span{padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.06);font-size:12px;color:#e4edf4}
      .shop-grid,.camp-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-top:17px}.shop-option,.camp-option{display:flex;flex-direction:column;gap:7px;align-items:flex-start;padding:16px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:#edf5fa;text-align:left}.shop-option:hover,.camp-option:hover{border-color:rgba(126,221,255,.38);transform:translateY(-2px)}.shop-option strong,.camp-option strong{font-size:16px}.shop-option small,.camp-option small{color:#9eb3c3;line-height:1.5}.shop-option em{font-style:normal;color:#ffd078;font-weight:850}
      .shop-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;max-height:58vh;overflow:auto;margin-top:16px}.shop-card-option{display:grid;grid-template-columns:54px 1fr auto;gap:10px;align-items:center;padding:10px;border-radius:15px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07);color:#eef5fa;text-align:left}.shop-card-option img{width:54px;height:54px;border-radius:11px;object-fit:cover}.shop-card-option b{display:block}.shop-card-option small{color:#94aabd}.shop-card-option em{font-style:normal;color:#8ee4ff;font-weight:900}.curse-chip{color:#ff9fa5!important;border-color:rgba(255,110,120,.18)!important}.upgrade-chip{color:#91eeff!important;border-color:rgba(88,220,255,.18)!important}
      @media(max-width:760px){.rogue-economy-panel{grid-template-columns:1fr}.shop-grid,.camp-choice-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    const app = window.RiftfrontApp;
    if (!app) return;

    const previousHome = app.renderHome.bind(app);
    app.renderHome = function renderHomeV140() {
      previousHome();
      const eyebrow = this.root.querySelector('.hero-copy .eyebrow');
      const title = this.root.querySelector('.hero-copy h1');
      const copy = this.root.querySelector('.hero-copy p');
      if (eyebrow) eyebrow.textContent = 'RIFTFRONT PROTOCOL · V1.4.0';
      if (title) title.textContent = '王桥索敌重制 + 全新影渊十关';
      if (copy) copy.textContent = '单位现在拥有独立视野、粘性目标锁定、建筑牵引、桥梁选择与死亡后重索敌。全新十关“影渊篇”围绕这些规则展开，并加入第四阵营影渊教团与更完整的远征商店、精英Boss、营地事件、诅咒和卡牌锻造。';
      const heroArt = this.root.querySelector('.hero-art-panel');
      if (heroArt) heroArt.style.backgroundImage = "url('assets/shadow/shadow_campaign.webp')";
      const rogueButton = this.root.querySelector('.hero-actions [data-action="go-rogue"] small');
      if (rogueButton) rogueButton.textContent = this.save.rogue?.active ? `第 ${this.save.rogue.depth + 1}/8 层 Boss` : '八层Boss · 卡包 / 遗物 / 宝藏';
      const campaignCopy = this.root.querySelector('.campaign-mode p');
      if (campaignCopy) campaignCopy.textContent = '全新十关“影渊篇”。从最近桥梁、粘性锁定与建筑牵引起步，最终在三座王桥上对抗会改写索敌规则的影渊君王。';
      const rogueCopy = this.root.querySelector('.rogue-mode p');
      if (rogueCopy) rogueCopy.textContent = '连续挑战八层随机Boss，途中出现精英悬赏、裂界商店、卡牌锻造、删牌、营地事件、危险契约和永久诅咒。';
      const laneA = this.root.querySelector('.hero-lane.lane-a b');
      const laneB = this.root.querySelector('.hero-lane.lane-b b');
      if (laneA) laneA.textContent = '锁定';
      if (laneB) laneB.textContent = '牵引';
    };

    const previousDeckBuilder = app.renderDeckBuilder.bind(app);
    app.renderDeckBuilder = function renderDeckBuilderV140(resetDraft = false) {
      previousDeckBuilder(resetDraft);
      const copy = this.root.querySelector('.hero-copy p');
      if (copy) copy.textContent = '四个阵营可以自由混编。战斗中的单位会按自己的索敌半径、目标偏好与桥梁路径行动；攻城单位还能被中央防御建筑牵引。';
      const libraryTitle = this.root.querySelector('.card-library .library-heading strong');
      if (libraryTitle) libraryTitle.textContent = '联邦 / 孢潮 / 棱镜 / 影渊 / 通用';
    };

    const previousStartRun = app.startNewRogue.bind(app);
    app.startNewRogue = function startNewRogueV140(factionId) {
      previousStartRun(factionId);
      const run = this.refreshSave().rogue;
      if (!run) return;
      run.version = 14;
      run.shards = 80;
      run.cardUpgrades = {};
      run.curses = [];
      run.eliteWins = 0;
      run.campSeen = [];
      run.shopPurchases = 0;
      run.options = this.generateRogueOptions(run.depth);
      RF.Storage.save();
      this.renderRogue();
      this.toast('获得80裂界碎片，可在远征商店精简或锻造牌库。', 'success');
    };

    app.generateRogueOptions = function generateRogueOptionsV140(depth) {
      const biomes = shuffle(RF.ROGUE_BIOMES).slice(0, 3);
      const eliteIndex = Math.floor(Math.random() * 3);
      const mutators = shuffle(MUTATORS);
      return biomes.map((biome, index) => {
        const pool = BOSS_POWERS[biome.id] || BOSS_POWERS.shadow;
        const unlocked = depth < 2 ? pool.slice(0, 1) : depth < 5 ? pool.slice(0, 2) : pool;
        const power = shuffle(unlocked)[0];
        const baseModifier = mutators[index % mutators.length];
        const elite = index === eliteIndex && depth > 0 && depth < 7;
        const modifier = elite
          ? { ...baseModifier, name: `精英 · ${baseModifier.name}`, desc: `${baseModifier.desc} 此Boss拥有额外生命、伤害与碎片奖励。`, statMul: Number(baseModifier.statMul || 1) * 1.12, coreMul: Number(baseModifier.coreMul || 1) * 1.08, danger: Number(baseModifier.danger || 10) + 5 }
          : { ...baseModifier };
        return {
          id: `rift14-${Date.now()}-${depth}-${index}-${Math.floor(Math.random() * 100000)}`,
          biomeId: biome.id,
          title: power.bossName,
          bossCardId: BOSS_CARDS[biome.id],
          bossPower: { ...power },
          modifier,
          elite,
          shardReward: elite ? 90 + depth * 10 : 45 + depth * 7,
          danger: Math.min(10, 2 + depth + Math.round((Number(power.danger || 12) + Number(modifier.danger || 8)) / 9) + (elite ? 1 : 0)),
          description: biome.summary
        };
      });
    };

    const previousBriefing = app.openBossBriefing.bind(app);
    app.openBossBriefing = function openBossBriefingV140(optionId) {
      previousBriefing(optionId);
      const run = this.refreshSave().rogue;
      const option = run?.options?.find((item) => item.id === optionId);
      if (!option) return;
      const hero = this.modalRoot.querySelector('.boss-dossier-hero > div');
      if (hero && option.elite) hero.insertAdjacentHTML('afterbegin', '<span class="elite-badge" style="position:static;display:inline-flex;margin-bottom:10px">精英Boss</span>');
      const grid = this.modalRoot.querySelector('.boss-dossier-grid');
      if (grid) grid.insertAdjacentHTML('beforeend', `<article><strong>悬赏报酬</strong><p>胜利获得 ${option.shardReward} 裂界碎片${option.elite ? '，并额外提高特殊战利品概率' : ''}。</p></article>`);
    };

    const previousBuildConfig = app.buildRogueConfig.bind(app);
    app.buildRogueConfig = function buildRogueConfigV140(run, option) {
      const config = previousBuildConfig(run, option);
      if (option.elite) {
        config.enemyCoreHp = Math.round(config.enemyCoreHp * 1.08);
        config.enemyOutpostHp = Math.round(config.enemyOutpostHp * 1.08);
        config.ai.hpMul *= 1.1;
        config.ai.damageMul *= 1.08;
        config.ai.energyMul *= 1.04;
        config.title = `精英 · ${config.title}`;
        config.objective = `击破精英Boss“${option.title}”，赢得额外裂界碎片与高阶战利品。`;
      }
      return config;
    };

    const previousMods = app.aggregateRogueMods.bind(app);
    app.aggregateRogueMods = function aggregateRogueModsV140(run) {
      const mods = previousMods(run);
      (run?.curses || []).forEach((id) => {
        const curse = CURSES.find((item) => item.id === id);
        if (!curse) return;
        Object.entries(curse.mods).forEach(([key, value]) => { mods[key] = Number(mods[key] || 0) + Number(value || 0); });
      });
      mods.cardUpgrades = { ...(run?.cardUpgrades || {}) };
      return mods;
    };

    const previousVictory = app.processRogueVictory.bind(app);
    app.processRogueVictory = function processRogueVictoryV140() {
      const run = this.refreshSave().rogue;
      const option = this.battleContext?.option;
      if (run?.active && option) {
        let reward = Number(option.shardReward || 45);
        if (option.elite) {
          run.eliteWins = Number(run.eliteWins || 0) + 1;
          const relicBonus = (run.relics || []).includes('rift_purse') ? 40 : 0;
          reward += relicBonus;
          run.rewardRerolls = Number(run.rewardRerolls || 0) + 1;
        }
        run.shards = Number(run.shards || 0) + reward;
        run.lastShardReward = reward;
        RF.Storage.save();
      }
      previousVictory();
    };

    const previousLootChoices = app.makeRogueLootChoices.bind(app);
    app.makeRogueLootChoices = function makeRogueLootChoicesV140(run) {
      const choices = previousLootChoices(run);
      const option = this.battleContext?.option;
      if (option?.elite) {
        const ownedRelics = new Set(run.relics || []);
        const ownedTreasures = new Set(run.treasureCards || []);
        const specials = [
          ...RF.ROGUE_RELICS.filter((relic) => !ownedRelics.has(relic.id)).map((relic) => ({ type: 'relic', relic })),
          ...RF.ROGUE_TREASURE_CARDS.filter((id) => !ownedTreasures.has(id)).map((cardId) => ({ type: 'treasure', cardId }))
        ];
        if (specials.length) {
          const special = shuffle(specials)[0];
          choices[Math.floor(Math.random() * choices.length)] = { id: `elite-special-${Date.now()}-${Math.random()}`, ...special };
        }
      }
      return choices;
    };

    const previousSelectLoot = app.selectRogueLoot.bind(app);
    app.selectRogueLoot = function selectRogueLootV140(rewardId) {
      const beforeDepth = Number(this.refreshSave().rogue?.depth || 0);
      previousSelectLoot(rewardId);
      const run = this.refreshSave().rogue;
      if (!run?.active) return;
      const newDepth = Number(run.depth || 0);
      if ([2,4,6].includes(newDepth) && !(run.campSeen || []).includes(newDepth)) {
        run.campSeen = run.campSeen || [];
        run.campSeen.push(newDepth);
        RF.Storage.save();
        this.openRogueCampEvent();
      } else if (newDepth > beforeDepth && Number(run.lastShardReward || 0) > 0) {
        this.toast(`获得 ${run.lastShardReward} 裂界碎片。`, 'success');
      }
    };

    const previousRenderRogue = app.renderRogue.bind(app);
    app.renderRogue = function renderRogueV140() {
      previousRenderRogue();
      const run = this.refreshSave().rogue;
      if (!run?.active) {
        const heroTitle = this.root.querySelector('.rogue-main .hero-copy h1');
        const heroCopy = this.root.querySelector('.rogue-main .hero-copy p');
        if (heroTitle) heroTitle.textContent = '四阵营八层远征：精英Boss、商店、锻造、营地与诅咒';
        if (heroCopy) heroCopy.textContent = '从12张初始牌组出发，连续挑战8名Boss。路线中会遇到精英悬赏、裂界商店和三次营地事件；你可以花碎片精简牌库、锻造卡牌、购买遗物，也可能通过危险契约换取更强成长。';
        return;
      }
      const encounterSection = this.root.querySelector('.encounter-selection');
      if (encounterSection && !this.root.querySelector('.rogue-economy-panel')) {
        const upgrades = Object.values(run.cardUpgrades || {}).reduce((sum, value) => sum + Number(value || 0), 0);
        const curses = (run.curses || []).map((id) => CURSES.find((item) => item.id === id)).filter(Boolean);
        encounterSection.insertAdjacentHTML('beforebegin', `
          <section class="rogue-economy-panel">
            <div><h3>裂界后勤与锻造</h3><p>用Boss悬赏获得的碎片精简套牌、购买遗物，或把关键卡锻造成强化版。</p><div class="rogue-economy-stats"><span>◈ ${Number(run.shards || 0)} 碎片</span><span class="upgrade-chip">锻造 ${upgrades} 次</span><span>精英胜利 ${Number(run.eliteWins || 0)}</span>${curses.map((curse) => `<span class="curse-chip" title="${escape(curse.desc)}">诅咒：${escape(curse.name)}</span>`).join('')}</div></div>
            <button class="primary-button" data-action="open-rogue-shop">进入裂界商店</button>
          </section>`);
      }
      (run.options || []).forEach((option) => {
        if (!option.elite) return;
        const button = this.root.querySelector(`[data-encounter-id="${option.id}"]`);
        const art = button?.querySelector('.boss-option-art');
        if (art && !art.querySelector('.elite-badge')) art.insertAdjacentHTML('beforeend', '<span class="elite-badge">精英悬赏</span>');
      });
      const hero = this.root.querySelector('.hero-copy .rogue-stats-row');
      if (hero && !hero.querySelector('[data-economy-chip]')) hero.insertAdjacentHTML('beforeend', `<span data-economy-chip>裂界碎片 ${Number(run.shards || 0)}</span>`);
    };

    app.openRogueShop = function openRogueShopV140() {
      const run = this.refreshSave().rogue;
      if (!run?.active) return;
      this.openModal(`
        <div class="modal-card" style="width:min(860px,94vw)">
          <span class="eyebrow">RIFT MERCHANT</span><h2>裂界商店 · 现有 ${Number(run.shards || 0)} 碎片</h2>
          <p>商店会在整轮远征中持续开放。锻造同一张牌最多2次，第二次还会令其费用降低1点。</p>
          <div class="shop-grid">
            <button class="shop-option" data-modal-action="shop-reroll"><strong>补给重掷许可</strong><small>战利品重掷次数 +1。</small><em>60 碎片</em></button>
            <button class="shop-option" data-modal-action="shop-relic"><strong>密封遗物箱</strong><small>随机获得一件尚未持有的被动遗物。</small><em>115 碎片</em></button>
            <button class="shop-option" data-modal-action="shop-upgrade"><strong>卡牌锻造台</strong><small>选择牌库中的一张牌强化。最多强化2次。</small><em>80 碎片</em></button>
            <button class="shop-option" data-modal-action="shop-remove"><strong>协议精简器</strong><small>从远征牌库中永久移除一张非宝藏牌。</small><em>55 碎片</em></button>
          </div>
          <div class="modal-actions"><button class="ghost-button" data-modal-action="close">离开商店</button></div>
        </div>`);
    };

    app.openRogueCardShop = function openRogueCardShopV140(mode) {
      const run = this.refreshSave().rogue;
      if (!run?.active) return;
      const counts = {};
      deckList(run.deck).forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
      const entries = Object.entries(counts)
        .filter(([id]) => RF.CARDS[id] && !RF.CARDS[id].treasure)
        .filter(([id]) => mode !== 'upgrade' || Number(run.cardUpgrades?.[id] || 0) < 2)
        .sort((a,b) => RF.CARDS[a[0]].cost - RF.CARDS[b[0]].cost)
        .map(([id,count]) => {
          const card = RF.CARDS[id];
          const art = artFor(card);
          const rank = Number(run.cardUpgrades?.[id] || 0);
          return `<button class="shop-card-option" data-modal-action="shop-${mode}-card" data-card-id="${id}">${art ? `<img src="${escape(art)}" alt="">` : `<span>${escape(card.icon)}</span>`}<div><b>${escape(card.name)} ${rank ? `+${rank}` : ''}</b><small>${card.cost}费 · ${escape(UI.typeNames[card.type])} · 持有${count}张</small></div><em>${mode === 'upgrade' ? '锻造' : '移除'}</em></button>`;
        }).join('');
      this.openModal(`<div class="modal-card" style="width:min(980px,95vw)"><span class="eyebrow">${mode === 'upgrade' ? 'FORGE A CARD' : 'THIN THE DECK'}</span><h2>${mode === 'upgrade' ? '选择要锻造的卡牌' : '选择要移除的卡牌'}</h2><p>${mode === 'upgrade' ? '每次锻造使该牌部署的单位、建筑或效果提高约16%；第二次锻造还会降低1点费用。' : '更薄的牌库更容易稳定抽到核心组合。牌库不会被精简到12张以下。'}</p><div class="shop-card-grid">${entries || '<p>没有符合条件的卡牌。</p>'}</div><div class="modal-actions"><button class="ghost-button" data-modal-action="shop-back">返回商店</button></div></div>`);
    };

    app.openRogueCampEvent = function openRogueCampEventV140() {
      const run = this.refreshSave().rogue;
      if (!run?.active) return;
      this.openModal(`
        <div class="modal-card" style="width:min(880px,94vw)">
          <span class="eyebrow">BETWEEN THE BOSSES</span><h2>王桥营地事件</h2><p>短暂的安全区里摆着一座锻炉、一张被撕过的路线图，以及一份明显不该签的契约。</p>
          <div class="camp-choice-grid">
            <button class="camp-option" data-modal-action="camp-forge"><strong>借用无主锻炉</strong><small>随机强化一张尚未满级的牌，并获得20碎片。</small></button>
            <button class="camp-option" data-modal-action="camp-rest"><strong>整理补给清单</strong><small>移除一张高费非宝藏牌，并获得1次战利品重掷。</small></button>
            <button class="camp-option" data-modal-action="camp-pact"><strong>签下影渊契约</strong><small>随机获得一件遗物与70碎片，但同时背负一个永久诅咒。</small></button>
            <button class="camp-option" data-modal-action="camp-scout"><strong>侦察下一座王桥</strong><small>获得45碎片，并重新生成下一层的三名Boss。</small></button>
          </div>
        </div>`, false);
    };

    function spend(run, amount) {
      if (Number(run.shards || 0) < amount) return false;
      run.shards -= amount;
      run.shopPurchases = Number(run.shopPurchases || 0) + 1;
      return true;
    }

    function randomUpgradeable(run) {
      const unique = [...new Set(deckList(run.deck).filter((id) => RF.CARDS[id] && !RF.CARDS[id].treasure))];
      return shuffle(unique.filter((id) => Number(run.cardUpgrades?.[id] || 0) < 2))[0];
    }

    function removeOne(run, cardId) {
      const list = deckList(run.deck);
      const index = list.indexOf(cardId);
      if (index >= 0 && list.length > 12) list.splice(index, 1);
    }

    const previousAction = app.handleAction.bind(app);
    app.handleAction = function handleActionV140(action, element) {
      if (action === 'open-rogue-shop') { this.openRogueShop(); return; }
      previousAction(action, element);
    };

    const previousModalClick = app.handleModalClick.bind(app);
    app.handleModalClick = function handleModalClickV140(event) {
      const element = event.target.closest('[data-modal-action]');
      const action = element?.dataset.modalAction;
      const run = this.refreshSave().rogue;
      if (!action || !run?.active) return previousModalClick(event);

      if (action === 'shop-reroll') {
        if (!spend(run, 60)) return this.toast('裂界碎片不足。', 'warning');
        run.rewardRerolls = Number(run.rewardRerolls || 0) + 1;
        RF.Storage.save(); this.closeModal(); this.renderRogue(); this.toast('获得1次战利品重掷。', 'success'); return;
      }
      if (action === 'shop-relic') {
        if (Number(run.shards || 0) < 115) return this.toast('裂界碎片不足。', 'warning');
        const owned = new Set(run.relics || []);
        const relic = shuffle(RF.ROGUE_RELICS.filter((item) => !owned.has(item.id)))[0];
        if (!relic) return this.toast('所有遗物都已获得。', 'warning');
        spend(run, 115); run.relics.push(relic.id);
        RF.Storage.save(); this.closeModal(); this.renderRogue(); this.toast(`购得遗物：${relic.name}`, 'success'); return;
      }
      if (action === 'shop-upgrade') { if (Number(run.shards || 0) < 80) return this.toast('裂界碎片不足。', 'warning'); this.openRogueCardShop('upgrade'); return; }
      if (action === 'shop-remove') { if (Number(run.shards || 0) < 55) return this.toast('裂界碎片不足。', 'warning'); this.openRogueCardShop('remove'); return; }
      if (action === 'shop-back') { this.openRogueShop(); return; }
      if (action === 'shop-upgrade-card') {
        const id = element.dataset.cardId;
        if (!id || !spend(run, 80)) return this.toast('无法完成锻造。', 'warning');
        run.cardUpgrades = run.cardUpgrades || {};
        run.cardUpgrades[id] = Math.min(2, Number(run.cardUpgrades[id] || 0) + 1);
        RF.Storage.save(); this.closeModal(); this.renderRogue(); this.toast(`${RF.CARDS[id].name}锻造至 +${run.cardUpgrades[id]}。`, 'success'); return;
      }
      if (action === 'shop-remove-card') {
        const id = element.dataset.cardId;
        if (!id || deckList(run.deck).length <= 12 || !spend(run, 55)) return this.toast('无法精简该卡牌。', 'warning');
        removeOne(run, id);
        RF.Storage.save(); this.closeModal(); this.renderRogue(); this.toast(`已移除1张${RF.CARDS[id].name}。`, 'success'); return;
      }
      if (action === 'camp-forge') {
        const id = randomUpgradeable(run);
        if (id) { run.cardUpgrades = run.cardUpgrades || {}; run.cardUpgrades[id] = Math.min(2, Number(run.cardUpgrades[id] || 0) + 1); }
        run.shards = Number(run.shards || 0) + 20;
        RF.Storage.save(); this.closeModal(); this.renderRogue(); this.toast(id ? `${RF.CARDS[id].name}获得一次免费锻造。` : '获得20裂界碎片。', 'success'); return;
      }
      if (action === 'camp-rest') {
        const candidates = deckList(run.deck).filter((id) => RF.CARDS[id] && !RF.CARDS[id].treasure).sort((a,b) => RF.CARDS[b].cost - RF.CARDS[a].cost);
        const id = candidates[0];
        if (id) removeOne(run, id);
        run.rewardRerolls = Number(run.rewardRerolls || 0) + 1;
        RF.Storage.save(); this.closeModal(); this.renderRogue(); this.toast(id ? `移除1张${RF.CARDS[id].name}，并获得1次重掷。` : '获得1次重掷。', 'success'); return;
      }
      if (action === 'camp-pact') {
        const owned = new Set(run.relics || []);
        const relic = shuffle(RF.ROGUE_RELICS.filter((item) => !owned.has(item.id)))[0];
        const curse = shuffle(CURSES.filter((item) => !(run.curses || []).includes(item.id)))[0];
        if (relic) run.relics.push(relic.id);
        if (curse) { run.curses = run.curses || []; run.curses.push(curse.id); }
        run.shards = Number(run.shards || 0) + 70;
        RF.Storage.save(); this.closeModal(); this.renderRogue(); this.toast(`契约完成：${relic?.name || '碎片'} / ${curse?.name || '无额外诅咒'}`, 'warning'); return;
      }
      if (action === 'camp-scout') {
        run.shards = Number(run.shards || 0) + 45;
        run.options = this.generateRogueOptions(run.depth);
        RF.Storage.save(); this.closeModal(); this.renderRogue(); this.toast('重新侦察下一层Boss，并获得45碎片。', 'success'); return;
      }
      previousModalClick(event);
    };

    const previousShowDeck = app.showRogueDeck.bind(app);
    app.showRogueDeck = function showRogueDeckV140() {
      previousShowDeck();
      const run = this.refreshSave().rogue;
      if (!run?.cardUpgrades) return;
      this.modalRoot.querySelectorAll('.rogue-deck-entry').forEach((entry) => {
        const name = entry.querySelector('b')?.textContent || '';
        const card = Object.values(RF.CARDS).find((item) => item.name === name);
        const rank = Number(run.cardUpgrades[card?.id] || 0);
        if (rank && entry.querySelector('b')) entry.querySelector('b').textContent = `${name} +${rank}`;
      });
    };

    const previousGuide = app.renderGuide.bind(app);
    app.renderGuide = function renderGuideV140() {
      previousGuide();
      const main = this.root.querySelector('.guide-grid, .guide-main');
      if (main) {
        const legacy = [...main.querySelectorAll('.guide-card')].find((entry) => entry.querySelector('.guide-number')?.textContent === 'V1.3');
        if (legacy) {
          const first = legacy.querySelector('li');
          if (first) first.textContent = '从四个阵营的12张初始牌组中选择一个。';
        }
        const card = document.createElement('article');
        card.className = 'guide-card';
        card.innerHTML = '<span class="guide-number">V1.4</span><h2>皇室战争式索敌与王桥路径</h2><ul><li>单位拥有独立索敌半径，进入视野后会锁定最近有效目标。</li><li>已锁定目标不会每帧乱跳，只有目标死亡、隐匿或超出追击范围才重选。</li><li>攻城单位只攻击建筑，可被中央防御建筑牵引，让多座前哨同时输出。</li><li>没有近处目标时，单位会选择路径成本最低的桥与前哨。</li><li>近战单位会围绕目标分散站位，同伴在桥口可以适度挤压通过。</li></ul>';
        main.appendChild(card);
        const rogue = document.createElement('article');
        rogue.className = 'guide-card';
        rogue.innerHTML = '<span class="guide-number">R+</span><h2>扩展远征系统</h2><ul><li>每层有一名精英悬赏Boss，胜利可获得更多碎片和特殊战利品。</li><li>商店可以购买重掷、随机遗物、卡牌锻造和牌库精简。</li><li>第2、4、6层后出现营地事件，可以免费锻造、休整、签订危险契约或重新侦察。</li><li>锻造卡牌最多2次，第二次锻造还会降低1点费用。</li><li>诅咒会永久削弱本轮，但通常伴随高价值奖励。</li></ul>';
        main.appendChild(rogue);
      }
    };

    app.renderHome();
  });
})();
