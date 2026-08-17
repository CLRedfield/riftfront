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

  class RiftfrontApp {
    constructor() {
      this.root = document.getElementById('screen');
      this.modalRoot = document.getElementById('modal-root');
      this.toastRoot = document.getElementById('toast-root');
      this.save = RF.Storage.load();
      this.currentScreen = 'home';
      this.freeSelect = false;
      this.battle = null;
      this.battleContext = null;
      this.lastBattleConfig = null;
      this.currentResult = null;
      this.lastHandSignature = '';
      this.battleEventLog = [];
      this.activeDeckGroup = 'vanguard';
      this.deckDraft = RF.Storage.cloneDeck(this.save.deck);
      this.deckFilter = 'all';
      this.dialogueState = null;
      this.tutorialState = null;
      this.confirmHandler = null;
      this.rogueRewardChoices = [];
      this.rogueRelicSelected = false;
      this.handDrag = null;
      this.suppressHandClickUntil = 0;

      RF.audio.setEnabled(this.save.settings.sound);
      document.body.classList.toggle('reduced-motion', Boolean(this.save.settings.reducedMotion));

      this.root.addEventListener('click', (event) => this.handleRootClick(event));
      this.root.addEventListener('contextmenu', (event) => this.handleRootContextMenu(event));
      this.root.addEventListener('pointerdown', (event) => this.handleHandPointerDown(event));
      document.addEventListener('pointermove', (event) => this.handleHandPointerMove(event), { passive: false });
      document.addEventListener('pointerup', (event) => this.handleHandPointerUp(event));
      document.addEventListener('pointercancel', (event) => this.handleHandPointerCancel(event));
      this.modalRoot.addEventListener('click', (event) => this.handleModalClick(event));
      document.addEventListener('keydown', (event) => this.handleKeyDown(event));
      window.addEventListener('beforeunload', () => RF.Storage.save());

      this.renderHome();
    }

    refreshSave() {
      this.save = RF.Storage.get();
      return this.save;
    }

    handleRootClick(event) {
      const handCard = event.target.closest('[data-card-index]');
      if (handCard && this.battle) {
        if (performance.now() < this.suppressHandClickUntil) return;
        this.battle.selectCard(Number(handCard.dataset.cardIndex));
        return;
      }

      const supply = event.target.closest('[data-supply]');
      if (supply && this.battle) {
        this.battle.switchSupply(supply.dataset.supply);
        return;
      }

      const levelButton = event.target.closest('[data-level-id]');
      if (levelButton) {
        this.startStoryLevel(Number(levelButton.dataset.levelId));
        return;
      }

      const encounter = event.target.closest('[data-encounter-id]');
      if (encounter) {
        this.startRogueEncounter(encounter.dataset.encounterId);
        return;
      }

      const addCard = event.target.closest('[data-add-card]');
      if (addCard) {
        this.addDeckCard(addCard.dataset.addCard);
        return;
      }

      const removeCard = event.target.closest('[data-remove-card]');
      if (removeCard) {
        this.removeDeckCard(removeCard.dataset.group, Number(removeCard.dataset.index));
        return;
      }

      const deckGroup = event.target.closest('[data-deck-group]');
      if (deckGroup) {
        this.activeDeckGroup = deckGroup.dataset.deckGroup;
        RF.audio.play('click');
        this.renderDeckBuilder(false);
        return;
      }

      const filter = event.target.closest('[data-deck-filter]');
      if (filter) {
        this.deckFilter = filter.dataset.deckFilter;
        RF.audio.play('click');
        this.renderDeckBuilder(false);
        return;
      }

      const actionElement = event.target.closest('[data-action]');
      if (!actionElement) return;
      this.handleAction(actionElement.dataset.action, actionElement);
    }

    handleRootContextMenu(event) {
      const handCard = event.target.closest('[data-card-index]');
      if (!handCard || !this.battle) return;
      event.preventDefault();
      this.battle.archiveCard(Number(handCard.dataset.cardIndex));
    }

    handleHandPointerDown(event) {
      if (!this.battle || event.button !== 0) return;
      const cardElement = event.target.closest('[data-card-index]');
      if (!cardElement || !this.root.contains(cardElement)) return;
      const index = Number(cardElement.dataset.cardIndex);
      if (!Number.isInteger(index)) return;
      this.cleanupHandDrag(true, false);
      this.handDrag = {
        pointerId: event.pointerId,
        index,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
        ghost: null,
        canvasPoint: null,
        sourceRect: cardElement.getBoundingClientRect()
      };
    }

    handleHandPointerMove(event) {
      const drag = this.handDrag;
      if (!drag || drag.pointerId !== event.pointerId || !this.battle) return;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (!drag.moved && distance < 7) return;
      if (!drag.moved) {
        drag.moved = true;
        this.battle.selectCard(drag.index, true);
        drag.ghost = this.createHandDragGhost(drag.index, drag.sourceRect);
        document.body.classList.add('is-card-dragging');
      }
      event.preventDefault();
      this.updateHandDragVisual(event.clientX, event.clientY);
    }

    handleHandPointerUp(event) {
      const drag = this.handDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (!drag.moved) {
        this.handDrag = null;
        return;
      }
      event.preventDefault();
      this.updateHandDragVisual(event.clientX, event.clientY);
      const point = drag.canvasPoint;
      if (point?.inside && this.battle) this.battle.playCardAtIndex(drag.index, point.x, point.y);
      this.suppressHandClickUntil = performance.now() + 320;
      this.cleanupHandDrag(true);
    }

    handleHandPointerCancel(event) {
      if (!this.handDrag || this.handDrag.pointerId !== event.pointerId) return;
      this.suppressHandClickUntil = performance.now() + 220;
      this.cleanupHandDrag(true);
    }

    createHandDragGhost(index, sourceRect) {
      const source = this.root.querySelector(`[data-card-index="${index}"]`);
      const ghost = source ? source.cloneNode(true) : document.createElement('div');
      ghost.removeAttribute?.('data-card-index');
      ghost.removeAttribute?.('title');
      ghost.classList.add('card-drag-ghost');
      ghost.classList.remove('is-selected');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.width = `${Math.max(82, Math.min(128, Number(sourceRect?.width || 96) * 1.14))}px`;
      const route = document.createElement('span');
      route.className = 'drag-route';
      route.textContent = '移向战场';
      ghost.appendChild(route);
      document.body.appendChild(ghost);
      return ghost;
    }

    battleCanvasPoint(clientX, clientY) {
      const canvas = document.getElementById('battle-canvas');
      if (!canvas) return { inside: false, x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
      const renderWidth = canvas.width * scale;
      const renderHeight = canvas.height * scale;
      const offsetX = (rect.width - renderWidth) * 0.5;
      const offsetY = (rect.height - renderHeight) * 0.5;
      const localX = clientX - rect.left - offsetX;
      const localY = clientY - rect.top - offsetY;
      const inside = localX >= 0 && localX <= renderWidth && localY >= 0 && localY <= renderHeight;
      return {
        inside,
        x: localX / Math.max(0.001, scale),
        y: localY / Math.max(0.001, scale)
      };
    }

    updateHandDragVisual(clientX, clientY) {
      const drag = this.handDrag;
      if (!drag?.moved || !drag.ghost || !this.battle) return;
      drag.ghost.style.left = `${clientX}px`;
      drag.ghost.style.top = `${clientY}px`;
      const point = this.battleCanvasPoint(clientX, clientY);
      drag.canvasPoint = point;
      const routeCopy = drag.ghost.querySelector('.drag-route');
      drag.ghost.classList.toggle('is-over-field', point.inside);
      if (!point.inside) {
        drag.ghost.classList.remove('is-valid', 'is-invalid');
        if (routeCopy) routeCopy.textContent = '拖到蓝色战区';
        this.battle.setDragPreview(drag.index, 0, 0, false);
        return;
      }
      this.battle.setDragPreview(drag.index, point.x, point.y, true);
      const preview = this.battle.getPlacementPreview(drag.index, point.x, point.y);
      drag.ghost.classList.toggle('is-valid', Boolean(preview.ok));
      drag.ghost.classList.toggle('is-invalid', !preview.ok);
      if (routeCopy) routeCopy.textContent = preview.ok
        ? `${preview.routeName || '最近通路'} · 松手部署`
        : String(preview.reason || '此处无法部署');
    }

    cleanupHandDrag(keepSelection = true, notifyBattle = true) {
      const drag = this.handDrag;
      if (drag?.ghost) drag.ghost.remove();
      this.handDrag = null;
      document.body.classList.remove('is-card-dragging');
      if (notifyBattle && this.battle) this.battle.clearDragPreview(keepSelection);
    }

    handleAction(action, element) {
      RF.audio.play('click');
      switch (action) {
        case 'go-home': this.renderHome(); break;
        case 'go-campaign': this.renderCampaign(); break;
        case 'go-rogue': this.renderRogue(); break;
        case 'go-deck':
          this.deckDraft = RF.Storage.cloneDeck(this.refreshSave().deck);
          this.renderDeckBuilder();
          break;
        case 'go-guide': this.renderGuide(); break;
        case 'open-settings': this.showSettings(); break;
        case 'toggle-free-select':
          this.freeSelect = !this.freeSelect;
          this.toast(this.freeSelect ? '已开启原型自由选关，不会修改通关记录。' : '已恢复顺序解锁。', 'info');
          this.renderCampaign();
          break;
        case 'battle-pause': if (this.battle) this.battle.togglePause(); break;
        case 'battle-speed': if (this.battle) this.battle.cycleSpeed(); break;
        case 'battle-leave': this.requestLeaveBattle(); break;
        case 'archive-selected': if (this.battle) this.battle.archiveCard(); break;
        case 'save-deck': this.saveDeck(); break;
        case 'reset-deck':
          this.deckDraft = RF.Storage.cloneDeck(RF.DEFAULT_DECK);
          this.renderDeckBuilder(false);
          this.toast('已恢复推荐套牌，点击“保存套牌”后生效。', 'info');
          break;
        case 'start-rogue': this.startNewRogue(); break;
        case 'abandon-rogue': this.confirmAbandonRogue(); break;
        case 'copy-save': this.copySaveCode(); break;
        case 'import-save': this.importSaveCode(); break;
        case 'reset-progress': this.confirmResetProgress(); break;
        case 'toggle-sound': this.toggleSound(); break;
        case 'toggle-motion': this.toggleMotion(); break;
        case 'scroll-to-mechanics': document.getElementById('home-mechanics')?.scrollIntoView({ behavior: 'smooth' }); break;
        default:
          if (element?.dataset?.action) console.debug('[Riftfront] Unknown action:', action);
      }
    }

    handleModalClick(event) {
      const actionElement = event.target.closest('[data-modal-action]');
      if (!actionElement) {
        if (event.target === this.modalRoot && this.modalRoot.dataset.dismissible === 'true') this.closeModal();
        return;
      }
      const action = actionElement.dataset.modalAction;
      RF.audio.play('click');
      switch (action) {
        case 'close': this.closeModal(); break;
        case 'dialogue-next': this.advanceDialogue(false); break;
        case 'dialogue-skip': this.advanceDialogue(true); break;
        case 'tutorial-next': this.advanceTutorial(false); break;
        case 'tutorial-skip': this.advanceTutorial(true); break;
        case 'confirm-yes': {
          const handler = this.confirmHandler;
          this.closeModal();
          this.confirmHandler = null;
          if (handler) handler();
          break;
        }
        case 'confirm-no': this.closeModal(); this.confirmHandler = null; break;
        case 'result-primary': this.handleResultPrimary(); break;
        case 'result-retry': this.retryBattle(); break;
        case 'result-back': this.exitBattleToMode(); break;
        case 'select-relic': this.selectRogueRelic(actionElement.dataset.relicId); break;
        case 'rogue-complete-close': this.closeModal(); this.renderRogue(); break;
        default: break;
      }
    }

    handleKeyDown(event) {
      if (this.modalRoot.classList.contains('is-open')) {
        if (event.key === 'Escape' && this.modalRoot.dataset.dismissible === 'true') this.closeModal();
        if (event.key === 'Enter' && this.dialogueState) this.advanceDialogue(false);
        return;
      }

      if (this.battle) {
        if (/^[1-9]$/.test(event.key)) {
          this.battle.selectCard(Number(event.key) - 1);
          return;
        }
        if (event.key === '0') {
          this.battle.selectCard(9);
          return;
        }
        if (event.key.toLowerCase() === 'q') this.battle.switchSupply('vanguard');
        if (event.key.toLowerCase() === 'w') this.battle.switchSupply('response');
        if (event.key.toLowerCase() === 'e') this.battle.switchSupply('finisher');
        if (event.key.toLowerCase() === 'r') this.battle.archiveCard();
        if (event.code === 'Space') {
          event.preventDefault();
          this.battle.togglePause();
        }
        if (event.key === 'Escape') this.requestLeaveBattle();
        return;
      }

      if (event.key === 'Escape' && this.currentScreen !== 'home') this.renderHome();
    }

    renderHome() {
      this.destroyBattle();
      this.closeModal();
      this.currentScreen = 'home';
      this.refreshSave();
      const completed = this.save.campaign.completed.length;
      const nextLevelId = Math.min(RF.LEVELS.length, completed + 1);
      const nextLevel = RF.LEVELS[nextLevelId - 1];
      const rogue = this.save.rogue;
      const deckAverage = this.calculateDeckAverage(this.save.deck).toFixed(2);

      this.root.innerHTML = `
        <div class="app-shell home-shell">
          ${UI.appHeader('home', this.save, { transparent: true })}
          <main class="home-main">
            <section class="hero-panel">
              <div class="hero-grid" aria-hidden="true"></div>
              <div class="hero-copy">
                <span class="eyebrow">离线可玩的 PVE 原型 · V${RF.VERSION}</span>
                <h1><span>裂界</span>战线</h1>
                <p class="hero-subtitle">用一整套30张战术协议在可自由部署的宽战区中作战。所有卡牌混洗后随机抽取，中央通路会随地图改变，费用则从1倍升至2倍、3倍，后半局会像拧开的高压阀一样迅速升温。</p>
                <div class="hero-actions">
                  <button class="primary-button large" data-action="go-campaign"><span>继续剧情</span><small>第 ${nextLevel.id} 关 · ${UI.escapeHtml(nextLevel.title)}</small></button>
                  <button class="secondary-button large" data-action="go-rogue"><span>${rogue?.active ? '继续远征' : '开始肉鸽'}</span><small>${rogue?.active ? `第 ${rogue.depth + 1}/5 战区` : '五战一轮，战后选择遗物'}</small></button>
                  <button class="ghost-button" data-action="scroll-to-mechanics">查看玩法机制 ↓</button>
                </div>
              </div>
              <div class="hero-visual" aria-hidden="true">
                <div class="core-orbit orbit-a"></div>
                <div class="core-orbit orbit-b"></div>
                <div class="hero-core"><span>RF</span><i></i></div>
                <div class="hero-lane lane-a"><b>先锋</b><i></i><i></i><i></i></div>
                <div class="hero-lane lane-b"><b>应变</b><i></i><i></i></div>
                <div class="hero-stage stage-one">1×</div>
                <div class="hero-stage stage-two">2×</div>
                <div class="hero-stage stage-three">3×</div>
              </div>
            </section>

            <section class="home-stats">
              <article><span>剧情进度</span><strong>${completed}<small>/10</small></strong><div class="thin-progress"><i style="width:${completed * 10}%"></i></div></article>
              <article><span>当前套牌</span><strong>30<small>张</small></strong><p>平均费用 ${deckAverage}</p></article>
              <article><span>总胜场</span><strong>${Number(this.save.stats.victories || 0)}</strong><p>已进行 ${Number(this.save.stats.battles || 0)} 场战斗</p></article>
              <article><span>远征徽记</span><strong>${Number(this.save.stats.rogueWins || 0)}</strong><p>完整肉鸽通关次数</p></article>
            </section>

            <section class="mode-grid">
              <button class="mode-card campaign-mode" data-action="go-campaign">
                <span class="mode-index">01</span><span class="mode-icon">◇</span>
                <div><small>STORY CAMPAIGN</small><h2>十关剧情战役</h2><p>从失联码头一路进入中央气候核。每两关左右更换一种战场规则，并穿插四场Boss战。</p></div>
                <span class="mode-arrow">→</span>
              </button>
              <button class="mode-card rogue-mode" data-action="go-rogue">
                <span class="mode-index">02</span><span class="mode-icon">⌁</span>
                <div><small>ROGUELITE EXPEDITION</small><h2>裂界远征</h2><p>连续挑战八层随机Boss。每战后扩充卡组或选择遗物、宝藏，并在商店与营地继续塑造本轮构筑。</p></div>
                <span class="mode-arrow">→</span>
              </button>
              <button class="mode-card deck-mode" data-action="go-deck">
                <span class="mode-index">03</span><span class="mode-icon">▤</span>
                <div><small>TACTICAL LOADOUT</small><h2>30张套牌编辑</h2><p>整套30张牌统一混洗。不同阵营、单位、建筑和战术可以自由组合，随机抽牌让每场战斗都需要临场应变。</p></div>
                <span class="mode-arrow">→</span>
              </button>
            </section>

            <section class="mechanics-section" id="home-mechanics">
              <div class="section-heading"><span>CORE LOOP</span><h2>一场战斗的三次换挡</h2><p>资源节奏会主动推动对局结束，避免双方在塔后面把时间腌成咸菜。</p></div>
              <div class="phase-showcase">
                <article class="phase-card phase-1"><span class="phase-rate">1×</span><small>0%－43%</small><h3>侦察期</h3><p>每2.8秒恢复1费。观察敌人构成、建立前排，并根据随机手牌规划部署。</p></article>
                <div class="phase-connector">→</div>
                <article class="phase-card phase-2"><span class="phase-rate">2×</span><small>43%－76%</small><h3>战线升温</h3><p>费用恢复提升至2倍，Boss与环境机制通常在这一阶段正式加入。</p></article>
                <div class="phase-connector">→</div>
                <article class="phase-card phase-3"><span class="phase-rate">3×</span><small>76%－100%</small><h3>超载决战</h3><p>费用恢复提升至3倍，重装与连续战术快速登场，战场进入最终解题时间。</p></article>
              </div>
            </section>

            <footer class="app-footer"><span>纯前端 · 无需联网 · 自动本地存档</span><span>建议使用 Chrome / Edge / Firefox 最新版</span></footer>
          </main>
        </div>`;
    }

    renderCampaign() {
      this.destroyBattle();
      this.closeModal();
      this.currentScreen = 'campaign';
      this.refreshSave();
      const completedSet = new Set(this.save.campaign.completed.map(Number));
      const completed = completedSet.size;

      const levelCards = RF.LEVELS.map((level) => {
        const previousComplete = level.id === 1 || completedSet.has(level.id - 1);
        const unlocked = this.freeSelect || previousComplete;
        const finished = completedSet.has(level.id);
        const stars = Number(this.save.campaign.stars[level.id] || 0);
        const hazard = level.hazards?.[0]?.type;
        const hazardNames = { blizzard: '暴风雪', sporePod: '孢子囊', lava: '岩浆潮', shieldPulse: '护盾脉冲', mirror: '镜像复制', coreCycle: '多环境轮换' };
        return `
          <article class="mission-card biome-${level.biome} ${finished ? 'is-complete' : ''} ${unlocked ? '' : 'is-locked'}">
            <div class="mission-topline"><span>${UI.escapeHtml(level.act)}</span>${UI.difficulty(level.difficulty)}</div>
            <div class="mission-number">${String(level.id).padStart(2, '0')}</div>
            <div class="mission-biome-icon">${UI.biomeIcons[level.biome]}</div>
            <h3>${UI.escapeHtml(level.title)}</h3>
            <p class="mission-subtitle">${UI.escapeHtml(level.subtitle)}</p>
            <p class="mission-brief">${UI.escapeHtml(level.briefing)}</p>
            <div class="mission-tags">
              <span>${UI.biomeNames[level.biome]}</span>
              <span>${hazard ? hazardNames[hazard] : '标准战场'}</span>
              ${level.boss ? '<span>Boss战</span>' : ''}
            </div>
            <div class="mission-footer">
              <div>${finished ? UI.stars(stars) : `<span class="mission-time">约 ${Math.ceil(level.duration / 60)} 分钟</span>`}</div>
              <button class="mission-play" data-level-id="${level.id}" ${unlocked ? '' : 'disabled'}>${unlocked ? (finished ? '再次作战' : '开始任务') : '完成前一关'}</button>
            </div>
          </article>`;
      }).join('');

      this.root.innerHTML = `
        <div class="app-shell campaign-shell">
          ${UI.appHeader('campaign', this.save)}
          <main class="content-main">
            <section class="page-hero compact-hero campaign-hero">
              <div><span class="eyebrow">STORY CAMPAIGN</span><h1>天衡失控事件</h1><p>十个关卡，五种环境规则，四场大型Boss战。剧情进度会保存在浏览器本地。</p></div>
              <div class="campaign-progress-card">
                <span>战役完成度</span><strong>${completed}<small>/10</small></strong>
                <div class="thin-progress"><i style="width:${completed * 10}%"></i></div>
                <button class="text-button" data-action="toggle-free-select">${this.freeSelect ? '关闭自由选关' : '原型自由选关'}</button>
              </div>
            </section>
            <section class="campaign-note"><span>◆</span><p><strong>阶段机制：</strong>所有关卡均由1倍费用进入2倍、3倍费用。后期抽牌也会小幅加速，避免费用已经冒烟，手牌却在慢悠悠散步。</p></section>
            <section class="mission-grid">${levelCards}</section>
          </main>
        </div>`;
    }

    startStoryLevel(levelId) {
      const level = RF.LEVELS.find((item) => item.id === levelId);
      if (!level) return;
      const completedSet = new Set(this.refreshSave().campaign.completed.map(Number));
      if (!this.freeSelect && level.id > 1 && !completedSet.has(level.id - 1)) {
        this.toast('需要先完成前一关，或开启“原型自由选关”。', 'warning');
        return;
      }

      const afterIntro = () => {
        if (level.tutorial && !this.save.campaign.seenIntros.includes('tutorial')) {
          this.showTutorialSlides(() => {
            RF.Storage.patch((save) => { if (!save.campaign.seenIntros.includes('tutorial')) save.campaign.seenIntros.push('tutorial'); });
            this.beginBattle(level, { mode: 'campaign', levelId: level.id });
          });
        } else {
          this.beginBattle(level, { mode: 'campaign', levelId: level.id });
        }
      };
      this.showDialogue(level.intro, { eyebrow: `${level.act} · 第${level.id}关`, title: level.title, briefing: level.objective }, afterIntro);
    }

    renderDeckBuilder(resetDraft = false) {
      this.destroyBattle();
      this.closeModal();
      this.currentScreen = 'deck';
      this.refreshSave();
      if (resetDraft) this.deckDraft = RF.Storage.cloneDeck(this.save.deck);

      const counts = this.getDeckCounts(this.deckDraft);
      const total = Object.values(this.deckDraft).reduce((sum, list) => sum + list.length, 0);
      const valid = this.validateDeck(this.deckDraft).valid;
      const groupColumns = RF.GROUPS.map((group) => {
        const list = this.deckDraft[group.id];
        const average = list.length ? list.reduce((sum, id) => sum + RF.CARDS[id].cost, 0) / list.length : 0;
        const slots = Array.from({ length: 10 }, (_, index) => {
          const cardId = list[index];
          if (!cardId) return `<div class="deck-slot is-empty"><span>${index + 1}</span><small>空槽</small></div>`;
          const card = RF.CARDS[cardId];
          return `<button class="deck-slot" data-remove-card="${cardId}" data-group="${group.id}" data-index="${index}" title="点击移除：${UI.escapeHtml(card.desc)}"><span class="slot-cost">${card.cost}</span><b>${UI.escapeHtml(card.icon)}</b><strong>${UI.escapeHtml(card.name)}</strong><small>${UI.typeNames[card.type]}</small></button>`;
        }).join('');
        return `
          <section class="deck-group ${this.activeDeckGroup === group.id ? 'is-active' : ''}" style="--group-color:${group.color}">
            <button class="deck-group-heading" data-deck-group="${group.id}">
              <span>${group.key}</span><div><strong>${group.name}</strong><small>${group.description}</small></div><b>${list.length}/10</b>
            </button>
            <div class="deck-group-stats"><span>平均费用 ${average.toFixed(2)}</span><span>点击卡牌移除</span></div>
            <div class="deck-slots">${slots}</div>
          </section>`;
      }).join('');

      const library = RF.PLAYER_CARD_IDS
        .map((id) => RF.CARDS[id])
        .filter((card) => this.deckFilter === 'all' || card.type === this.deckFilter)
        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'zh-CN'))
        .map((card) => {
          const maxCopies = card.rarity === 'legendary' ? 1 : 2;
          const count = counts[card.id] || 0;
          return UI.cardTile(card, { action: 'add-card', count, disabled: count >= maxCopies });
        }).join('');

      this.root.innerHTML = `
        <div class="app-shell deck-shell">
          ${UI.appHeader('deck', this.save)}
          <main class="content-main deck-main">
            <section class="page-hero compact-hero">
              <div><span class="eyebrow">TACTICAL LOADOUT</span><h1>一副牌库，三十张答案</h1><p>整套30张牌统一混洗并随机抽取。</p></div>
              <div class="deck-summary">
                <span>当前草案</span><strong>${total}<small>/30</small></strong><p>全套平均费用 ${this.calculateDeckAverage(this.deckDraft).toFixed(2)}</p>
                <div class="deck-actions"><button class="secondary-button" data-action="reset-deck">恢复推荐</button><button class="primary-button" data-action="save-deck" ${valid ? '' : 'disabled'}>保存套牌</button></div>
              </div>
            </section>
            <section class="deck-rules">
              <span>同名标准卡最多2张</span><span>传奇卡最多1张</span><span>每组恰好10张</span><span>建议平均费用2.1－3.2</span>
            </section>
            <section class="deck-builder-layout">
              <div class="deck-groups-column">${groupColumns}</div>
              <aside class="card-library">
                <div class="library-heading"><div><span>卡牌库</span><strong>添加到：${RF.GROUPS.find((group) => group.id === this.activeDeckGroup).name}</strong></div>
                  <div class="filter-tabs">
                    <button class="${this.deckFilter === 'all' ? 'is-active' : ''}" data-deck-filter="all">全部</button>
                    <button class="${this.deckFilter === 'unit' ? 'is-active' : ''}" data-deck-filter="unit">小队</button>
                    <button class="${this.deckFilter === 'building' ? 'is-active' : ''}" data-deck-filter="building">建筑</button>
                    <button class="${this.deckFilter === 'spell' ? 'is-active' : ''}" data-deck-filter="spell">战术</button>
                  </div>
                </div>
                <div class="card-library-grid">${library}</div>
              </aside>
            </section>
          </main>
        </div>`;
    }

    getDeckCounts(deck) {
      const counts = {};
      Object.values(deck).flat().forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
      return counts;
    }

    addDeckCard(cardId) {
      const card = RF.CARDS[cardId];
      if (!card || card.enemyOnly) return;
      const group = this.deckDraft[this.activeDeckGroup];
      if (group.length >= 10) {
        this.toast(`${RF.GROUPS.find((item) => item.id === this.activeDeckGroup).name}已经放满10张。`, 'warning');
        return;
      }
      const counts = this.getDeckCounts(this.deckDraft);
      const maxCopies = card.rarity === 'legendary' ? 1 : 2;
      if ((counts[cardId] || 0) >= maxCopies) {
        this.toast(`${card.name}最多携带${maxCopies}张。`, 'warning');
        return;
      }
      group.push(cardId);
      RF.audio.play('card');
      this.renderDeckBuilder(false);
    }

    removeDeckCard(groupId, index) {
      if (!this.deckDraft[groupId] || index < 0 || index >= this.deckDraft[groupId].length) return;
      this.deckDraft[groupId].splice(index, 1);
      RF.audio.play('archive');
      this.renderDeckBuilder(false);
    }

    validateDeck(deck) {
      const errors = [];
      RF.GROUPS.forEach((group) => {
        if (!Array.isArray(deck[group.id]) || deck[group.id].length !== 10) errors.push(`${group.name}需要恰好10张牌。`);
      });
      const counts = this.getDeckCounts(deck);
      Object.entries(counts).forEach(([id, count]) => {
        const card = RF.CARDS[id];
        if (!card || card.enemyOnly) errors.push('套牌中存在无效卡牌。');
        const max = card?.rarity === 'legendary' ? 1 : 2;
        if (count > max) errors.push(`${card?.name || id}超过携带上限。`);
      });
      return { valid: errors.length === 0, errors };
    }

    saveDeck() {
      const result = this.validateDeck(this.deckDraft);
      if (!result.valid) {
        this.toast(result.errors[0], 'warning');
        return;
      }
      RF.Storage.patch((save) => { save.deck = RF.Storage.cloneDeck(this.deckDraft); });
      this.refreshSave();
      this.toast('战术套牌已保存。下一场战斗将使用新编组。', 'success');
      this.renderDeckBuilder(false);
    }

    calculateDeckAverage(deck) {
      const cards = Object.values(deck).flat().map((id) => RF.CARDS[id]).filter(Boolean);
      if (!cards.length) return 0;
      return cards.reduce((sum, card) => sum + card.cost, 0) / cards.length;
    }

    renderRogue() {
      this.destroyBattle();
      this.closeModal();
      this.currentScreen = 'rogue';
      this.refreshSave();
      const run = this.save.rogue;

      if (!run?.active) {
        this.root.innerHTML = `
          <div class="app-shell rogue-shell">
            ${UI.appHeader('rogue', this.save)}
            <main class="content-main">
              <section class="page-hero rogue-intro-hero">
                <div class="rogue-hero-copy"><span class="eyebrow">ROGUELITE EXPEDITION</span><h1>裂界远征</h1><p>连续穿过五个随机生态战区。每战胜利后从三件遗物中选择一件，费用、抽牌、单位、建筑或战术牌会沿着你的选择逐步变形。</p>
                  <div class="hero-actions"><button class="primary-button large" data-action="start-rogue"><span>建立新远征</span><small>使用当前30张套牌</small></button></div>
                </div>
                <div class="rogue-route-preview" aria-hidden="true"><i>1</i><b></b><i>2</i><b></b><i>3</i><b></b><i>4</i><b></b><i class="boss-node">5</i></div>
              </section>
              <section class="rogue-explainer-grid">
                <article><span>01</span><h3>选择生态区</h3><p>每层出现三个随机战区。冰雪控制节奏，丛林制造增援，岩浆切割战线，蜂巢施加护盾，镜界复制你的单位。</p></article>
                <article><span>02</span><h3>赢取遗物</h3><p>遗物只在本轮远征有效。它们提供起始费用、生命、伤害、抽牌、建筑持续时间等明确强化。</p></article>
                <article><span>03</span><h3>第五战Boss</h3><p>最后一个战区会出现对应生态Boss。失败会结束本轮，但不会损失剧情进度或套牌。</p></article>
              </section>
              <section class="relic-gallery">
                <div class="section-heading"><span>RELIC POOL</span><h2>本原型可获得的遗物</h2></div>
                <div class="relic-grid">${RF.ROGUE_RELICS.slice(0, 8).map((relic) => UI.relicCard(relic)).join('')}</div>
              </section>
            </main>
          </div>`;
        return;
      }

      if (!Array.isArray(run.options) || !run.options.length) {
        run.options = this.generateRogueOptions(run.depth);
        RF.Storage.save();
      }
      const relics = run.relics.map((id) => RF.ROGUE_RELICS.find((relic) => relic.id === id)).filter(Boolean);
      const optionCards = run.options.map((option) => {
        const biome = RF.ROGUE_BIOMES.find((item) => item.id === option.biomeId);
        const final = run.depth === run.maxDepth - 1;
        return `
          <button class="encounter-card biome-${biome.id}" data-encounter-id="${UI.escapeHtml(option.id)}">
            <span class="encounter-index">${String(run.depth + 1).padStart(2, '0')}</span>
            <span class="encounter-icon">${biome.icon}</span>
            <small>${final ? '最终Boss战区' : '随机生态战区'}</small>
            <h3>${UI.escapeHtml(option.title)}</h3>
            <p>${UI.escapeHtml(biome.summary)}</p>
            <div class="encounter-modifier"><span>${UI.escapeHtml(option.modifier.name)}</span><p>${UI.escapeHtml(option.modifier.desc)}</p></div>
            <div class="encounter-footer"><span>敌方强度 +${run.depth * 9 + option.modifier.danger}%</span><b>进入战区 →</b></div>
          </button>`;
      }).join('');

      this.root.innerHTML = `
        <div class="app-shell rogue-shell">
          ${UI.appHeader('rogue', this.save)}
          <main class="content-main">
            <section class="run-header">
              <div><span class="eyebrow">ACTIVE EXPEDITION</span><h1>远征第 ${run.depth + 1} / ${run.maxDepth} 战区</h1><p>选择下一处裂界。当前遗物会立即作用于后续所有战斗。</p></div>
              <div class="run-route">${Array.from({ length: run.maxDepth }, (_, index) => `<span class="${index < run.depth ? 'is-done' : index === run.depth ? 'is-current' : ''}">${index + 1}</span>${index < run.maxDepth - 1 ? '<i></i>' : ''}`).join('')}</div>
              <button class="text-button danger" data-action="abandon-rogue">放弃本轮远征</button>
            </section>
            <section class="run-relics-panel">
              <div><span>已获得遗物</span><strong>${relics.length}</strong></div>
              <div class="owned-relics">${relics.length ? relics.map((relic) => `<span title="${UI.escapeHtml(relic.desc)}"><b>${relic.icon}</b>${UI.escapeHtml(relic.name)}</span>`).join('') : '<em>尚未获得遗物，第一件正在战场后面等你。</em>'}</div>
            </section>
            <section class="encounter-selection"><div class="section-heading"><span>SELECT A RIFT</span><h2>${run.depth === run.maxDepth - 1 ? '选择最终Boss战区' : '选择下一处生态裂界'}</h2></div><div class="encounter-grid">${optionCards}</div></section>
          </main>
        </div>`;
    }

    startNewRogue() {
      const run = {
        active: true,
        completed: false,
        depth: 0,
        maxDepth: 5,
        relics: [],
        history: [],
        startedAt: Date.now(),
        options: this.generateRogueOptions(0)
      };
      RF.Storage.patch((save) => { save.rogue = run; });
      this.refreshSave();
      this.renderRogue();
      this.toast('远征已建立。请选择第一处生态裂界。', 'success');
    }

    generateRogueOptions(depth) {
      const biomes = shuffle(RF.ROGUE_BIOMES).slice(0, 3);
      const modifiers = shuffle([
        { id: 'fortified', name: '加固核心', desc: '敌方核心生命值提高15%。', danger: 10, coreMul: 1.15 },
        { id: 'overclocked', name: '过载后勤', desc: '敌方费用恢复速度额外提高8%。', danger: 12, energyMul: 1.08 },
        { id: 'dense_hazard', name: '生态躁动', desc: '环境机制触发间隔缩短18%。', danger: 14, hazardMul: 0.82 },
        { id: 'armored_outposts', name: '装甲前哨', desc: '敌方前哨生命值提高22%。', danger: 9, outpostMul: 1.22 },
        { id: 'elite_wave', name: '精英战群', desc: '敌方单位生命与伤害额外提高7%。', danger: 15, statMul: 1.07 },
        { id: 'calm_before', name: '静默开局', desc: '敌军延迟部署，但进入2倍阶段时立即获得5费。原型中折算为更高后期恢复。', danger: 8, energyMul: 1.05, startDelay: 5 }
      ]);
      return biomes.map((biome, index) => ({
        id: `rift-${Date.now()}-${depth}-${index}-${Math.floor(Math.random() * 10000)}`,
        biomeId: biome.id,
        title: depth === 4 ? `${biome.name}·终极节点` : `${biome.name}·${['前缘', '深层', '回声'][index]}`,
        modifier: modifiers[index]
      }));
    }

    startRogueEncounter(optionId) {
      const run = this.refreshSave().rogue;
      if (!run?.active) return;
      const option = run.options.find((item) => item.id === optionId);
      if (!option) return;
      const config = this.buildRogueConfig(run, option);
      this.beginBattle(config, { mode: 'rogue', optionId, option, depth: run.depth });
    }

    buildRogueConfig(run, option) {
      const biome = RF.ROGUE_BIOMES.find((item) => item.id === option.biomeId);
      const depth = run.depth;
      const modifier = option.modifier || {};
      const scalar = 1 + depth * 0.09;
      const bossMap = { ice: 'boss_frost_giant', jungle: 'boss_bloom_mother', magma: 'boss_magma_colossus', steel: 'boss_hive_mind', mirror: 'boss_core_avatar' };
      const hazard = { ...biome.hazard, every: Number(biome.hazard.every || 25) * Number(modifier.hazardMul || 1) };
      const final = depth === run.maxDepth - 1;
      const mapPool = Array.isArray(biome.maps) && biome.maps.length ? biome.maps : ['dock_delta'];
      const mapId = mapPool[Math.floor(Math.random() * mapPool.length)];
      return {
        id: `rogue-${option.id}`,
        act: '裂界远征',
        title: option.title,
        subtitle: biome.summary,
        biome: biome.id,
        mapId,
        duration: 165 + depth * 14 + (final ? 24 : 0),
        difficulty: Math.min(10, depth * 2 + 2),
        briefing: biome.summary,
        objective: final ? '击破生态Boss并摧毁敌方核心。' : '穿过随机生态战区，赢取一件远征遗物。',
        enemyDeck: [...biome.deck, ...biome.deck.slice(0, 3)],
        stages: RF.LEVELS[0].stages,
        enemyCoreHp: Math.round((1280 + depth * 220) * Number(modifier.coreMul || 1)),
        enemyOutpostHp: Math.round((390 + depth * 48) * Number(modifier.outpostMul || 1)),
        playerCoreHp: 1950,
        playerOutpostHp: 480,
        ai: {
          thinkMin: Math.max(1.35, 2.15 - depth * 0.13),
          thinkMax: Math.max(2.1, 3.2 - depth * 0.15),
          startDelay: 6 + Number(modifier.startDelay || 0),
          energyMul: (0.98 + depth * 0.035) * Number(modifier.energyMul || 1),
          hpMul: scalar * Number(modifier.statMul || 1),
          damageMul: (0.96 + depth * 0.045) * Number(modifier.statMul || 1),
          aggression: 0.54 + depth * 0.055
        },
        hazards: [hazard],
        boss: final ? { cardId: bossMap[biome.id], atRatio: 0.5, lane: 'weaker', announcement: `${biome.name}的守门者进入战场` } : null
      };
    }

    aggregateRogueMods(run) {
      const mods = {};
      (run.relics || []).forEach((id) => {
        const relic = RF.ROGUE_RELICS.find((item) => item.id === id);
        if (!relic) return;
        Object.entries(relic.mods).forEach(([key, value]) => { mods[key] = Number(mods[key] || 0) + Number(value || 0); });
      });
      return mods;
    }

    confirmAbandonRogue() {
      this.showConfirm('放弃本轮远征？', '当前获得的遗物会消失，但剧情进度、套牌与统计不会受影响。', () => {
        RF.Storage.patch((save) => {
          if (save.rogue) {
            save.rogue.active = false;
            save.rogue.abandoned = true;
          }
        });
        this.renderRogue();
        this.toast('本轮远征已结束。', 'info');
      });
    }

    renderGuide() {
      this.destroyBattle();
      this.closeModal();
      this.currentScreen = 'guide';
      this.refreshSave();
      this.root.innerHTML = `
        <div class="app-shell guide-shell">
          ${UI.appHeader('guide', this.save)}
          <main class="content-main guide-main">
            <section class="page-hero compact-hero"><div><span class="eyebrow">FIELD MANUAL</span><h1>作战手册</h1><p>这里收录原型中的完整操作、费用节奏、补给循环与环境规则。</p></div><div class="guide-keyboard"><kbd>1</kbd><span>至</span><kbd>0</kbd><span>选择手牌</span><kbd>R</kbd><span>归档</span><kbd>Space</kbd><span>暂停</span></div></section>
            <section class="guide-grid">
              <article class="guide-card wide"><span class="guide-number">01</span><h2>核心战斗循环</h2><div class="guide-flow"><div><b>抽牌</b><p>基础每5.6秒抽1张，手牌上限10。手牌满时抽牌暂停，不会烧牌。</p></div><i>→</i><div><b>随机抽牌</b><p>所有牌在同一副牌库中混洗。你需要根据当前手牌和战况临场组织组合。</p></div><i>→</i><div><b>部署</b><p>把卡牌拖入己方宽战区，或先点卡再点落点。单位会汇入最近通路并自动交战。</p></div><i>→</i><div><b>突破</b><p>摧毁某条通路的前哨后，对应前沿投送带会向中区伸展。</p></div></div></article>
              <article class="guide-card"><span class="guide-number">02</span><h2>费用与阶段</h2><ul><li><strong>侦察期：</strong>每2.8秒恢复1费。</li><li><strong>战线升温：</strong>恢复速度变为2倍。</li><li><strong>超载决战：</strong>恢复速度变为3倍。</li><li>费用连续回复，最高默认10点。</li></ul></article>
              <article class="guide-card"><span class="guide-number">03</span><h2>归档与再补给</h2><ul><li>右键手牌或选择后按R，可以消耗1次归档。</li><li>被归档的牌本轮不再出现，直到全军补给。</li><li>整副牌库抽空后，8.4秒后将已使用和归档的牌重新洗入。</li><li>归档默认最多储存2次，每11.2秒恢复1次。</li></ul></article>
              <article class="guide-card"><span class="guide-number">04</span><h2>部署规则</h2><ul><li>小队与建筑只能部署在蓝色区域。</li><li>同时最多维持3座友方建筑。</li><li>战术牌按目标类型指定友军或敌军区域。</li><li>摧毁敌方前哨会扩大对应线路的部署范围。</li></ul></article>
              <article class="guide-card"><span class="guide-number">05</span><h2>键盘操作</h2><div class="key-list"><span><kbd>1－0</kbd>选择第1至10张手牌</span><span><kbd>R</kbd>归档所选卡牌</span><span><kbd>Space</kbd>暂停或继续</span><span><kbd>Esc</kbd>退出战斗</span></div></article>
              <article class="guide-card wide"><span class="guide-number">06</span><h2>环境机制</h2><div class="biome-manual"><div class="ice"><b>❄ 永冬</b><p>暴风雪会降低整条战线的移动与攻击速度。蓝色区域会提前预警。</p></div><div class="jungle"><b>✤ 丛林</b><p>孢子囊会在中央萌发。若未及时摧毁，会孵化两批伏击者。</p></div><div class="magma"><b>♨ 熔狱</b><p>橙色裂纹随后会喷发岩浆，持续伤害其中的单位。</p></div><div class="steel"><b>⌬ 蜂巢</b><p>周期性护盾脉冲保护敌军，应避开护盾峰值释放高伤害战术。</p></div><div class="mirror"><b>◐ 镜界</b><p>你部署的部分单位会在5秒后于另一条路生成敌方镜像。</p></div></div></article>
              <article class="guide-card wide"><span class="guide-number">07</span><h2>原型说明</h2><p>本作是纯前端离线Demo，使用浏览器 localStorage 保存进度。没有服务器、付费数值或联网PVP。刷新页面不会丢失正常保存的数据，但清理浏览器站点数据会重置存档。</p><p>战斗速度按钮仅用于PVE试玩，支持1×、1.5×与2×。</p></article>
            </section>
          </main>
        </div>`;
    }

    beginBattle(config, context) {
      this.closeModal();
      this.destroyBattle();
      this.currentScreen = 'battle';
      this.battleContext = context;
      this.lastBattleConfig = config;
      this.currentResult = null;
      this.lastHandSignature = '';
      this.battleEventLog = [];
      const speed = Number(this.refreshSave().settings.battleSpeed || 1);
      const playerMods = context.mode === 'rogue'
        ? this.aggregateRogueMods(this.save.rogue)
        : { startEnergy: this.save.campaign.completed.includes(7) ? 1 : 0 };

      this.root.innerHTML = this.battleTemplate(config);
      const canvas = document.getElementById('battle-canvas');
      this.battle = new RF.BattleEngine(canvas, config, {
        deck: this.save.deck,
        playerMods,
        speed,
        isRogue: context.mode === 'rogue',
        modeLabel: context.mode === 'rogue' ? `裂界远征 · 第${context.depth + 1}战区` : `剧情战役 · 第${context.levelId}关`,
        onState: (state, force) => this.updateBattleHud(state, force),
        onEvent: (event) => this.handleBattleEvent(event),
        onEnd: (result) => this.handleBattleEnd(result)
      });
      this.battle.start();
    }

    battleTemplate(config) {
      const map = RF.MAPS?.[config.mapId] || RF.MAPS?.dock_delta || { name: '未知战区', summary: '', routes: [{ name: '通路' }] };
      const outpostDots = (map.routes || []).map((route, index) => `<i title="${UI.escapeHtml(route.name || `第${index + 1}通路`)}前哨"></i>`).join('');
      const routeNames = (map.routes || []).map((route) => route.name).filter(Boolean).join(' / ');
      return `
        <div class="battle-screen biome-${config.biome}">
          <header class="battle-topbar">
            <button class="battle-icon-button" data-action="battle-leave" title="退出战斗">←</button>
            <div class="core-hud player-core-hud"><div class="core-label"><span>我方核心</span><b id="player-core-text">100%</b></div><div class="core-bar"><i id="player-core-fill"></i></div><div class="outpost-dots" id="player-outposts">${outpostDots}</div></div>
            <div class="battle-title-block"><small>${UI.escapeHtml(config.act || 'PVE')}</small><strong>${UI.escapeHtml(config.title)}</strong><span id="battle-timer">${UI.formatDuration(config.duration)}</span></div>
            <div class="core-hud enemy-core-hud"><div class="core-label"><b id="enemy-core-text">100%</b><span>敌方核心</span></div><div class="core-bar"><i id="enemy-core-fill"></i></div><div class="outpost-dots enemy" id="enemy-outposts">${outpostDots}</div></div>
            <button class="battle-icon-button" data-action="battle-pause" id="pause-button" title="暂停（空格）">Ⅱ</button>
          </header>

          <div class="stage-timeline">
            <div class="stage-progress-line"><i id="battle-time-progress"></i></div>
            ${(config.stages || RF.LEVELS[0].stages).map((stage, index) => `<div class="stage-node ${index === 0 ? 'is-active' : ''}" data-stage-node="${index}" style="left:${stage.at * 100}%"><span>${stage.short}</span><small>${stage.name}</small></div>`).join('')}
            <div class="stage-current"><span id="stage-name">侦察期</span><b id="stage-rate">1×费用</b></div>
          </div>

          <main class="battle-layout">
            <aside class="supply-sidebar">
              <div class="sidebar-heading"><span>随机战术牌库</span><small>从整套牌库自然抽牌</small></div>
              <div class="supply-buttons">
                ${RF.GROUPS.map((group) => `<button class="supply-button ${group.id === 'vanguard' ? 'is-active' : ''}" data-supply="${group.id}" style="--group-color:${group.color}"><kbd>${group.key}</kbd><span><strong>${group.short}</strong><small>${group.description}</small></span><b data-role="pile-${group.id}">8</b></button>`).join('')}
              </div>
              <div class="draw-module">
                <div class="progress-ring" id="draw-ring" style="--progress:0"><span>补给</span><b id="draw-text">5.6s</b></div>
                <p id="resupply-text">手牌未满时持续抽牌</p>
              </div>
              <button class="archive-button" data-action="archive-selected" id="archive-button"><span>▤</span><div><strong>归档所选</strong><small>右键手牌 / R</small></div><b id="archive-charges">2/2</b></button>
            </aside>

            <section class="battlefield-column">
              <div class="battlefield-frame" data-map-name="${UI.escapeHtml(map.name)}">
                <canvas id="battle-canvas" width="1280" height="720" aria-label="${UI.escapeHtml(map.name)}宽区域实时战场，包含${(map.routes || []).length}条中央通路"></canvas>
                <div class="battlefield-chrome" aria-hidden="true">
                  <span class="is-friendly">ALLY // 部署区</span>
                  <span class="is-contested">CONTESTED · ${(map.routes || []).length} ROUTES</span>
                  <span class="is-hostile">HOSTILE // 敌占区</span>
                </div>
                <div class="battle-banner-stack" id="battle-banner-stack" aria-live="polite"></div>
                <div class="tutorial-checklist" id="tutorial-checklist" hidden></div>
                <div class="battlefield-help">把手牌拖到蓝色战区，或先选牌再点击 · 落点将汇入最近通路</div>
              </div>
            </section>

            <aside class="intel-sidebar">
              <div class="objective-panel"><span>当前目标</span><strong>${UI.escapeHtml(config.objective || '摧毁敌方核心')}</strong><p>${UI.escapeHtml(config.briefing || '')}</p><div class="battle-map-meta"><b>${UI.escapeHtml(map.name)}</b><small>${(map.routes || []).length}条通路 · ${UI.escapeHtml(routeNames || '动态战线')}</small><em>${UI.escapeHtml(map.summary || '己方战区可自由选择落点。')}</em></div></div>
              <div class="selected-card-panel" id="selected-card-panel"><span>所选协议</span><strong>尚未选择卡牌</strong><p>直接拖动手牌到战场，或按数字键后点击落点。</p></div>
              <div class="event-log-panel"><span>战场通讯</span><div id="battle-event-log"><p>战术链路已建立。</p></div></div>
              <div class="battle-controls"><button data-action="battle-speed" id="speed-button">速度 1×</button><button data-action="battle-pause" id="pause-button-side">暂停</button></div>
            </aside>
          </main>

          <footer class="battle-handbar">
            <div class="energy-module"><div class="energy-orb"><span id="energy-value">5.0</span><small>/ <b id="energy-max">10</b></small></div><div><strong>战术费用</strong><div class="energy-bar"><i id="energy-fill"></i></div><small id="energy-rate-copy">每2.8秒恢复1费</small></div></div>
            <div class="hand-container" id="hand-container"></div>
          </footer>
        </div>`;
    }

    updateBattleHud(state) {
      if (!this.battle || this.currentScreen !== 'battle') return;
      this.setText('battle-timer', state.timeText);
      this.setText('stage-name', state.stage.name);
      this.setText('stage-rate', `${state.stage.short}费用`);
      this.setText('energy-value', state.energy.toFixed(1));
      this.setText('energy-max', state.maxEnergy);
      this.setText('energy-rate-copy', state.stage.note || `费用恢复 ${state.stage.energyMultiplier}×`);
      this.setStyleWidth('energy-fill', `${state.energy / state.maxEnergy * 100}%`);
      this.setStyleWidth('battle-time-progress', `${state.elapsed / state.duration * 100}%`);

      const playerCoreRatio = state.playerCore.hp / state.playerCore.maxHp;
      const enemyCoreRatio = state.enemyCore.hp / state.enemyCore.maxHp;
      this.setStyleWidth('player-core-fill', `${playerCoreRatio * 100}%`);
      this.setStyleWidth('enemy-core-fill', `${enemyCoreRatio * 100}%`);
      this.setText('player-core-text', `${Math.ceil(playerCoreRatio * 100)}%`);
      this.setText('enemy-core-text', `${Math.ceil(enemyCoreRatio * 100)}%`);

      document.querySelectorAll('[data-stage-node]').forEach((node) => {
        const index = Number(node.dataset.stageNode);
        node.classList.toggle('is-active', index === state.stageIndex);
        node.classList.toggle('is-past', index < state.stageIndex);
      });

      state.groups.forEach((group) => {
        const button = document.querySelector(`[data-supply="${group.id}"]`);
        if (button) {
          button.classList.toggle('is-active', group.active);
          button.classList.toggle('is-empty', group.pile === 0);
        }
        this.setText(`pile-${group.id}`, group.pile, true);
      });

      const ring = document.getElementById('draw-ring');
      if (ring) ring.style.setProperty('--progress', state.drawProgress);
      if (state.resupplyTimer > 0) {
        this.setText('draw-text', `${state.resupplyTimer.toFixed(1)}s`);
        this.setText('resupply-text', '全军补给重组中');
      } else if (state.drawPaused) {
        this.setText('draw-text', '暂停');
        this.setText('resupply-text', '手牌已满，不会烧牌');
      } else {
        this.setText('draw-text', `${Math.max(0, 100 - state.drawProgress * 100).toFixed(0)}%`);
        this.setText('resupply-text', '当前频道自动抽牌');
      }

      this.setText('archive-charges', `${state.archiveCharges}/${state.archiveMax}`);
      const archiveButton = document.getElementById('archive-button');
      if (archiveButton) archiveButton.disabled = state.archiveCharges <= 0 || state.selectedIndex == null;
      this.setText('speed-button', `速度 ${state.speed}×`);
      this.setText('pause-button', state.paused ? '▶' : 'Ⅱ');
      this.setText('pause-button-side', state.paused ? '继续' : '暂停');

      this.updateOutpostDots('player-outposts', state.playerOutposts);
      this.updateOutpostDots('enemy-outposts', state.enemyOutposts);
      this.updateHand(state);
      this.updateTutorial(state.tutorialGoals);
    }

    updateHand(state) {
      const signature = state.hand.map((item) => `${item.uid}:${item.effectiveCost}:${state.energy >= item.effectiveCost ? 1 : 0}`).join('|') + `#${state.selectedIndex}`;
      if (signature === this.lastHandSignature) return;
      this.lastHandSignature = signature;
      const container = document.getElementById('hand-container');
      if (!container) return;
      container.innerHTML = state.hand.map((item) => UI.handCard(item, item.index === state.selectedIndex, state.energy + 0.001 >= item.effectiveCost)).join('') || '<div class="empty-hand"><span>抽牌途中</span><small>等待整副牌库补入下一张牌。</small></div>';

      const panel = document.getElementById('selected-card-panel');
      if (!panel) return;
      const selected = state.selectedIndex == null ? null : state.hand.find((item) => item.index === state.selectedIndex);
      if (!selected) {
        panel.innerHTML = '<span>所选协议</span><strong>尚未选择卡牌</strong><p>直接拖动手牌到战场，或按数字键后点击落点。</p>';
      } else {
        panel.innerHTML = `<span>${UI.typeNames[selected.card.type]} · ${selected.effectiveCost}费</span><strong>${UI.escapeHtml(selected.card.icon)} ${UI.escapeHtml(selected.card.name)}</strong><p>${UI.escapeHtml(selected.card.desc)}</p>`;
      }
    }

    updateTutorial(goals) {
      const box = document.getElementById('tutorial-checklist');
      if (!box) return;
      if (!goals) {
        box.hidden = true;
        return;
      }
      box.hidden = false;
      const items = [
        ['playedUnit', '部署一支小队或建筑'],
        ['switchedSupply', '完成单一牌库初始化'],
        ['playedSpell', '使用一张战术牌'],
        ['destroyedOutpost', '摧毁任意敌方前哨']
      ];
      box.innerHTML = `<span>实战训练</span>${items.map(([key, label]) => `<p class="${goals[key] ? 'is-done' : ''}"><i>${goals[key] ? '✓' : '○'}</i>${label}</p>`).join('')}`;
    }

    updateOutpostDots(id, outposts) {
      const parent = document.getElementById(id);
      if (!parent) return;
      if (parent.children.length !== outposts.length) parent.innerHTML = outposts.map(() => '<i></i>').join('');
      [...parent.children].forEach((dot, index) => {
        const outpost = outposts[index];
        const routeName = outpost?.routeName || `第${index + 1}通路`;
        dot.classList.toggle('is-destroyed', !outpost?.alive);
        dot.title = outpost?.alive
          ? `${routeName}前哨：${Math.ceil(outpost.hp / outpost.maxHp * 100)}%`
          : `${routeName}前哨已摧毁`;
      });
    }

    handleBattleEvent(event) {
      if (!this.battle) return;
      const loggable = !['cardPlayed', 'archiveReady', 'supply'].includes(event.type);
      if (loggable && (event.title || event.text)) this.addBattleLog(event.title || event.text);
      switch (event.type) {
        case 'stage': this.showBattleBanner(event.stage.name, event.stage.note, 'stage', 3200); break;
        case 'warning': this.showBattleBanner(event.title, event.text, `warning ${event.hazard || ''}`, 3000); break;
        case 'boss': this.showBattleBanner(event.title, '大型敌对目标已进入战线', 'boss', 3800); break;
        case 'bossDefeated': this.showBattleBanner(event.title, event.text, 'success', 3000); break;
        case 'outpost': this.showBattleBanner(event.title, event.text, event.side === 'enemy' ? 'success' : 'danger', 2600); break;
        case 'resupply': this.showBattleBanner('牌库重洗启动', `${event.duration}秒后将已使用和归档卡牌洗回整副牌库。`, 'info', 2600); break;
        case 'resupplyComplete': this.showBattleBanner('牌库重洗完成', '已使用与归档的卡牌重新进入整副牌库。', 'success', 2200); break;
        case 'tutorialComplete': this.showBattleBanner(event.title, event.text, 'success', 4200); break;
        case 'autoSupply': this.toast('整副牌库已切换至可抽取状态。', 'info'); break;
        case 'invalid': this.toast(event.text, 'warning'); break;
        default: break;
      }
    }

    addBattleLog(text) {
      if (!text) return;
      this.battleEventLog.unshift(text);
      this.battleEventLog = this.battleEventLog.slice(0, 4);
      const log = document.getElementById('battle-event-log');
      if (log) log.innerHTML = this.battleEventLog.map((item) => `<p>${UI.escapeHtml(item)}</p>`).join('');
    }

    showBattleBanner(title, text, type = 'info', duration = 2800) {
      const stack = document.getElementById('battle-banner-stack');
      if (!stack) return;
      const banner = document.createElement('div');
      banner.className = `battle-banner ${type}`;
      banner.innerHTML = `<strong>${UI.escapeHtml(title)}</strong><span>${UI.escapeHtml(text || '')}</span>`;
      stack.appendChild(banner);
      requestAnimationFrame(() => banner.classList.add('is-visible'));
      setTimeout(() => {
        banner.classList.remove('is-visible');
        setTimeout(() => banner.remove(), 350);
      }, duration);
    }

    handleBattleEnd(result) {
      this.currentResult = result;
      RF.Storage.patch((save) => {
        save.stats.battles = Number(save.stats.battles || 0) + 1;
        save.stats.cardsPlayed = Number(save.stats.cardsPlayed || 0) + result.stats.cardsPlayed;
        save.stats.unitsDeployed = Number(save.stats.unitsDeployed || 0) + result.stats.unitsDeployed;
        if (result.victory) save.stats.victories = Number(save.stats.victories || 0) + 1;
        if (this.battleContext.mode === 'campaign' && result.victory) {
          const id = this.battleContext.levelId;
          if (!save.campaign.completed.includes(id)) save.campaign.completed.push(id);
          save.campaign.completed.sort((a, b) => a - b);
          save.campaign.stars[id] = Math.max(Number(save.campaign.stars[id] || 0), result.stars);
          const previous = Number(save.campaign.bestTimes[id] || Infinity);
          save.campaign.bestTimes[id] = Math.min(previous, result.elapsed);
          if (id === RF.LEVELS.length) save.campaign.campaignComplete = true;
        }
      });
      this.refreshSave();
      this.showResultModal(result);
    }

    showResultModal(result) {
      const context = this.battleContext;
      const isCampaign = context.mode === 'campaign';
      const level = isCampaign ? RF.LEVELS.find((item) => item.id === context.levelId) : null;
      const title = result.victory ? '战线突破' : '指挥链中断';
      const primaryLabel = result.victory
        ? (isCampaign ? '继续剧情' : '领取遗物')
        : (isCampaign ? '重新部署' : '结束本轮远征');
      const reward = result.victory && level?.reward ? `<div class="result-reward"><span>${UI.escapeHtml(level.reward.title)}</span><p>${UI.escapeHtml(level.reward.text)}</p></div>` : '';
      this.openModal(`
        <div class="modal-card result-modal ${result.victory ? 'victory' : 'defeat'}">
          <div class="result-emblem">${result.victory ? '◇' : '×'}</div>
          <span class="eyebrow">${result.victory ? 'MISSION COMPLETE' : 'MISSION FAILED'}</span>
          <h2>${title}</h2>
          <p class="result-reason">${UI.escapeHtml(result.reason)}</p>
          ${result.victory && isCampaign ? UI.stars(result.stars) : ''}
          <div class="result-stats">
            <div><span>战斗用时</span><strong>${UI.formatDuration(result.elapsed)}</strong></div>
            <div><span>核心完整度</span><strong>${Math.ceil(result.coreRatio * 100)}%</strong></div>
            <div><span>使用卡牌</span><strong>${result.stats.cardsPlayed}</strong></div>
            <div><span>造成伤害</span><strong>${Math.round(result.stats.damageDealt)}</strong></div>
          </div>
          ${reward}
          <div class="modal-actions">
            <button class="primary-button" data-modal-action="result-primary">${primaryLabel}</button>
            ${result.victory ? '<button class="secondary-button" data-modal-action="result-retry">再次作战</button>' : ''}
            <button class="ghost-button" data-modal-action="result-back">返回${isCampaign ? '战役地图' : '远征界面'}</button>
          </div>
        </div>`, false);
    }

    handleResultPrimary() {
      if (!this.currentResult) return;
      if (!this.currentResult.victory) {
        if (this.battleContext.mode === 'rogue') this.processRogueDefeat();
        else this.retryBattle();
        return;
      }
      if (this.battleContext.mode === 'campaign') {
        const level = RF.LEVELS.find((item) => item.id === this.battleContext.levelId);
        this.closeModal();
        this.destroyBattle();
        this.renderCampaign();
        this.showDialogue(level.outro, { eyebrow: '任务后续', title: level.title }, () => this.renderCampaign());
      } else {
        this.closeModal();
        this.processRogueVictory();
      }
    }

    retryBattle() {
      const config = this.lastBattleConfig;
      const context = { ...this.battleContext };
      this.closeModal();
      this.destroyBattle();
      this.beginBattle(config, context);
    }

    exitBattleToMode() {
      const mode = this.battleContext?.mode;
      const defeatedRogue = mode === 'rogue' && this.currentResult && !this.currentResult.victory;
      this.closeModal();
      if (defeatedRogue) {
        this.processRogueDefeat();
        return;
      }
      this.destroyBattle();
      if (mode === 'rogue') this.renderRogue(); else this.renderCampaign();
    }

    requestLeaveBattle() {
      if (!this.battle) return;
      if (!this.battle.paused) this.battle.togglePause();
      this.showConfirm('撤离当前战斗？', '本场战斗不会计为胜利。剧情和远征进度保持在进入战斗前的状态。', () => this.exitBattleToMode());
    }

    processRogueVictory() {
      const run = this.refreshSave().rogue;
      if (!run?.active) {
        this.exitBattleToMode();
        return;
      }
      this.destroyBattle();
      run.history.push({ depth: run.depth, optionId: this.battleContext.optionId, victory: true, at: Date.now() });
      if (run.depth >= run.maxDepth - 1) {
        run.active = false;
        run.completed = true;
        run.completedAt = Date.now();
        RF.Storage.patch((save) => { save.stats.rogueWins = Number(save.stats.rogueWins || 0) + 1; });
        RF.Storage.save();
        this.renderRogue();
        this.openModal(`
          <div class="modal-card rogue-complete-modal">
            <div class="result-emblem">⌁</div><span class="eyebrow">EXPEDITION COMPLETE</span><h2>裂界远征完成</h2>
            <p>你穿过了五个随机战区，并带着${run.relics.length}件遗物击破最终节点。本轮遗物已经归档为战绩，不会带入下一轮。</p>
            <div class="owned-relics centered">${run.relics.map((id) => { const relic = RF.ROGUE_RELICS.find((item) => item.id === id); return relic ? `<span><b>${relic.icon}</b>${UI.escapeHtml(relic.name)}</span>` : ''; }).join('')}</div>
            <div class="modal-actions"><button class="primary-button" data-modal-action="rogue-complete-close">返回远征界面</button></div>
          </div>`, false);
        return;
      }

      RF.Storage.save();
      const owned = new Set(run.relics);
      this.rogueRewardChoices = shuffle(RF.ROGUE_RELICS.filter((relic) => !owned.has(relic.id))).slice(0, 3);
      this.rogueRelicSelected = false;
      this.handDrag = null;
      this.suppressHandClickUntil = 0;
      this.renderRogueBackgroundForReward();
      this.openModal(`
        <div class="modal-card relic-choice-modal">
          <span class="eyebrow">CHOOSE A RELIC</span><h2>从战场残骸中选择一件遗物</h2><p>遗物会在本轮远征的后续战斗中立即生效。</p>
          <div class="relic-choice-grid">${this.rogueRewardChoices.map((relic) => `
            <button class="relic-card rarity-${UI.escapeHtml(relic.rarity)}" data-modal-action="select-relic" data-relic-id="${UI.escapeHtml(relic.id)}">
              <span class="relic-icon">${UI.escapeHtml(relic.icon)}</span>
              <span class="relic-copy"><strong>${UI.escapeHtml(relic.name)}</strong><small>${UI.escapeHtml(UI.rarityNames[relic.rarity] || relic.rarity)}</small><p>${UI.escapeHtml(relic.desc)}</p></span>
            </button>`).join('')}</div>
        </div>`, false);
    }

    renderRogueBackgroundForReward() {
      this.currentScreen = 'rogue';
      this.root.innerHTML = `<div class="reward-backdrop-screen"><div class="reward-backdrop-core">⌁</div><h1>战区已清理</h1><p>正在扫描可回收协议……</p></div>`;
    }

    selectRogueRelic(relicId) {
      if (this.rogueRelicSelected) return;
      const relic = this.rogueRewardChoices.find((item) => item.id === relicId);
      const run = this.refreshSave().rogue;
      if (!relic || !run?.active) return;
      this.rogueRelicSelected = true;
      run.relics.push(relic.id);
      run.depth += 1;
      run.options = this.generateRogueOptions(run.depth);
      RF.Storage.save();
      this.closeModal();
      this.renderRogue();
      this.toast(`获得遗物：${relic.name}`, 'success');
    }

    processRogueDefeat() {
      const run = this.refreshSave().rogue;
      if (run) {
        run.active = false;
        run.completed = false;
        run.failedAt = run.depth + 1;
        run.history.push({ depth: run.depth, optionId: this.battleContext.optionId, victory: false, at: Date.now() });
        RF.Storage.save();
      }
      this.destroyBattle();
      this.renderRogue();
    }

    showDialogue(lines, meta, onFinish) {
      if (!Array.isArray(lines) || !lines.length) {
        onFinish?.();
        return;
      }
      this.dialogueState = { lines, meta: meta || {}, index: 0, onFinish };
      this.renderDialogueModal();
    }

    renderDialogueModal() {
      const state = this.dialogueState;
      if (!state) return;
      const line = state.lines[state.index];
      const last = state.index === state.lines.length - 1;
      this.openModal(`
        <div class="modal-card dialogue-modal">
          <div class="dialogue-header"><span>${UI.escapeHtml(state.meta.eyebrow || 'STORY TRANSMISSION')}</span><strong>${UI.escapeHtml(state.meta.title || '')}</strong></div>
          <div class="dialogue-body">
            <div class="dialogue-portrait"><span>${UI.escapeHtml(line.portrait || '◆')}</span><i></i></div>
            <div class="dialogue-copy"><small>${UI.escapeHtml(line.speaker || '通讯')}</small><p>${UI.escapeHtml(line.text)}</p>${state.index === 0 && state.meta.briefing ? `<div class="dialogue-briefing"><b>任务目标</b><span>${UI.escapeHtml(state.meta.briefing)}</span></div>` : ''}</div>
          </div>
          <div class="dialogue-footer"><span>${state.index + 1} / ${state.lines.length}</span><div class="dialogue-dots">${state.lines.map((_, index) => `<i class="${index <= state.index ? 'is-active' : ''}"></i>`).join('')}</div><button class="ghost-button" data-modal-action="dialogue-skip">跳过</button><button class="primary-button" data-modal-action="dialogue-next">${last ? '进入下一步' : '继续'}</button></div>
        </div>`, false);
    }

    advanceDialogue(skip) {
      const state = this.dialogueState;
      if (!state) return;
      if (skip || state.index >= state.lines.length - 1) {
        const done = state.onFinish;
        this.dialogueState = null;
        this.closeModal();
        done?.();
      } else {
        state.index += 1;
        this.renderDialogueModal();
      }
    }

    showTutorialSlides(onFinish) {
      this.tutorialState = {
        index: 0,
        onFinish,
        slides: [
          { icon: '◴', title: '战场心跳', eyebrow: '01 · 费用', html: '<p>费用默认每<strong>2.8秒</strong>恢复1点。战斗进入中后期后，恢复速度会依次提高到<strong>2倍</strong>和<strong>3倍</strong>。</p><div class="tutorial-phase-mini"><span>1×</span><i>→</i><span>2×</span><i>→</i><span>3×</span></div>' },
          { icon: '▤', title: '整副牌库随机抽取', eyebrow: '02 · 抽牌', html: '<p>你的30张牌全部放在同一副牌库中混洗。基础每<strong>5.6秒</strong>自然抽1张，手牌上限为10；牌库抽空后会在8.4秒内重洗。</p><div class="tutorial-supply-mini"><span>单位</span><span>建筑</span><span>战术</span></div>' },
          { icon: '➤', title: '拖动部署', eyebrow: '03 · 宽战区', html: '<p>直接把下方手牌拖到战场中的蓝色区域，也可以先点击手牌再选择落点。己方半场可大范围部署，小队会自动汇入最近的桥梁、峡口或道路，穿过中区后还能横向接敌。摧毁敌方前哨后，对应前沿投送带会向前扩张。</p><div class="tutorial-lane-mini"><b>我方</b><i></i><i></i><strong>敌方</strong></div>' },
          { icon: '▤', title: '归档死牌', eyebrow: '04 · 手牌', html: '<p>手牌上限为10，满手时抽牌暂停而不会烧牌。右键一张手牌或按 <kbd>R</kbd> 可以归档它，等下次全军补给时再洗回来。</p><p class="tutorial-tip">第一关会在战场上显示四个实战训练目标。</p>' }
        ]
      };
      this.renderTutorialModal();
    }

    renderTutorialModal() {
      const state = this.tutorialState;
      if (!state) return;
      const slide = state.slides[state.index];
      const last = state.index === state.slides.length - 1;
      this.openModal(`
        <div class="modal-card tutorial-modal">
          <div class="tutorial-visual"><span>${slide.icon}</span><i></i><i></i></div>
          <div class="tutorial-copy"><small>${slide.eyebrow}</small><h2>${slide.title}</h2>${slide.html}</div>
          <div class="tutorial-footer"><div class="dialogue-dots">${state.slides.map((_, index) => `<i class="${index <= state.index ? 'is-active' : ''}"></i>`).join('')}</div><button class="ghost-button" data-modal-action="tutorial-skip">跳过教程</button><button class="primary-button" data-modal-action="tutorial-next">${last ? '开始实战' : '下一页'}</button></div>
        </div>`, false);
    }

    advanceTutorial(skip) {
      const state = this.tutorialState;
      if (!state) return;
      if (skip || state.index >= state.slides.length - 1) {
        const done = state.onFinish;
        this.tutorialState = null;
        this.closeModal();
        done?.();
      } else {
        state.index += 1;
        this.renderTutorialModal();
      }
    }

    showSettings() {
      this.refreshSave();
      const code = RF.Storage.exportSave();
      this.openModal(`
        <div class="modal-card settings-modal">
          <div class="modal-heading"><span class="eyebrow">SYSTEM</span><h2>设置与存档</h2><button class="modal-close" data-modal-action="close">×</button></div>
          <div class="settings-list">
            <button class="setting-row" data-action="toggle-sound"><div><strong>音效</strong><small>使用浏览器 WebAudio 生成，不含外部音频文件。</small></div><span class="toggle ${this.save.settings.sound ? 'is-on' : ''}"><i></i></span></button>
            <button class="setting-row" data-action="toggle-motion"><div><strong>减少动态效果</strong><small>降低菜单动画和过渡效果。</small></div><span class="toggle ${this.save.settings.reducedMotion ? 'is-on' : ''}"><i></i></span></button>
          </div>
          <div class="save-code-panel"><label for="save-code">存档码</label><textarea id="save-code" spellcheck="false">${UI.escapeHtml(code)}</textarea><div><button class="secondary-button" data-action="copy-save">复制存档码</button><button class="secondary-button" data-action="import-save">导入文本框内容</button></div></div>
          <div class="danger-zone"><div><strong>重置全部进度</strong><small>清除剧情、套牌、远征与统计。</small></div><button class="danger-button" data-action="reset-progress">重置存档</button></div>
        </div>`, true);
      // 设置里的 data-action 由模态框事件代理转发。
    }

    toggleSound() {
      RF.Storage.patch((save) => { save.settings.sound = !save.settings.sound; });
      this.refreshSave();
      RF.audio.setEnabled(this.save.settings.sound);
      if (this.save.settings.sound) RF.audio.play('stage');
      this.showSettings();
    }

    toggleMotion() {
      RF.Storage.patch((save) => { save.settings.reducedMotion = !save.settings.reducedMotion; });
      this.refreshSave();
      document.body.classList.toggle('reduced-motion', Boolean(this.save.settings.reducedMotion));
      this.showSettings();
    }

    copySaveCode() {
      const area = document.getElementById('save-code');
      if (!area) return;
      area.select();
      try {
        document.execCommand('copy');
        this.toast('存档码已复制。', 'success');
      } catch (_) {
        this.toast('无法自动复制，请手动复制文本框内容。', 'warning');
      }
    }

    importSaveCode() {
      const area = document.getElementById('save-code');
      if (!area) return;
      try {
        RF.Storage.importSave(area.value);
        this.refreshSave();
        RF.audio.setEnabled(this.save.settings.sound);
        document.body.classList.toggle('reduced-motion', Boolean(this.save.settings.reducedMotion));
        this.closeModal();
        this.renderHome();
        this.toast('存档码导入成功。', 'success');
      } catch (error) {
        this.toast('存档码无效或已损坏。', 'warning');
      }
    }

    confirmResetProgress() {
      this.closeModal();
      this.showConfirm('重置全部存档？', '此操作会清除十关进度、自定义套牌、肉鸽状态与战斗统计，且无法撤销。', () => {
        RF.Storage.reset();
        this.refreshSave();
        RF.audio.setEnabled(this.save.settings.sound);
        this.deckDraft = RF.Storage.cloneDeck(this.save.deck);
        this.renderHome();
        this.toast('存档已重置。', 'info');
      });
    }

    showConfirm(title, text, onConfirm) {
      this.confirmHandler = onConfirm;
      this.openModal(`
        <div class="modal-card confirm-modal"><div class="confirm-icon">?</div><h2>${UI.escapeHtml(title)}</h2><p>${UI.escapeHtml(text)}</p><div class="modal-actions"><button class="primary-button" data-modal-action="confirm-yes">确认</button><button class="ghost-button" data-modal-action="confirm-no">取消</button></div></div>`, false);
    }

    openModal(html, dismissible = true) {
      this.modalRoot.innerHTML = `<div class="modal-backdrop"></div><div class="modal-positioner">${html}</div>`;
      this.modalRoot.dataset.dismissible = dismissible ? 'true' : 'false';
      this.modalRoot.classList.add('is-open');
      document.body.classList.add('modal-open');
    }

    closeModal() {
      this.modalRoot.classList.remove('is-open');
      this.modalRoot.innerHTML = '';
      document.body.classList.remove('modal-open');
      this.dialogueState = null;
      this.tutorialState = null;
    }

    toast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'warning' ? '!' : '◆'}</span><p>${UI.escapeHtml(message)}</p>`;
      this.toastRoot.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('is-visible'));
      setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    destroyBattle() {
      this.cleanupHandDrag(true);
      if (this.battle) {
        this.battle.destroy();
        this.battle = null;
      }
      this.lastHandSignature = '';
    }

    setText(id, value, byRole = false) {
      const element = byRole ? document.querySelector(`[data-role="${id}"]`) : document.getElementById(id);
      if (element && element.textContent !== String(value)) element.textContent = String(value);
    }

    setStyleWidth(id, value) {
      const element = document.getElementById(id);
      if (element) element.style.width = value;
    }
  }

  // 模态框中也可能包含普通 data-action 按钮，因此补充一次事件转发。
  document.addEventListener('DOMContentLoaded', () => {
    const app = new RiftfrontApp();
    window.RiftfrontApp = app;
    app.modalRoot.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]');
      if (action) app.handleAction(action.dataset.action, action);
    });
  });
})();
