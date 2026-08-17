(function () {
  'use strict';

  const RF = window.RF;
  const UI = RF.UI;
  const deckList = (deck) => Array.isArray(deck?.arsenal) ? deck.arsenal : [];
  const artFor = (card) => card?.art || RF.CARD_ART?.[card?.id] || '';

  document.addEventListener('DOMContentLoaded', () => {
    const app = window.RiftfrontApp;
    if (!app) return;

    app.activeDeckGroup = 'arsenal';
    app.deckFactionFilter = app.deckFactionFilter || 'all';

    const previousRootClick = app.handleRootClick;
    app.handleRootClick = function handleRootClickSingleDeck(event) {
      const factionFilter = event.target.closest('[data-deck-faction]');
      if (factionFilter) {
        this.deckFactionFilter = factionFilter.dataset.deckFaction;
        RF.audio.play('click');
        this.renderDeckBuilder(false);
        return;
      }
      previousRootClick.call(this, event);
    };

    app.validateDeck = function validateDeckSingle(deck) {
      const errors = [];
      const list = deckList(deck);
      if (list.length !== 30) errors.push('战术牌库需要恰好30张牌。');
      const counts = this.getDeckCounts(deck);
      Object.entries(counts).forEach(([id, count]) => {
        const card = RF.CARDS[id];
        if (!card || card.enemyOnly || card.treasure) errors.push('套牌中存在无效卡牌。');
        const max = card?.rarity === 'legendary' ? 1 : 2;
        if (count > max) errors.push(`${card?.name || id}超过携带上限。`);
      });
      return { valid: errors.length === 0, errors };
    };

    app.renderDeckBuilder = function renderDeckBuilderSingle(resetDraft = false) {
      this.destroyBattle();
      this.closeModal();
      this.currentScreen = 'deck';
      this.refreshSave();
      if (resetDraft) this.deckDraft = RF.Storage.cloneDeck(this.save.deck);
      if (!this.deckDraft?.arsenal) this.deckDraft = RF.Storage.cloneDeck(RF.DEFAULT_DECK);
      const list = deckList(this.deckDraft);
      const counts = this.getDeckCounts(this.deckDraft);
      const total = list.length;
      const valid = this.validateDeck(this.deckDraft).valid;
      const average = list.length ? list.reduce((sum, id) => sum + RF.CARDS[id].cost, 0) / list.length : 0;
      const factionCounts = RF.FACTIONS.map((faction) => [faction, list.filter((id) => RF.CARDS[id]?.faction === faction.id).length]);

      const slots = Array.from({ length: 30 }, (_, index) => {
        const cardId = list[index];
        if (!cardId) return `<div class="deck-slot is-empty"><span>${index + 1}</span><small>空槽</small></div>`;
        const card = RF.CARDS[cardId];
        const art = artFor(card);
        const style = art ? `style="background-image:linear-gradient(180deg,rgba(3,8,13,.08),rgba(3,8,13,.9)),url('${UI.escapeHtml(art)}');background-position:center;background-size:cover"` : '';
        return `<button class="deck-slot ${art ? 'has-art' : ''}" ${style} data-remove-card="${cardId}" data-group="arsenal" data-index="${index}" title="点击移除：${UI.escapeHtml(card.desc)}"><span class="slot-cost">${card.cost}</span><b>${art ? '' : UI.escapeHtml(card.icon)}</b><strong>${UI.escapeHtml(card.name)}</strong><small>${UI.factionNames?.[card.faction] || '通用'} · ${UI.typeNames[card.type]}</small></button>`;
      }).join('');

      const library = RF.PLAYER_CARD_IDS
        .map((id) => RF.CARDS[id])
        .filter(Boolean)
        .filter((card) => !card.treasure)
        .filter((card) => this.deckFilter === 'all' || card.type === this.deckFilter)
        .filter((card) => this.deckFactionFilter === 'all' || card.faction === this.deckFactionFilter)
        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'zh-CN'))
        .map((card) => {
          const maxCopies = card.rarity === 'legendary' ? 1 : 2;
          const count = counts[card.id] || 0;
          return UI.cardTile(card, { action: 'add-card', count, disabled: count >= maxCopies });
        }).join('');

      this.root.innerHTML = `
        <div class="app-shell deck-shell single-deck-shell">
          ${UI.appHeader('deck', this.save)}
          <main class="content-main deck-main">
            <section class="page-hero compact-hero" style="position:relative;overflow:hidden;background:linear-gradient(90deg,rgba(5,11,18,.94),rgba(5,11,18,.62)),url('assets/title_hero.webp') center/cover no-repeat">
              <div><span class="eyebrow">TACTICAL DECK · SINGLE POOL</span><h1>一整个30张牌库，统一混洗随机抽取</h1><p>不再区分先锋、应变与决胜补给。四个阵营可以自由混编，战斗中的每次自然抽牌都来自整套牌库。</p><div class="info-pill-row"><span class="info-pill">平均费用 ${average.toFixed(2)}</span>${factionCounts.map(([faction,count]) => `<span class="info-pill">${UI.escapeHtml(faction.name)} ${count}</span>`).join('')}</div></div>
              <div class="deck-summary"><span>当前草案</span><strong>${total}<small>/30</small></strong><p>普通卡最多2张，传奇卡最多1张</p><div class="deck-actions"><button class="secondary-button" data-action="reset-deck">恢复推荐</button><button class="primary-button" data-action="save-deck" ${valid ? '' : 'disabled'}>保存套牌</button></div></div>
            </section>
            <section class="deck-builder-layout" style="margin-top:22px">
              <div class="deck-groups-column">
                <section class="deck-group is-active" style="--group-color:#62d6ff">
                  <div class="deck-group-heading"><span>牌库</span><div><strong>战术牌库</strong><small>30张牌一起洗入同一个抽牌堆。</small></div><b>${total}/30</b></div>
                  <div class="deck-group-stats"><span>平均费用 ${average.toFixed(2)}</span><span>点击卡牌移除</span></div>
                  <div class="deck-slots">${slots}</div>
                </section>
              </div>
              <aside class="card-library">
                <div class="library-heading"><div><span>卡牌库</span><strong>按类型与阵营筛选</strong></div>
                  <div class="filter-tabs">
                    <button class="${this.deckFilter === 'all' ? 'is-active' : ''}" data-deck-filter="all">全部</button>
                    <button class="${this.deckFilter === 'unit' ? 'is-active' : ''}" data-deck-filter="unit">小队</button>
                    <button class="${this.deckFilter === 'building' ? 'is-active' : ''}" data-deck-filter="building">建筑</button>
                    <button class="${this.deckFilter === 'spell' ? 'is-active' : ''}" data-deck-filter="spell">战术</button>
                  </div>
                  <div class="deck-faction-tabs" style="display:flex;flex-wrap:wrap;gap:7px;margin-top:9px">
                    <button class="${this.deckFactionFilter === 'all' ? 'is-active' : ''}" data-deck-faction="all">全部阵营</button>
                    ${RF.FACTIONS.map((faction) => `<button class="${this.deckFactionFilter === faction.id ? 'is-active' : ''}" data-deck-faction="${faction.id}">${UI.escapeHtml(faction.name)}</button>`).join('')}
                  </div>
                </div>
                <div class="card-library-grid">${library}</div>
              </aside>
            </section>
          </main>
        </div>`;
    };

    app.addDeckCard = function addDeckCardSingle(cardId) {
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

    app.removeDeckCard = function removeDeckCardSingle(groupId, index) {
      const list = deckList(this.deckDraft);
      if (index < 0 || index >= list.length) return;
      list.splice(index, 1);
      RF.audio.play('archive');
      this.renderDeckBuilder(false);
    };

    app.aggregateRogueMods = function aggregateRogueModsSingle(run) {
      const mods = {};
      const faction = RF.FACTIONS.find((item) => item.id === run?.factionId);
      if (faction?.mods) Object.entries(faction.mods).forEach(([key, value]) => { mods[key] = Number(mods[key] || 0) + Number(value || 0); });
      (run?.relics || []).forEach((id) => {
        const relic = RF.ROGUE_RELICS.find((item) => item.id === id);
        if (!relic) return;
        Object.entries(relic.mods).forEach(([key, value]) => { mods[key] = Number(mods[key] || 0) + Number(value || 0); });
      });
      return mods;
    };

    app.beginBattle = function beginBattleSingle(config, context) {
      this.closeModal();
      this.destroyBattle();
      this.currentScreen = 'battle';
      this.battleContext = context;
      this.lastBattleConfig = config;
      this.currentResult = null;
      this.lastHandSignature = '';
      this.battleEventLog = [];
      const speed = Number(this.refreshSave().settings.battleSpeed || 1);
      const playerMods = context.mode === 'rogue' ? this.aggregateRogueMods(this.save.rogue) : { startEnergy: this.save.campaign.completed.includes(7) ? 1 : 0 };
      const battleDeck = context.mode === 'rogue' && this.save.rogue?.deck ? RF.Storage.cloneDeck(this.save.rogue.deck) : RF.Storage.cloneDeck(this.save.deck);
      this.root.innerHTML = this.battleTemplate(config);
      const canvas = document.getElementById('battle-canvas');
      this.battle = new RF.BattleEngine(canvas, config, {
        deck: battleDeck,
        playerMods,
        speed,
        isRogue: context.mode === 'rogue',
        modeLabel: context.mode === 'rogue' ? `裂界远征 · 第${context.depth + 1}战区` : `剧情战役 · 第${context.levelId}关`,
        onState: (state, force) => this.updateBattleHud(state, force),
        onEvent: (event) => this.handleBattleEvent(event),
        onEnd: (result) => this.handleBattleEnd(result)
      });
      this.battle.start();
    };

    const originalBattleTemplate = app.battleTemplate;
    app.battleTemplate = function battleTemplateSingle(config) {
      return originalBattleTemplate.call(this, config)
        .replace('补给频道', '统一战术牌库')
        .replace('选择下一张自然抽牌', '所有自然抽牌均来自整套牌库')
        .replace('手牌未满时持续抽牌', '手牌未满时从整套牌库持续抽牌')
        .replace('落点将汇入最近通路', '整套牌库随机补给 · 落点将汇入最近通路');
    };

    const originalUpdateHand = app.updateHand;
    app.updateHand = function updateHandSingle(state) {
      originalUpdateHand.call(this, state);
      const empty = this.root.querySelector('.empty-hand small');
      if (empty) empty.textContent = '等待下一张牌从整套牌库中加入手牌。';
    };

    app.showTutorialSlides = function showTutorialSlidesSingle(onFinish) {
      this.tutorialState = {
        index: 0,
        onFinish,
        slides: [
          { icon: '◴', title: '战场心跳', eyebrow: '01 · 费用', html: '<p>费用默认每<strong>2.8秒</strong>恢复1点。战斗进入中后期后，恢复速度会依次提高到<strong>2倍</strong>和<strong>3倍</strong>。</p><div class="tutorial-phase-mini"><span>1×</span><i>→</i><span>2×</span><i>→</i><span>3×</span></div>' },
          { icon: '▤', title: '统一随机牌库', eyebrow: '02 · 抽牌', html: '<p>你的30张牌会一起洗入同一个牌库。基础抽牌间隔为<strong>5.6秒</strong>，每次都会从整个牌库随机抽取。</p><div class="tutorial-supply-mini"><span>30张牌</span><span>统一混洗</span><span>随机抽取</span></div>' },
          { icon: '➤', title: '拖动部署', eyebrow: '03 · 宽战区', html: '<p>直接把下方手牌拖到战场中的蓝色区域，也可以先点击手牌再选择落点。己方半场可大范围部署，小队会自动汇入最近的桥梁、峡口或道路，穿过中区后还能横向接敌。</p><div class="tutorial-lane-mini"><b>我方</b><i></i><i></i><strong>敌方</strong></div>' },
          { icon: '▤', title: '归档死牌', eyebrow: '04 · 手牌', html: '<p>手牌上限为10，满手时抽牌暂停而不会烧牌。右键一张手牌或按 <kbd>R</kbd> 可以归档它，等下次整副牌库重洗时再回来。</p><p class="tutorial-tip">第一关会在战场上显示四个实战训练目标。</p>' }
        ]
      };
      this.renderTutorialModal();
    };

    const originalGuide = app.renderGuide;
    app.renderGuide = function renderGuideSingle() {
      originalGuide.call(this);
      this.root.querySelectorAll('.guide-card').forEach((card) => {
        const title = card.querySelector('h2')?.textContent || '';
        if (title.includes('归档与再补给')) {
          const list = card.querySelector('ul');
          if (list) list.innerHTML = '<li>右键手牌或选择后按R，可以消耗1次归档。</li><li>被归档的牌在本轮牌库耗尽前不会再抽到。</li><li>整副牌库抽空后，8.4秒后将已使用和归档卡牌重新洗入。</li><li>归档默认最多储存2次，每11.2秒恢复1次。</li>';
        }
        if (title.includes('键盘操作')) {
          const keys = card.querySelector('.key-list');
          if (keys) keys.innerHTML = '<span><kbd>1－0</kbd>选择第1至10张手牌</span><span><kbd>R</kbd>归档所选卡牌</span><span><kbd>Space</kbd>暂停或继续</span><span><kbd>Esc</kbd>退出战斗</span>';
        }
      });
    };
  });
})();
