(function () {
  'use strict';

  const RF = window.RF;
  const UI = RF.UI;

  const shuffle = (list) => {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  const escape = UI.escapeHtml;
  const deckList = (deck) => Array.isArray(deck?.arsenal) ? deck.arsenal : [];
  const cloneDeck = (deck) => ({ arsenal: [...deckList(deck)] });
  const factionOf = (id) => RF.FACTIONS.find((item) => item.id === id) || RF.FACTIONS[0];
  const starterOf = (id) => RF.ROGUE_STARTER_DECKS[id] || RF.ROGUE_STARTER_DECKS[RF.FACTIONS[0].id];
  const artFor = (card) => card?.art || RF.CARD_ART?.[card?.id] || '';

  const BOSS_CARDS = {
    ice: 'boss_frost_giant',
    jungle: 'boss_bloom_mother',
    magma: 'boss_magma_colossus',
    steel: 'boss_hive_mind',
    mirror: 'boss_core_avatar'
  };

  const BOSS_POWERS = {
    ice: [
      { id: 'ice_nova', bossName: '霜瞳女王', name: '极寒脉冲', power: 'iceNova', desc: '周期性冻结所有我方作战单位，并留下长效减速。', every: 18.2, danger: 10 },
      { id: 'frost_curse', bossName: '零度占卜者', name: '霜印诅咒', power: 'frostCurse', desc: '周期性让整副手牌费用临时提高1点。', every: 17.4, duration: 9, danger: 13 },
      { id: 'absolute_zero', bossName: '白噪巨像', name: '绝对零度', power: 'absoluteZero', desc: '同时冻结全部中央通路，迫使军队离开狭口。', every: 21.5, duration: 6.5, danger: 17 }
    ],
    jungle: [
      { id: 'spore_brood', bossName: '腐化古树', name: '孢潮繁育', power: 'sporeBrood', desc: '孵化伏击者和孢子投手，同时恢复自身生命。', every: 17.2, danger: 11 },
      { id: 'world_bloom', bossName: '千口花母', name: '狂野萌发', power: 'worldBloom', desc: '在多个位置同时生成孢子囊与增援。', every: 19.2, waves: 3, danger: 15 },
      { id: 'root_gravity', bossName: '世界根孵化者', name: '根系引力井', power: 'gravityHeart', desc: '制造会牵引、减速并灼伤友军的中央引力区。', every: 20.5, duration: 8, danger: 18 }
    ],
    magma: [
      { id: 'magma_crash', bossName: '熔岩巨龙', name: '熔核震击', power: 'magmaCrash', desc: '制造岩浆喷发，同时让敌军进入短暂狂热。', every: 17.5, danger: 12 },
      { id: 'meteor_crown', bossName: '火山王冠', name: '星火陨落', power: 'meteorCrown', desc: '连续锁定多个友军位置并召唤陨石打击。', every: 18.5, hits: 3, damage: 118, danger: 16 },
      { id: 'world_eruption', bossName: '黑曜狱主', name: '熔界总喷发', power: 'worldEruption', desc: '全部通路同时喷发，战线会被岩浆切成数段。', every: 22, duration: 5.8, danger: 19 }
    ],
    steel: [
      { id: 'shield_matrix', bossName: '机械主宰', name: '蜂巢矩阵', power: 'shieldMatrix', desc: '周期性为全体敌军重新生成护盾。', every: 16.8, danger: 11 },
      { id: 'repair_protocol', bossName: '自修执政官', name: '母炉自修', power: 'repairProtocol', desc: '恢复核心、前哨与机械单位的生命，并附加护盾。', every: 19.5, healRatio: 0.11, danger: 15 },
      { id: 'time_tyranny', bossName: '钟摆蜂后', name: '时间封锁', power: 'timeTyranny', desc: '暂停自然抽牌并大幅降低费用恢复速度。', every: 21, duration: 7.5, danger: 18 }
    ],
    mirror: [
      { id: 'mirror_clone', bossName: '镜界抄写员', name: '镜像抄录', power: 'mirrorClone', desc: '复制场上一支我方单位，并从另一条通路投放。', every: 17.3, danger: 12 },
      { id: 'void_devour', bossName: '虚空吞噬者', name: '吞牌仪式', power: 'voidDevour', desc: '永久吞噬本场牌库中的卡牌，并以此恢复生命。', every: 20.2, devourCount: 1, danger: 17 },
      { id: 'time_tyrant', bossName: '时隙君王', name: '时间暴政', power: 'timeTyranny', desc: '封锁抽牌、减慢费用，并冻结部分友军。', every: 19.6, duration: 8, danger: 19 }
    ]
  };

  const MUTATORS = [
    { id: 'fortified', name: '加固核心', desc: '敌方核心生命值提高15%。', danger: 8, coreMul: 1.15 },
    { id: 'overclocked', name: '过载后勤', desc: '敌方费用恢复速度额外提高8%。', danger: 10, energyMul: 1.08 },
    { id: 'dense_hazard', name: '生态躁动', desc: '地图环境机制触发间隔缩短18%。', danger: 12, hazardMul: 0.82 },
    { id: 'armored_outposts', name: '装甲前哨', desc: '敌方前哨生命值提高22%。', danger: 9, outpostMul: 1.22 },
    { id: 'elite_wave', name: '精英战群', desc: '敌方单位生命与伤害额外提高7%。', danger: 13, statMul: 1.07 },
    { id: 'ambush', name: '伏击开局', desc: '敌军更早开始部署，并倾向从薄弱通路进攻。', danger: 11, startDelay: -2, aggression: 0.08 }
  ];

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .boss-option-art{position:relative;height:150px;border-radius:18px;overflow:hidden;background:#08131f center/cover no-repeat;border:1px solid rgba(255,255,255,.09)}
      .boss-option-art::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 36%,rgba(4,9,16,.92))}
      .boss-option-art span{position:absolute;left:14px;bottom:11px;z-index:1;font-weight:850;font-size:17px;color:#fff;text-shadow:0 2px 8px #000}
      .boss-power-box{padding:13px 14px;border-radius:16px;background:linear-gradient(135deg,rgba(142,87,255,.13),rgba(255,96,78,.08));border:1px solid rgba(194,153,255,.17)}
      .boss-power-box strong{display:block;margin-bottom:5px;color:#e8d5ff}.boss-power-box p{margin:0;color:#bfd0dd;font-size:13px;line-height:1.5}
      .run-route-rail{display:flex;align-items:center;gap:7px;overflow-x:auto;padding:14px 2px 5px;margin-top:14px}
      .run-route-rail i{flex:0 0 38px;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.11);font-style:normal;color:#8ea5b7;font-weight:800}
      .run-route-rail i.is-past{background:rgba(89,218,255,.13);border-color:rgba(89,218,255,.42);color:#8ce5ff}.run-route-rail i.is-current{background:rgba(255,184,84,.18);border-color:#ffbd62;color:#ffd08c;box-shadow:0 0 22px rgba(255,176,71,.18)}
      .run-route-rail b{flex:0 0 22px;height:2px;background:rgba(255,255,255,.09)}
      .rogue-stats-row{display:flex;flex-wrap:wrap;gap:9px;margin-top:15px}.rogue-stats-row span{padding:8px 11px;border-radius:999px;background:rgba(255,255,255,.065);font-size:12px;color:#d7e5ef}
      .run-collection-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;margin-top:18px}.run-collection-panel{border:1px solid rgba(147,216,255,.12);background:rgba(7,15,25,.88);border-radius:21px;padding:17px}.run-collection-panel h3{margin:0 0 10px}
      .boss-dossier{width:min(900px,94vw);overflow:hidden}.boss-dossier-hero{position:relative;min-height:270px;padding:28px;display:flex;align-items:flex-end;background:#09131f center/cover no-repeat}.boss-dossier-hero::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(4,9,16,.92),rgba(4,9,16,.55) 55%,rgba(4,9,16,.12))}.boss-dossier-hero>div{position:relative;z-index:1;max-width:560px}.boss-dossier-hero h2{font-size:35px;margin:7px 0 9px}.boss-dossier-body{padding:22px 26px 26px}.boss-dossier-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin:15px 0}.boss-dossier-grid article{padding:14px;border-radius:16px;background:rgba(255,255,255,.05)}.boss-dossier-grid strong{display:block;margin-bottom:5px}.boss-dossier-grid p{margin:0;color:#b9cad7;font-size:13px}
      .loot-choice-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;margin-top:18px}.loot-choice-card{position:relative;overflow:hidden;display:flex;flex-direction:column;min-height:330px;padding:0;border-radius:22px;background:#0a1420;border:1px solid rgba(147,216,255,.15);color:#eef5fa;text-align:left}.loot-choice-card:hover{transform:translateY(-3px);border-color:rgba(117,220,255,.42)}.loot-choice-art{height:130px;background:#0b1725 center/cover no-repeat;position:relative}.loot-choice-art::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent,rgba(8,15,24,.84))}.loot-choice-copy{padding:15px 16px 18px;display:flex;flex-direction:column;gap:8px;flex:1}.loot-choice-copy strong{font-size:18px}.loot-choice-copy small{color:#91a9bb}.loot-choice-copy ul{margin:0;padding-left:18px;color:#d5e2eb;line-height:1.65}.loot-type{display:inline-flex;align-self:flex-start;padding:5px 9px;border-radius:999px;background:rgba(99,210,255,.13);color:#8fe2ff;font-size:11px;font-weight:800;letter-spacing:.04em}.loot-choice-card.is-relic .loot-type{background:rgba(129,255,159,.12);color:#9bf6ad}.loot-choice-card.is-treasure .loot-type{background:rgba(255,196,84,.14);color:#ffd078}
      .reward-toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-top:16px}.reward-toolbar small{color:#91a7b8}
      .rogue-deck-modal{width:min(980px,95vw)}.rogue-deck-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;max-height:62vh;overflow:auto;margin-top:16px;padding-right:4px}.rogue-deck-entry{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:10px;border-radius:14px;background:rgba(255,255,255,.045)}.rogue-deck-entry img{width:42px;height:42px;border-radius:10px;object-fit:cover}.rogue-deck-entry b{font-size:13px}.rogue-deck-entry small{display:block;color:#8fa6b7}.rogue-deck-entry em{font-style:normal;color:#8be3ff;font-weight:850}
      .card-tile.has-generated-art .card-art,.hand-card.has-generated-art .hand-art{background-position:center;background-size:cover}
      @media(max-width:920px){.loot-choice-grid{grid-template-columns:1fr}.run-collection-grid,.boss-dossier-grid{grid-template-columns:1fr}.boss-dossier-hero h2{font-size:28px}}
    `;
    document.head.appendChild(style);
  }

  function patchCardRenderers() {
    UI.cardTile = function cardTileV130(card, options = {}) {
      const count = Number(options.count || 0);
      const disabled = Boolean(options.disabled);
      const compact = Boolean(options.compact);
      const selected = Boolean(options.selected);
      const action = options.action ? `data-${options.action}="${escape(card.id)}"` : '';
      const title = `${card.name}｜${card.cost}费｜${UI.typeNames[card.type] || card.type}\n${card.desc || ''}`;
      const art = artFor(card);
      const artStyle = art ? `style="background-image:linear-gradient(180deg,rgba(4,10,16,.04),rgba(4,10,16,.5)),url('${escape(art)}')"` : '';
      const faction = UI.factionNames[card.faction] || (card.treasure ? '远征宝藏' : '通用');
      return `
        <button class="card-tile rarity-${escape(card.rarity || 'common')} ${art ? 'has-generated-art' : ''} ${card.treasure ? 'is-treasure' : ''} ${compact ? 'is-compact' : ''} ${selected ? 'is-selected' : ''}" ${action} ${disabled ? 'disabled' : ''} title="${escape(title)}">
          <span class="card-cost">${escape(card.cost)}</span>
          <span class="card-art ${art ? 'has-image' : ''}" ${artStyle}><span>${art ? '' : escape(card.icon)}</span></span>
          <span class="card-name">${escape(card.name)}</span>
          <span class="card-meta">${escape(faction)} · ${escape(UI.typeNames[card.type] || card.type)} · ${escape(UI.rarityNames[card.rarity] || '特殊')}</span>
          ${compact ? '' : `<span class="card-desc">${escape(card.desc || '')}</span>`}
          ${count > 0 ? `<span class="card-count">×${count}</span>` : ''}
        </button>`;
    };

    UI.handCard = function handCardV130(item, selected, playable) {
      const card = item.card;
      const art = artFor(card);
      const artStyle = art ? `style="background-image:linear-gradient(180deg,rgba(4,10,16,.02),rgba(4,10,16,.3)),url('${escape(art)}')"` : '';
      return `
        <button class="hand-card rarity-${escape(card.rarity || 'common')} ${art ? 'has-generated-art' : ''} ${card.treasure ? 'is-treasure' : ''} ${selected ? 'is-selected' : ''} ${playable ? '' : 'is-unaffordable'}" data-card-index="${item.index}" title="拖到战场部署；左键选择；右键归档｜${escape(card.desc || '')}">
          <span class="hand-hotkey">${item.index === 9 ? '0' : item.index + 1}</span>
          <span class="hand-cost ${item.effectiveCost !== card.cost ? 'is-discounted' : ''}">${item.effectiveCost}</span>
          <span class="hand-art ${art ? 'has-image' : ''}" ${artStyle}>${art ? '' : `<b>${escape(card.icon)}</b>`}</span>
          <span class="hand-name">${escape(card.name)}</span>
          <span class="hand-type">${escape(UI.typeNames[card.type] || card.type)}</span>
        </button>`;
    };
  }

  function rewardArt(choice) {
    if (choice.type === 'relic') return 'assets/rogue_hero.webp';
    if (choice.type === 'treasure') return artFor(RF.CARDS[choice.cardId]) || 'assets/rogue_hero.webp';
    const card = RF.CARDS[choice.bundle.cards[0]];
    return artFor(card) || factionOf(choice.bundle.faction).art || 'assets/title_hero.webp';
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    patchCardRenderers();
    RF.PLAYER_CARD_IDS = Object.freeze(Object.keys(RF.CARDS).filter((id) => !RF.CARDS[id].enemyOnly && !RF.CARDS[id].treasure));

    const app = window.RiftfrontApp;
    if (!app) return;
    app.pendingEncounterId = null;
    app.deckFactionFilter = 'all';
    app.activeDeckGroup = 'arsenal';
    app.deckDraft = RF.Storage.cloneDeck(app.save.deck);

    app.validateDeck = function validateDeckV130(deck) {
      const errors = [];
      const list = deckList(deck);
      if (list.length !== 30) errors.push('战术牌库需要恰好30张牌。');
      const counts = this.getDeckCounts(deck);
      Object.entries(counts).forEach(([id, count]) => {
        const card = RF.CARDS[id];
        if (!card || card.enemyOnly || card.treasure) errors.push('套牌中存在无法用于标准构筑的卡牌。');
        const max = card?.rarity === 'legendary' ? 1 : 2;
        if (count > max) errors.push(`${card?.name || id}超过携带上限。`);
      });
      return { valid: errors.length === 0, errors };
    };

    app.addDeckCard = function addDeckCardV130(cardId) {
      const card = RF.CARDS[cardId];
      if (!card || card.enemyOnly || card.treasure) return;
      const list = deckList(this.deckDraft);
      if (list.length >= 30) { this.toast('战术牌库已经放满30张。', 'warning'); return; }
      const counts = this.getDeckCounts(this.deckDraft);
      const maxCopies = card.rarity === 'legendary' ? 1 : 2;
      if ((counts[cardId] || 0) >= maxCopies) { this.toast(`${card.name}最多携带${maxCopies}张。`, 'warning'); return; }
      list.push(cardId);
      RF.audio.play('card');
      this.renderDeckBuilder(false);
    };

    app.removeDeckCard = function removeDeckCardV130(groupId, index) {
      const list = deckList(this.deckDraft);
      if (index < 0 || index >= list.length) return;
      list.splice(index, 1);
      RF.audio.play('archive');
      this.renderDeckBuilder(false);
    };

    app.renderDeckBuilder = function renderDeckBuilderV130(resetDraft = false) {
      this.destroyBattle();
      this.closeModal();
      this.currentScreen = 'deck';
      this.refreshSave();
      if (resetDraft) this.deckDraft = RF.Storage.cloneDeck(this.save.deck);
      this.activeDeckGroup = 'arsenal';
      const list = deckList(this.deckDraft);
      const counts = this.getDeckCounts(this.deckDraft);
      const total = list.length;
      const valid = this.validateDeck(this.deckDraft).valid;
      const average = list.length ? list.reduce((sum, id) => sum + Number(RF.CARDS[id]?.cost || 0), 0) / list.length : 0;
      const slots = Array.from({ length: 30 }, (_, index) => {
        const cardId = list[index];
        if (!cardId) return `<div class="deck-slot is-empty"><span>${index + 1}</span><small>空槽</small></div>`;
        const card = RF.CARDS[cardId];
        const art = artFor(card);
        return `<button class="deck-slot ${art ? 'has-generated-art' : ''}" data-remove-card="${cardId}" data-group="arsenal" data-index="${index}" title="点击移除：${escape(card.desc)}" ${art ? `style="background-image:linear-gradient(90deg,rgba(5,12,20,.9),rgba(5,12,20,.68)),url('${escape(art)}');background-size:cover;background-position:center"` : ''}><span class="slot-cost">${card.cost}</span><b>${escape(card.icon)}</b><strong>${escape(card.name)}</strong><small>${escape(UI.factionNames[card.faction] || '通用')} · ${escape(UI.typeNames[card.type])}</small></button>`;
      }).join('');
      const library = RF.PLAYER_CARD_IDS
        .map((id) => RF.CARDS[id])
        .filter(Boolean)
        .filter((card) => this.deckFilter === 'all' || card.type === this.deckFilter)
        .sort((a, b) => a.cost - b.cost || String(a.faction || '').localeCompare(String(b.faction || '')) || a.name.localeCompare(b.name, 'zh-CN'))
        .map((card) => {
          const maxCopies = card.rarity === 'legendary' ? 1 : 2;
          const count = counts[card.id] || 0;
          return UI.cardTile(card, { action: 'add-card', count, disabled: count >= maxCopies || total >= 30 });
        }).join('');
      this.root.innerHTML = `
        <div class="app-shell deck-shell single-deck-shell">
          ${UI.appHeader('deck', this.save)}
          <main class="content-main deck-main">
            <section class="hero-art-panel" style="background-image:url('assets/title_hero.webp')"><div class="hero-copy"><span class="eyebrow">TACTICAL DECK · SINGLE SHUFFLED POOL</span><h1>整套30张牌一起混洗抽取</h1><p>不再区分先锋、应变和决胜补给。你构筑的是一整套30张战术牌，战斗中从全部牌随机抽取；四个阵营的单位也可以在标准PVE套牌中混编测试。</p><div class="info-pill-row"><span class="info-pill">${total}/30张</span><span class="info-pill">平均费用 ${average.toFixed(2)}</span><span class="info-pill">标准牌最多2张</span><span class="info-pill">传奇最多1张</span></div></div></section>
            <section class="deck-builder-layout" style="margin-top:22px">
              <div class="deck-groups-column"><section class="deck-group is-active" style="--group-color:#62d6ff"><div class="deck-group-heading"><span>牌库</span><div><strong>战术牌库</strong><small>所有30张牌混洗后随机抽取。</small></div><b>${total}/30</b></div><div class="deck-group-stats"><span>平均费用 ${average.toFixed(2)}</span><span>点击牌槽移除</span></div><div class="deck-slots">${slots}</div></section><div class="deck-actions" style="margin-top:14px"><button class="secondary-button" data-action="reset-deck">恢复推荐</button><button class="primary-button" data-action="save-deck" ${valid ? '' : 'disabled'}>保存套牌</button></div></div>
              <aside class="card-library"><div class="library-heading"><div><span>卡牌库</span><strong>联邦 / 孢潮 / 棱镜 / 通用</strong></div><div class="filter-tabs"><button class="${this.deckFilter === 'all' ? 'is-active' : ''}" data-deck-filter="all">全部</button><button class="${this.deckFilter === 'unit' ? 'is-active' : ''}" data-deck-filter="unit">小队</button><button class="${this.deckFilter === 'building' ? 'is-active' : ''}" data-deck-filter="building">建筑</button><button class="${this.deckFilter === 'spell' ? 'is-active' : ''}" data-deck-filter="spell">战术</button></div></div><div class="card-library-grid">${library}</div></aside>
            </section>
          </main>
        </div>`;
    };

    const previousRootClick = app.handleRootClick;
    app.handleRootClick = function handleRootClickV130(event) {
      const encounter = event.target.closest('[data-encounter-id]');
      if (encounter) {
        this.openBossBriefing(encounter.dataset.encounterId);
        return;
      }
      const factionButton = event.target.closest('[data-rogue-faction]');
      if (factionButton) {
        this.startNewRogue(factionButton.dataset.rogueFaction);
        return;
      }
      previousRootClick.call(this, event);
    };

    const previousModalClick = app.handleModalClick;
    app.handleModalClick = function handleModalClickV130(event) {
      const actionElement = event.target.closest('[data-modal-action]');
      const action = actionElement?.dataset.modalAction;
      if (action === 'launch-encounter') {
        const optionId = this.pendingEncounterId;
        this.pendingEncounterId = null;
        this.closeModal();
        if (optionId) this.startRogueEncounter(optionId);
        return;
      }
      if (action === 'select-loot') {
        this.selectRogueLoot(actionElement.dataset.rewardId);
        return;
      }
      if (action === 'reroll-loot') {
        this.rerollRogueLoot();
        return;
      }
      previousModalClick.call(this, event);
    };

    const previousAction = app.handleAction;
    app.handleAction = function handleActionV130(action, element) {
      if (action === 'inspect-rogue-deck') {
        this.showRogueDeck();
        return;
      }
      previousAction.call(this, action, element);
    };

    const previousHome = app.renderHome;
    app.renderHome = function renderHomeV130() {
      previousHome.call(this);
      const hero = this.root.querySelector('.hero-copy');
      if (hero) {
        const eyebrow = hero.querySelector('.eyebrow');
        const title = hero.querySelector('h1');
        const copy = hero.querySelector('p');
        if (eyebrow) eyebrow.textContent = 'RIFTFRONT PROTOCOL · V1.3.0';
        if (title) title.textContent = '单一随机牌库 + 八层Boss远征';
        if (copy) copy.textContent = '三组补给已彻底合并。剧情使用整套30张牌随机抽取；肉鸽模式从12张阵营初始牌组出发，连战8名拥有独立能力的Boss，每战后从主题卡包、被动遗物或主动宝藏中选择一项。';
      }
    };

    app.startNewRogue = function startNewRogueV130(factionId = RF.FACTIONS[0].id) {
      const faction = factionOf(factionId);
      const starter = starterOf(faction.id);
      const run = {
        version: 13,
        active: true,
        completed: false,
        depth: 0,
        maxDepth: 8,
        factionId: faction.id,
        deck: cloneDeck(starter.cards),
        relics: [],
        treasureCards: [],
        chosenBundles: [],
        chosenBundleIds: [],
        rewardRerolls: 1,
        history: [],
        startedAt: Date.now(),
        options: this.generateRogueOptions(0)
      };
      RF.Storage.patch((save) => { save.rogue = run; });
      this.refreshSave();
      this.renderRogue();
      this.toast(`远征已建立：${faction.name} · 8层Boss迷宫`, 'success');
    };

    app.generateRogueOptions = function generateRogueOptionsV130(depth) {
      const biomeChoices = shuffle(RF.ROGUE_BIOMES).slice(0, 3);
      const mutators = shuffle(MUTATORS);
      return biomeChoices.map((biome, index) => {
        const pool = BOSS_POWERS[biome.id] || BOSS_POWERS.mirror;
        const unlocked = depth < 2 ? pool.slice(0, 1) : depth < 5 ? pool.slice(0, 2) : pool;
        const power = shuffle(unlocked)[0];
        const mutator = mutators[index % mutators.length];
        return {
          id: `rift13-${Date.now()}-${depth}-${index}-${Math.floor(Math.random() * 100000)}`,
          biomeId: biome.id,
          title: power.bossName,
          bossCardId: BOSS_CARDS[biome.id],
          bossPower: { ...power },
          modifier: { ...mutator },
          danger: Math.min(10, 2 + depth + Math.round((power.danger + mutator.danger) / 8)),
          description: biome.summary
        };
      });
    };

    app.openBossBriefing = function openBossBriefingV130(optionId) {
      const run = this.refreshSave().rogue;
      if (!run?.active) return;
      const option = run.options.find((item) => item.id === optionId);
      if (!option) return;
      const biome = RF.ROGUE_BIOMES.find((item) => item.id === option.biomeId);
      const art = RF.BOSS_ART?.[option.biomeId] || artFor(RF.CARDS[option.bossCardId]) || 'assets/rogue_hero.webp';
      this.pendingEncounterId = optionId;
      this.openModal(`
        <div class="modal-card boss-dossier">
          <section class="boss-dossier-hero" style="background-image:url('${escape(art)}')">
            <div><span class="eyebrow">BOSS DOSSIER · 第 ${run.depth + 1}/${run.maxDepth} 层</span><h2>${escape(option.title)}</h2><p>${escape(biome?.summary || option.description)}</p></div>
          </section>
          <section class="boss-dossier-body">
            <div class="boss-dossier-grid">
              <article><strong>神奇能力：${escape(option.bossPower.name)}</strong><p>${escape(option.bossPower.desc)} 该能力会在Boss登场后反复发动。</p></article>
              <article><strong>战区异变：${escape(option.modifier.name)}</strong><p>${escape(option.modifier.desc)}</p></article>
              <article><strong>地图生态</strong><p>${escape(UI.biomeNames[option.biomeId] || option.biomeId)} · ${(biome?.maps || []).length ? '随机选择该生态的宽战区地图' : '宽战区'}</p></article>
              <article><strong>预计危险</strong><p>难度 ${option.danger}/10；越深层，敌军生命、伤害和后勤速度越高。</p></article>
            </div>
            <div class="modal-actions"><button class="primary-button" data-modal-action="launch-encounter">进入Boss战</button><button class="ghost-button" data-modal-action="close">返回选择</button></div>
          </section>
        </div>`);
    };

    app.buildRogueConfig = function buildRogueConfigV130(run, option) {
      const biome = RF.ROGUE_BIOMES.find((item) => item.id === option.biomeId);
      const depth = run.depth;
      const modifier = option.modifier || {};
      const power = option.bossPower || {};
      const scalar = 1 + depth * 0.085;
      const mapPool = Array.isArray(biome.maps) && biome.maps.length ? biome.maps : ['dock_delta'];
      const mapId = mapPool[Math.floor(Math.random() * mapPool.length)];
      const hazard = { ...biome.hazard, every: Number(biome.hazard.every || 25) * Number(modifier.hazardMul || 1) };
      const final = depth === run.maxDepth - 1;
      return {
        id: `rogue13-${option.id}`,
        act: final ? '裂界远征 · 最终层' : `裂界远征 · 第${depth + 1}层`,
        title: option.title,
        subtitle: `${biome.name}｜${power.name}`,
        biome: biome.id,
        mapId,
        duration: 158 + depth * 12 + (final ? 24 : 0),
        difficulty: Math.min(10, option.danger),
        briefing: `${biome.summary} Boss能力“${power.name}”会在登场后反复触发。`,
        objective: final ? `击破最终Boss“${option.title}”并摧毁核心。` : `击破“${option.title}”，赢取下一份三选一战利品。`,
        enemyDeck: [...biome.deck, ...biome.deck.slice(0, 3 + Math.min(2, Math.floor(depth / 3)))],
        stages: RF.LEVELS[0].stages,
        enemyCoreHp: Math.round((1240 + depth * 175) * Number(modifier.coreMul || 1)),
        enemyOutpostHp: Math.round((375 + depth * 38) * Number(modifier.outpostMul || 1)),
        playerCoreHp: 1950,
        playerOutpostHp: 480,
        ai: {
          thinkMin: Math.max(1.15, 2.05 - depth * 0.1),
          thinkMax: Math.max(1.9, 3.05 - depth * 0.12),
          startDelay: Math.max(0.8, 5.8 - depth * 0.22 + Number(modifier.startDelay || 0)),
          energyMul: (0.98 + depth * 0.035) * Number(modifier.energyMul || 1),
          hpMul: scalar * Number(modifier.statMul || 1),
          damageMul: (0.96 + depth * 0.04) * Number(modifier.statMul || 1),
          aggression: Math.min(0.92, 0.54 + depth * 0.045 + Number(modifier.aggression || 0))
        },
        hazards: [hazard],
        boss: {
          cardId: option.bossCardId || BOSS_CARDS[biome.id],
          atRatio: final ? 0.25 : 0.3,
          lane: depth % 2 ? 'stronger' : 'weaker',
          announcement: `${option.title}进入战区：${power.name}`,
          power: power.power,
          powerName: power.name,
          powerEvery: Math.max(12.5, Number(power.every || 18.5) - depth * 0.35),
          powerDuration: power.duration,
          powerHits: power.hits,
          powerDamage: power.damage,
          powerWaves: power.waves,
          healRatio: power.healRatio,
          devourCount: final && power.power === 'voidDevour' ? 2 : power.devourCount,
          curseAmount: final && power.power === 'frostCurse' ? 2 : 1
        }
      };
    };

    app.renderRogue = function renderRogueV130() {
      this.destroyBattle();
      this.closeModal();
      this.currentScreen = 'rogue';
      const run = this.refreshSave().rogue;
      if (!run?.active) {
        const factionOptions = RF.FACTIONS.map((faction) => {
          const starter = starterOf(faction.id);
          const cardChips = starter.cards.arsenal.map((id) => {
            const card = RF.CARDS[id];
            return `<span title="${escape(card.desc)}">${escape(card.icon)} ${escape(card.name)}</span>`;
          }).join('');
          return `
            <article class="faction-card">
              <img src="${escape(faction.art)}" alt="${escape(faction.name)}">
              <div class="faction-copy">
                <small>${escape(faction.title)}</small><h3>${escape(faction.name)}</h3>
                <p>${escape(starter.name)} · ${escape(starter.summary)}</p>
                <div class="faction-passive"><strong>${escape(faction.passiveName)}</strong><br>${escape(faction.passiveDesc)}</div>
                <div class="starter-deck-list">${cardChips}</div>
                <button class="primary-button" data-rogue-faction="${faction.id}" style="margin-top:14px">选择该阵营与12张初始牌</button>
              </div>
            </article>`;
        }).join('');
        this.root.innerHTML = `
          <div class="app-shell rogue-shell">
            ${UI.appHeader('rogue', this.save)}
            <main class="content-main rogue-main">
              <section class="hero-art-panel" style="background-image:url('assets/rogue_hero.webp')">
                <div class="hero-copy"><span class="eyebrow">DUNGEON-STYLE ROGUELIKE · 8 BOSSES</span><h1>选一副12张初始牌组，再把它养成一头卡牌巨兽</h1><p>连续挑战8名随机Boss。每次胜利后从3份战利品中选择1份：主题卡包固定加入3张卡；被动遗物永久强化本轮；主动宝藏则作为超规格卡牌直接塞进牌库。第1、3、5、7层保证出现至少一件宝藏或遗物。</p><div class="info-pill-row"><span class="info-pill">8层Boss</span><span class="info-pill">12张起步</span><span class="info-pill">每战 +3张主题卡</span><span class="info-pill">1次战利品重掷</span></div></div>
              </section>
              <section class="faction-grid">${factionOptions}</section>
            </main>
          </div>`;
        return;
      }

      const faction = factionOf(run.factionId);
      const relics = (run.relics || []).map((id) => RF.ROGUE_RELICS.find((item) => item.id === id)).filter(Boolean);
      const treasures = (run.treasureCards || []).map((id) => RF.CARDS[id]).filter(Boolean);
      const route = Array.from({ length: run.maxDepth }, (_, index) => `${index ? '<b></b>' : ''}<i class="${index < run.depth ? 'is-past' : index === run.depth ? 'is-current' : ''}">${index + 1}</i>`).join('');
      const optionCards = run.options.map((option) => {
        const art = RF.BOSS_ART?.[option.biomeId] || artFor(RF.CARDS[option.bossCardId]) || 'assets/rogue_hero.webp';
        return `
          <button class="encounter-card patch-encounter" data-encounter-id="${escape(option.id)}">
            <div class="boss-option-art" style="background-image:url('${escape(art)}')"><span>${escape(option.title)}</span></div>
            <div class="encounter-title"><div><small>${escape(UI.biomeNames[option.biomeId] || option.biomeId)}</small><h3>${escape(option.bossPower.name)}</h3></div><strong>${option.danger}/10</strong></div>
            <div class="boss-power-box"><strong>Boss能力</strong><p>${escape(option.bossPower.desc)}</p></div>
            <div class="encounter-mod"><strong>${escape(option.modifier.name)}</strong><p>${escape(option.modifier.desc)}</p></div>
            <small>${run.depth === run.maxDepth - 1 ? '最终Boss：胜利即完成本轮远征' : '胜利奖励：三选一牌包 / 遗物 / 主动宝藏'}</small>
          </button>`;
      }).join('');
      const deckCounts = {};
      deckList(run.deck).forEach((id) => { deckCounts[id] = (deckCounts[id] || 0) + 1; });
      const recent = Object.keys(deckCounts).slice(-14).map((id) => `<span><em>${deckCounts[id]}×</em>${escape(RF.CARDS[id]?.name || id)}</span>`).join('');

      this.root.innerHTML = `
        <div class="app-shell rogue-shell">
          ${UI.appHeader('rogue', this.save)}
          <main class="content-main rogue-main">
            <section class="hero-art-panel" style="background-image:url('${escape(faction.art)}')">
              <div class="hero-copy"><span class="eyebrow">ACTIVE EXPEDITION · ${escape(faction.title)}</span><h1>${escape(faction.name)} · 第 ${run.depth + 1} / ${run.maxDepth} 层</h1><p>${escape(faction.passiveName)}：${escape(faction.passiveDesc)}</p><div class="rogue-stats-row"><span>牌库 ${deckList(run.deck).length} 张</span><span>主题卡包 ${(run.chosenBundles || []).length} 组</span><span>遗物 ${relics.length} 件</span><span>主动宝藏 ${treasures.length} 张</span><span>重掷 ${run.rewardRerolls || 0} 次</span></div><div class="run-route-rail">${route}</div></div>
            </section>
            <section class="run-collection-grid">
              <article class="run-collection-panel"><div class="section-heading"><span>CURRENT DECK</span><h3>本轮牌库概览</h3></div><div class="deck-chip-list">${recent || '<span>尚无卡牌</span>'}</div><button class="secondary-button" data-action="inspect-rogue-deck" style="margin-top:14px">查看完整牌库</button></article>
              <article class="run-collection-panel"><h3>被动遗物</h3><div class="relic-chip-list">${relics.length ? relics.map((relic) => `<span title="${escape(relic.desc)}"><b>${relic.icon}</b> ${escape(relic.name)}</span>`).join('') : '<span>尚未获得</span>'}</div><h3 style="margin-top:14px">主动宝藏</h3><div class="bundle-chip-list">${treasures.length ? treasures.map((card) => `<span title="${escape(card.desc)}">${escape(card.icon)} ${escape(card.name)}</span>`).join('') : '<span>尚未获得</span>'}</div></article>
            </section>
            <section class="encounter-selection"><div class="section-heading"><span>SELECT THE NEXT BOSS</span><h2>${run.depth === run.maxDepth - 1 ? '最终层：从三名终极主宰中选择对手' : '选择下一名Boss与战区异变'}</h2></div><div class="encounter-grid patch-grid">${optionCards}</div></section>
            <div class="hero-actions" style="margin-top:18px"><button class="text-button danger" data-action="abandon-rogue">放弃本轮远征</button></div>
          </main>
        </div>`;
    };

    app.showRogueDeck = function showRogueDeckV130() {
      const run = this.refreshSave().rogue;
      if (!run) return;
      const counts = {};
      deckList(run.deck).forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
      const entries = Object.entries(counts).sort((a, b) => RF.CARDS[a[0]].cost - RF.CARDS[b[0]].cost || RF.CARDS[a[0]].name.localeCompare(RF.CARDS[b[0]].name, 'zh-CN')).map(([id, count]) => {
        const card = RF.CARDS[id];
        const art = artFor(card);
        return `<article class="rogue-deck-entry">${art ? `<img src="${escape(art)}" alt="">` : `<span>${escape(card.icon)}</span>`}<div><b>${escape(card.name)}</b><small>${card.cost}费 · ${escape(UI.typeNames[card.type])} · ${escape(card.treasure ? '主动宝藏' : UI.factionNames[card.faction] || '通用')}</small></div><em>×${count}</em></article>`;
      }).join('');
      this.openModal(`<div class="modal-card rogue-deck-modal"><span class="eyebrow">EXPEDITION DECK</span><h2>当前远征牌库 · ${deckList(run.deck).length}张</h2><p>随着主题卡包与主动宝藏加入，牌库会越来越厚，也更容易出现意外组合。</p><div class="rogue-deck-grid">${entries}</div><div class="modal-actions"><button class="primary-button" data-modal-action="close">关闭</button></div></div>`);
    };

    app.makeRogueLootChoices = function makeRogueLootChoicesV130(run) {
      const eligibleBundles = RF.ROGUE_BUNDLES.filter((bundle) => bundle.faction === 'neutral' || bundle.faction === run.factionId);
      const unpicked = eligibleBundles.filter((bundle) => !(run.chosenBundleIds || []).includes(bundle.id));
      const pool = unpicked.length >= 3 ? unpicked : eligibleBundles;
      const choices = shuffle(pool).slice(0, 3).map((bundle, index) => ({ id: `bundle-${Date.now()}-${index}-${bundle.id}`, type: 'bundle', bundle }));
      const guaranteedSpecial = run.depth % 2 === 0;
      if (guaranteedSpecial) {
        const specialIndex = Math.floor(Math.random() * choices.length);
        const ownedRelics = new Set(run.relics || []);
        const ownedTreasures = new Set(run.treasureCards || []);
        const relicPool = RF.ROGUE_RELICS.filter((relic) => !ownedRelics.has(relic.id));
        const treasurePool = RF.ROGUE_TREASURE_CARDS.filter((id) => !ownedTreasures.has(id));
        if (Math.random() < 0.52 && treasurePool.length) {
          const cardId = shuffle(treasurePool)[0];
          choices[specialIndex] = { id: `treasure-${Date.now()}-${cardId}`, type: 'treasure', cardId };
        } else if (relicPool.length) {
          const relic = shuffle(relicPool)[0];
          choices[specialIndex] = { id: `relic-${Date.now()}-${relic.id}`, type: 'relic', relic };
        }
      }
      return choices;
    };

    app.renderRogueLootModal = function renderRogueLootModalV130() {
      const run = this.refreshSave().rogue;
      const cards = this.rogueRewardChoices.map((choice) => {
        const art = rewardArt(choice);
        if (choice.type === 'bundle') {
          return `<button class="loot-choice-card" data-modal-action="select-loot" data-reward-id="${escape(choice.id)}"><div class="loot-choice-art" style="background-image:url('${escape(art)}')"></div><div class="loot-choice-copy"><span class="loot-type">主题卡包 · 3张</span><strong>${escape(choice.bundle.icon)} ${escape(choice.bundle.name)}</strong><small>${escape(choice.bundle.desc)}</small><ul>${choice.bundle.cards.map((id) => `<li>${escape(RF.CARDS[id].name)} · ${RF.CARDS[id].cost}费</li>`).join('')}</ul></div></button>`;
        }
        if (choice.type === 'relic') {
          return `<button class="loot-choice-card is-relic" data-modal-action="select-loot" data-reward-id="${escape(choice.id)}"><div class="loot-choice-art" style="background-image:url('${escape(art)}')"></div><div class="loot-choice-copy"><span class="loot-type">被动遗物</span><strong>${escape(choice.relic.icon)} ${escape(choice.relic.name)}</strong><small>${escape(UI.rarityNames[choice.relic.rarity] || choice.relic.rarity)}</small><ul><li>${escape(choice.relic.desc)}</li><li>本轮后续所有战斗永久生效</li></ul></div></button>`;
        }
        const card = RF.CARDS[choice.cardId];
        return `<button class="loot-choice-card is-treasure" data-modal-action="select-loot" data-reward-id="${escape(choice.id)}"><div class="loot-choice-art" style="background-image:url('${escape(art)}')"></div><div class="loot-choice-copy"><span class="loot-type">主动宝藏卡</span><strong>${escape(card.icon)} ${escape(card.name)}</strong><small>${card.cost}费 · 传奇宝藏</small><ul><li>${escape(card.desc)}</li><li>直接加入当前牌库，可在战斗中抽到</li></ul></div></button>`;
      }).join('');
      this.openModal(`<div class="modal-card relic-choice-modal" style="width:min(1040px,96vw)"><span class="eyebrow">CHOOSE ONE OF THREE</span><h2>Boss战利品三选一</h2><p>主题卡包会加入3张牌；遗物是永久被动；主动宝藏会作为超规格卡牌混入当前牌库。</p><div class="loot-choice-grid">${cards}</div><div class="reward-toolbar"><small>本轮剩余重掷：${run.rewardRerolls || 0}</small><button class="secondary-button" data-modal-action="reroll-loot" ${(run.rewardRerolls || 0) <= 0 ? 'disabled' : ''}>重掷三项战利品</button></div></div>`, false);
    };

    app.renderRogueBackgroundForReward = function renderRogueBackgroundForRewardV130() {
      this.currentScreen = 'rogue';
      this.root.innerHTML = `<div class="reward-backdrop-screen"><div class="reward-backdrop-panel"><div class="reward-backdrop-core">⌁</div><h1>Boss已击破</h1><p>正在从裂界残骸中整理主题卡包、遗物与主动宝藏……</p></div></div>`;
    };

    app.processRogueVictory = function processRogueVictoryV130() {
      const run = this.refreshSave().rogue;
      if (!run?.active) { this.exitBattleToMode(); return; }
      this.destroyBattle();
      run.history.push({ depth: run.depth, optionId: this.battleContext.optionId, boss: this.battleContext.option?.title, victory: true, at: Date.now() });
      if (run.depth >= run.maxDepth - 1) {
        run.active = false;
        run.completed = true;
        run.completedAt = Date.now();
        RF.Storage.patch((save) => { save.stats.rogueWins = Number(save.stats.rogueWins || 0) + 1; });
        RF.Storage.save();
        this.renderRogue();
        this.openModal(`<div class="modal-card rogue-complete-modal"><div class="result-emblem">⌁</div><span class="eyebrow">EIGHT BOSSES DEFEATED</span><h2>八层裂界远征完成</h2><p>你以${escape(factionOf(run.factionId).name)}从12张初始牌起步，最终带着${deckList(run.deck).length}张牌、${run.relics.length}件遗物和${(run.treasureCards || []).length}张主动宝藏击破了八名Boss。</p><div class="owned-relics centered">${run.relics.map((id) => { const relic = RF.ROGUE_RELICS.find((item) => item.id === id); return relic ? `<span><b>${relic.icon}</b>${escape(relic.name)}</span>` : ''; }).join('')}</div><div class="modal-actions"><button class="primary-button" data-modal-action="rogue-complete-close">返回远征界面</button></div></div>`, false);
        return;
      }
      RF.Storage.save();
      this.rogueRewardChoices = this.makeRogueLootChoices(run);
      this.rogueRelicSelected = false;
      this.renderRogueBackgroundForReward();
      this.renderRogueLootModal();
    };

    app.rerollRogueLoot = function rerollRogueLootV130() {
      const run = this.refreshSave().rogue;
      if (!run?.active || (run.rewardRerolls || 0) <= 0) return;
      run.rewardRerolls -= 1;
      this.rogueRewardChoices = this.makeRogueLootChoices(run);
      RF.Storage.save();
      this.closeModal();
      this.renderRogueLootModal();
      this.toast('战利品已重新扫描。', 'info');
    };

    app.selectRogueLoot = function selectRogueLootV130(rewardId) {
      if (this.rogueRelicSelected) return;
      const run = this.refreshSave().rogue;
      const choice = this.rogueRewardChoices.find((item) => item.id === rewardId);
      if (!run?.active || !choice) return;
      this.rogueRelicSelected = true;
      if (choice.type === 'bundle') {
        deckList(run.deck).push(...choice.bundle.cards);
        run.chosenBundles.push(choice.bundle.name);
        run.chosenBundleIds.push(choice.bundle.id);
        this.toast(`获得主题卡包：${choice.bundle.name}（+3张）`, 'success');
      } else if (choice.type === 'relic') {
        run.relics.push(choice.relic.id);
        this.toast(`获得被动遗物：${choice.relic.name}`, 'success');
      } else if (choice.type === 'treasure') {
        deckList(run.deck).push(choice.cardId);
        run.treasureCards.push(choice.cardId);
        this.toast(`获得主动宝藏：${RF.CARDS[choice.cardId].name}`, 'success');
      }
      run.depth += 1;
      run.options = this.generateRogueOptions(run.depth);
      RF.Storage.save();
      this.closeModal();
      this.renderRogue();
    };

    const previousGuide = app.renderGuide;
    app.renderGuide = function renderGuideV130() {
      previousGuide.call(this);
      const main = this.root.querySelector('.guide-grid, .guide-main');
      if (main) {
        const section = document.createElement('article');
        section.className = 'guide-card';
        section.innerHTML = '<span class="guide-number">V1.3</span><h2>八层Boss远征</h2><ul><li>从四个阵营的12张初始牌组中选择一个。</li><li>每名Boss都有周期性特殊能力，不只是提高数值。</li><li>每战后从三组战利品中选择：3张主题牌、被动遗物或主动宝藏。</li><li>第1、3、5、7层保证出现宝藏或遗物选项。</li><li>本轮拥有一次战利品重掷机会。</li></ul>';
        main.appendChild(section);
      }
    };

    app.renderHome();
  });
})();
