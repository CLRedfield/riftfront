(function () {
  'use strict';

  const RF = window.RF;
  const UI = RF.UI;
  const esc = UI.escapeHtml;
  const art = (card) => RF.THUMBNAIL_ART?.[card?.id] || card?.art || RF.CARD_ART?.[card?.id] || '';
  const levels = RF.LEVELS;
  const difficulties = {
    relaxed: { name: '轻松', desc: '更多准备时间，适合初次指挥。', hp: 1.3, enemy: 0.72, energy: 0.8 },
    standard: { name: '标准', desc: '攻守均衡，体验完整战术挑战。', hp: 1, enemy: 1, energy: 1 },
    veteran: { name: '精锐', desc: '敌军更强，考验构筑与部署时机。', hp: 1, enemy: 1.15, energy: 1.10 }
  };
  const hazardNames = { blizzard: '暴风雪', sporePod: '孢子孵化', lava: '岩浆喷发', shieldPulse: '护盾脉冲', mirror: '镜像复制', coreCycle: '环境轮换', shadowMist: '日蚀迷雾', timeLock: '时间封锁', gravityWell: '引力场' };
  const nextLevel = (save) => levels.find((level) => !save.campaign.completed.includes(level.id)) || levels[levels.length - 1];
  const prepareConfig = (source, difficulty, training = false) => {
    const base = source._baseConfig || source;
    const mode = difficulties[training ? 'relaxed' : difficulty] || difficulties.standard;
    const campaign = Number.isInteger(base.id) && base.id >= 1 && base.id <= 10;
    const early = campaign && base.id <= 3 ? [0, 0.85, 0.90, 0.95][base.id] : 1;
    return {
      ...base, _baseConfig: base, _difficulty: training ? 'relaxed' : (difficulties[difficulty] ? difficulty : 'standard'),
      playerCoreHp: Math.round((base.playerCoreHp || 1800) * mode.hp),
      playerOutpostHp: Math.round((base.playerOutpostHp || 450) * mode.hp),
      enemyOutpostHp: Math.round((base.enemyOutpostHp || 420) * early),
      enemyCoreHp: Math.round((base.enemyCoreHp || 1500) * early),
      boss: base.boss ? { ...base.boss, hpScale: campaign ? ({ 2: 0.50, 4: 0.68, 6: 0.80, 7: 0.88, 8: 0.94 }[base.id] || 1) : 1, damageScale: campaign ? ({ 2: 0.58, 4: 0.72, 6: 0.84, 7: 0.90, 8: 0.96 }[base.id] || 1) : 1 } : undefined,
      ai: { ...base.ai, hpMul: (base.ai?.hpMul || 1) * mode.enemy * early, damageMul: (base.ai?.damageMul || 1) * mode.enemy * early, energyMul: (base.ai?.energyMul || 1) * mode.energy,
        startDelay: training ? 18 : (base.ai?.startDelay || 5) + (difficulty === 'relaxed' ? 4 : 0) },
      ...(training ? { title: '桥头演习', act: '训练场', tutorial: true, objective: '练习部署、保护后排，并摧毁敌方核心。' } : {})
    };
  };
  const forecast = (battle) => {
    const scheduled = battle.hazardSchedulers.map((item) => ({ at: item.nextAt, name: hazardNames[item.type] || '战区异变', kind: 'hazard' }));
    if (battle.config.boss && !battle.bossSpawned) scheduled.push({ at: battle.duration * battle.config.boss.atRatio, name: 'Boss 即将登场', kind: 'boss' });
    const next = scheduled.filter((item) => item.at >= battle.elapsed).sort((a, b) => a.at - b.at)[0];
    if (next) return { ...next, seconds: Math.ceil(next.at - battle.elapsed) };
    const costs = battle.enemyHand.map((id) => RF.CARDS[id]?.cost).filter(Number.isFinite);
    const needEnergy = Math.max(0, Math.min(...costs) - battle.enemyEnergy);
    const rate = (battle.stage.energyMultiplier || 1) / 2.8 * (battle.config.ai?.energyMul || 1);
    return { name: '敌军增援 · 最早', kind: 'deploy', seconds: costs.length ? Math.ceil(Math.max(battle.aiThinkTimer, needEnergy / rate, 0)) : null };
  };
  RF.VERSION = '1.7.0';
  RF.Experience = { nextLevel, prepareConfig, forecast, difficulties, hazardNames };

  // A short, time-based pulse confirms successful deployment without obscuring combat.
  const proto = RF.BattleEngine.prototype;
  const spawnUnits = proto.spawnCardUnits;
  proto.spawnCardUnits = function (side, card, lane, x, options = {}) {
    const before = this.entities.length;
    spawnUnits.call(this, side, card, lane, x, options);
    if (side === 'enemy' && options.source === 'mirror') {
      this.entities.slice(before).forEach((entity) => {
        entity.hp *= 0.6; entity.maxHp *= 0.6; entity.shield *= 0.6; entity.damage *= 0.6; entity.heal *= 0.6;
        entity.expiresAt = this.elapsed + 30;
      });
    }
    if (side === 'enemy' && options.source === 'boss' && this.config.boss) {
      const boss = this.config.boss;
      this.entities.slice(before).forEach((entity) => {
        entity.hp *= boss.hpScale || 1; entity.maxHp *= boss.hpScale || 1; entity.shield *= boss.hpScale || 1;
        entity.damage *= boss.damageScale || 1;
      });
    }
  };
  const playEffect = proto.playSelectedAt;
  proto.playSelectedAt = function (x, y) {
    const result = playEffect.call(this, x, y);
    if (result && !RF.Storage.get().settings.reducedMotion) {
      this.deployPulses = [...(this.deployPulses || []).slice(-5), { x, y, at: this.elapsed }];
    }
    return result;
  };
  const render = proto.render;
  proto.render = function () {
    render.call(this);
    if (this.paused || this.ended) return;
    const ctx = this.ctx;
    this.deployPulses = (this.deployPulses || []).filter((pulse) => this.elapsed - pulse.at < 0.65);
    this.deployPulses.forEach((pulse) => {
      const progress = (this.elapsed - pulse.at) / 0.65;
      ctx.save(); ctx.globalAlpha = (1 - progress) * 0.8; ctx.strokeStyle = '#7bebff'; ctx.lineWidth = 3 - progress * 2;
      ctx.beginPath(); ctx.ellipse(pulse.x, pulse.y, 16 + progress * 48, 9 + progress * 26, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const app = window.RiftfrontApp;
    if (!app) return;
    RF.audio.setVolume(app.save.settings.volume);
    app.deckSearch = '';
    app.pauseView = null;
    const difficultyPicker = () => `<div class="difficulty-picker" role="group" aria-label="战斗难度">${Object.entries(difficulties).map(([id, mode]) => `<button data-action="set-difficulty" data-difficulty="${id}" aria-pressed="${app.save.settings.difficulty === id}" title="${mode.desc}">${mode.name}</button>`).join('')}</div>`;
    const header = (active) => `<header class="command-header"><button class="command-brand" data-action="go-home" aria-label="返回主菜单"><span class="command-symbol">◈</span><span>裂界战线<small>RIFTFRONT</small></span></button><nav aria-label="主导航">${[['campaign', '战役'], ['rogue', '远征'], ['deck', '套牌'], ['guide', '手册']].map(([id, name]) => `<button data-action="go-${id}" ${active === id ? 'aria-current="page"' : ''}>${name}</button>`).join('')}</nav><button class="command-settings" data-action="open-settings" aria-label="设置与存档">⚙</button></header>`;
    UI.appHeader = (active) => header(active);

    app.renderHome = function () {
      this.destroyBattle(); this.closeModal(); this.refreshSave(); this.currentScreen = 'home';
      const next = nextLevel(this.save), completed = this.save.campaign.completed.length, run = this.save.rogue;
      const totalStars = Object.values(this.save.campaign.stars).reduce((sum, value) => sum + Number(value || 0), 0);
      this.root.innerHTML = `<div class="command-home">${header('home')}<main class="command-hero"><div class="command-atmosphere" aria-hidden="true"></div><div class="command-copy"><p class="chapter-kicker"><i></i> 影渊篇 · 完整战役</p><h1>裂界<span>战线</span></h1><p class="command-english">RIFTFRONT PROTOCOL</p><p class="command-tagline">一副套牌。三条战线。<br>每一次部署，都能改变战局。</p><div class="command-start"><button class="primary-button command-primary" data-action="continue-campaign"><span>${completed ? (completed === levels.length ? '重返战场' : '继续战役') : '开始战役'} <b>↗</b></span><small>第 ${String(next.id).padStart(2, '0')} 关 · ${esc(next.title)}</small></button><button class="command-practice" data-action="start-training">◎ 训练演习 <span>随时练习 · 不影响进度</span></button></div><div class="command-progress"><span>战役进度 <b>${completed}<small> / ${levels.length}</small></b></span><div><i style="width:${completed / levels.length * 100}%"></i></div><span class="command-stars">★ ${totalStars} / ${levels.length * 3}</span></div></div><div class="command-world-label" aria-hidden="true"><i></i><span>时砂双桥<small>SHADOW FRONTIER // 01</small></span></div><div class="command-modebar"><button data-action="go-campaign"><span>01 / STORY</span><strong>剧情战役 <b>↗</b></strong><small>十座战场，一场影渊之战</small></button><button data-action="go-rogue"><span>02 / EXPEDITION</span><strong>${run?.active ? '继续远征' : '裂界远征'} <b>↗</b></strong><small>${run?.pendingLoot ? '战利品等待领取' : run?.active ? `第 ${run.depth + 1} / 8 层 · ${esc(RF.FACTIONS.find((f) => f.id === run.factionId)?.name || '')}` : '四个阵营，八层随机 Boss'}</small></button><button data-action="go-deck"><span>03 / ARSENAL</span><strong>战术套牌 <b>↗</b></strong><small>30 张卡牌，自由组合战术</small></button></div></main><footer class="command-footer"><span><i></i> 离线单人 · 自动保存</span><span>V${RF.VERSION} <em> / </em> 指挥链路就绪</span></footer></div>`;
      window.scrollTo(0, 0);
    };

    app.renderCampaign = function () {
      this.destroyBattle(); this.closeModal(); this.refreshSave(); this.currentScreen = 'campaign';
      const completed = new Set(this.save.campaign.completed), next = nextLevel(this.save);
      this.root.innerHTML = `<div class="app-shell campaign-command">${header('campaign')}<main class="content-main"><section class="campaign-heading"><div><span class="eyebrow">THE SHADOW CAMPAIGN</span><h1>影渊战役</h1><p>守住核心，跨越王桥。前方还有你的战线。</p></div><div class="campaign-difficulty"><span>任务难度</span>${difficultyPicker()}<small>${difficulties[this.save.settings.difficulty]?.desc || difficulties.standard.desc}</small></div></section><section class="campaign-next"><div><span>下一项任务 / ${String(next.id).padStart(2, '0')}</span><h2>${esc(next.title)}</h2><p>${esc(next.briefing)}</p><button class="primary-button" data-level-id="${next.id}">部署出击 →</button></div><div class="campaign-completion"><strong>${completed.size}<small> / 10</small></strong><span>已完成任务</span><div class="campaign-pips">${levels.map((level) => `<i class="${completed.has(level.id) ? 'is-complete' : ''}"></i>`).join('')}</div></div></section><div class="mission-list-heading"><h2>任务序列</h2><button class="text-button" data-action="toggle-free-select">${this.freeSelect ? '恢复顺序解锁' : '自由选关'}</button></div><section class="mission-list">${levels.map((level) => {
        const done = completed.has(level.id), unlocked = this.freeSelect || level.id === 1 || completed.has(level.id - 1);
        const hazards = [...new Set((level.hazards || []).map((h) => hazardNames[h.type] || '战区异变'))];
        return `<article class="mission-row ${done ? 'is-complete' : ''} ${unlocked ? '' : 'is-locked'} ${next.id === level.id ? 'is-next' : ''}"><span class="mission-order">${String(level.id).padStart(2, '0')}</span><div class="mission-copy"><small>${esc(level.act)}</small><h3>${esc(level.title)} ${level.boss ? '<span class="boss-tag">BOSS</span>' : ''}</h3><p>${esc(level.subtitle)}</p></div><div class="mission-conditions"><span>${esc(RF.MAPS[level.mapId]?.name || '')}</span><small>${esc(hazards.join(' · ') || '基础部署与推进')} · ${Math.ceil(level.duration / 60)} 分钟</small></div><div class="mission-rating">${done ? UI.stars(this.save.campaign.stars[level.id] || 1) : `<small>${unlocked ? '等待出击' : '尚未解锁'}</small>`}</div><button class="${unlocked ? 'secondary-button' : 'ghost-button'}" data-level-id="${level.id}" ${unlocked ? '' : 'disabled'}>${done ? '再战' : unlocked ? '出击' : '锁定'}${unlocked ? ' ↗' : ''}</button></article>`;
      }).join('')}</section><p class="campaign-footnote">时限结束时，依次比较核心完整度、存活前哨和前哨完整度。主动推进才能建立优势。</p></main></div>`;
      window.scrollTo(0, 0);
    };

    app.battleTemplate = function (config) {
      const map = RF.MAPS[config.mapId];
      const dots = map.routes.map((route) => `<i title="${esc(route.name)}前哨"></i>`).join('');
      return `<div class="battle-screen command-battle biome-${config.biome}"><header class="battle-topbar"><button class="battle-icon-button" data-action="battle-pause" title="暂停菜单（Esc）" aria-label="暂停菜单">☰</button><div class="core-hud player-core-hud"><div class="core-label"><span>我方核心</span><b id="player-core-text">100%</b></div><div class="core-bar"><i id="player-core-fill"></i></div><div class="outpost-dots" id="player-outposts">${dots}</div></div><div class="battle-title-block"><small>${esc(config.act || '裂界远征')}</small><strong>${esc(config.title)}</strong><span id="battle-timer">${UI.formatDuration(config.duration)}</span></div><div class="core-hud enemy-core-hud"><div class="core-label"><b id="enemy-core-text">100%</b><span>敌方核心</span></div><div class="core-bar"><i id="enemy-core-fill"></i></div><div class="outpost-dots enemy" id="enemy-outposts">${dots}</div></div><button class="battle-icon-button" data-action="battle-pause" id="pause-button" aria-label="暂停或继续">Ⅱ</button></header><div class="command-phase"><div class="phase-markers">${config.stages.map((stage, index) => `<span data-stage-node="${index}" class="${index === 0 ? 'is-active' : ''}"><b>${stage.short}</b> ${esc(stage.name)}</span>`).join('')}</div><div class="command-phase-progress"><i id="battle-time-progress"></i></div><span id="stage-rate">1×费用</span><span id="stage-name" hidden></span></div><main class="battle-layout"><section class="battlefield-column"><div class="battlefield-frame"><canvas id="battle-canvas" width="1280" height="720" aria-label="${esc(map.name)}实时战场；先选下方手牌，再点击蓝色区域部署"></canvas><div class="command-field-label"><span>◈ ${esc(map.name)}</span><small>${map.routes.length} 条通路</small></div><div class="battle-banner-stack" id="battle-banner-stack" aria-live="polite"></div><div class="tutorial-checklist command-coach" id="tutorial-checklist" hidden></div><div class="command-boss" id="command-boss" hidden></div><div class="battlefield-help" id="battlefield-help">选择下方卡牌，再点击蓝色区域部署</div><div class="core-danger" aria-hidden="true"></div></div></section><aside class="intel-sidebar"><section class="command-forecast"><div><span id="forecast-label">战场预报</span><i id="forecast-dot"></i></div><strong id="forecast-time">—</strong><small id="forecast-copy">正在侦察敌方动向</small></section><section class="objective-panel"><span>任务目标</span><strong>摧毁敌方核心</strong><p>${esc(config.objective || '')}</p></section><section class="selected-card-panel" id="selected-card-panel"></section><section class="event-log-panel"><span>战场通讯</span><div id="battle-event-log"><p>指挥链路已建立。</p></div></section><div class="battle-controls"><button data-action="battle-speed" id="speed-button">速度 1×</button><button data-action="battle-pause" id="pause-button-side">暂停</button></div></aside></main><footer class="battle-handbar"><div class="energy-module"><div class="energy-orb"><span id="energy-value">5.0</span><small>/ <b id="energy-max">10</b></small></div><div><strong>战术能量</strong><div class="energy-bar"><i id="energy-fill"></i></div><small id="energy-rate-copy">持续恢复</small></div></div><div class="hand-container" id="hand-container"></div><div class="command-draw"><div class="draw-module"><div class="progress-ring" id="draw-ring" style="--progress:0"><span>抽牌</span><b id="draw-text">5.6s</b></div><div><strong><b id="pile-count">25</b> 张</strong><small id="resupply-text">牌库补给中</small></div></div><button class="archive-button" data-action="archive-selected" id="archive-button"><span>↺</span><strong>归档 <kbd>R</kbd></strong><b id="archive-charges">2/2</b></button></div></footer><div class="command-keybar"><span><kbd>1–0</kbd> 选牌 <kbd>R</kbd> 归档 <kbd>Space</kbd> 暂停 <kbd>Esc</kbd> 取消 / 菜单</span><span id="command-status">指挥链路就绪</span></div></div>`;
    };

    UI.handCard = (item, selected, playable) => {
      const card = item.card, src = art(card), rank = Number(app.battle?.mods.cardUpgrades?.[card.id] || 0);
      return `<button class="hand-card rarity-${esc(card.rarity)} ${selected ? 'is-selected' : ''} ${playable ? 'is-ready' : 'is-unaffordable'}" data-card-index="${item.index}" data-card-uid="${esc(item.uid)}" aria-pressed="${selected}" aria-label="${item.index + 1}号，${esc(card.name)}，${item.effectiveCost}费，${esc(UI.typeNames[card.type])}${playable ? '' : '，能量不足'}" title="${esc(card.name)} · ${item.effectiveCost}费\n${esc(card.desc)}"><span class="hand-cost">${item.effectiveCost}</span><span class="hand-hotkey">${item.index === 9 ? 0 : item.index + 1}</span><span class="hand-art ${src ? 'has-image' : 'spell-art'}" ${src ? `style="background-image:url('${esc(src)}')"` : ''}>${src ? '' : `<b>${esc(card.icon)}</b>`}</span><span class="hand-name">${esc(card.name)}${rank ? ` <em>+${rank}</em>` : ''}</span><span class="hand-type">${esc(UI.typeNames[card.type])}${card.unit?.flying ? ' · 空中' : card.unit?.role === 'healer' ? ' · 治疗' : ''}</span></button>`;
    };

    const updateHand = app.updateHand.bind(app);
    app.updateHand = function (state) {
      const previous = this.lastHandSignature;
      updateHand(state);
      if (previous === this.lastHandSignature) return;
      const selected = state.hand.find((item) => item.index === state.selectedIndex);
      const panel = document.getElementById('selected-card-panel');
      if (!panel) return;
      if (!selected) panel.innerHTML = '<span>部署提示</span><strong>先前排，后火力</strong><p>盾兵吸收伤害，远程小队随后跟进。保留战术牌应对敌军集群。</p><div class="card-intel-rule">点击或拖动卡牌<br>在蓝色战区部署</div>';
      else {
        const card = selected.card, src = art(card), stats = card.unit || card.building || card.spell || {};
        panel.innerHTML = `<span>已选${esc(UI.typeNames[card.type])} · ${selected.effectiveCost} 费</span>${src ? `<img class="card-intel-art" src="${esc(src)}" alt="">` : ''}<strong>${esc(card.name)}</strong><p>${esc(card.desc)}</p><div class="card-intel-stats">${stats.hp ? `<span>生命 <b>${stats.hp}</b></span>` : ''}${stats.damage ? `<span>伤害 <b>${stats.damage}</b></span>` : ''}${stats.range ? `<span>射程 <b>${stats.range}</b></span>` : ''}${stats.count ? `<span>数量 <b>${stats.count}</b></span>` : ''}</div><div class="card-intel-rule">${card.type === 'spell' ? (card.target === 'friendly' ? '指定我方或中央区域' : '点击战场，释放区域战术') : '部署在蓝色区域 · 自动推进'}</div>`;
      }
      if (selected) this.root.querySelector(`[data-card-index="${state.selectedIndex}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    };

    const updateHud = app.updateBattleHud.bind(app);
    app.updateBattleHud = function (state) {
      updateHud(state);
      if (!this.battle || this.currentScreen !== 'battle') return;
      const b = this.battle, next = forecast(b);
      this.setText('pile-count', state.groups.reduce((sum, group) => sum + group.pile, 0));
      this.setText('draw-text', state.resupplyTimer > 0 ? `${Math.ceil(state.resupplyTimer)}s` : state.drawPaused ? '已满' : `${Math.max(0, b.currentDrawInterval() - b.drawProgress).toFixed(1)}s`);
      this.setText('resupply-text', b.elapsed < b.drawLockedUntil ? '抽牌暂时封锁' : state.resupplyTimer > 0 ? '牌库正在重洗' : state.drawPaused ? '10 张手牌已满' : '下一张补给');
      this.setText('forecast-label', next.name);
      this.setText('forecast-time', next.seconds == null ? '侦察中' : `${String(Math.floor(next.seconds / 60)).padStart(2, '0')}:${String(next.seconds % 60).padStart(2, '0')}`);
      const enemies = b.entities.filter((entity) => entity.alive && entity.side === 'enemy').length;
      this.setText('forecast-copy', next.kind === 'deploy' ? `场上敌军 ${enemies} · 观察各路动向` : `${next.kind === 'boss' ? '留出能量，准备集火' : '保留战术牌应对异变'} · 敌军 ${enemies}`);
      const selected = state.hand.find((item) => item.index === state.selectedIndex);
      let help = selected ? `${selected.card.name} · ${selected.card.type === 'spell' ? '点击战场释放' : '点击蓝色区域部署'}` : state.energy >= state.maxEnergy - 0.05 ? '能量已满，部署部队推进战线' : '选择下方卡牌，再点击蓝色区域部署';
      if (selected && selected.effectiveCost > state.energy) help = `能量不足 · 还需 ${(selected.effectiveCost - state.energy).toFixed(1)} 点`;
      this.setText('battlefield-help', help);
      this.setText('command-status', `${difficulties[b.config._difficulty]?.name || '标准'} · 已部署 ${state.stats.cardsPlayed} 张`);
      this.root.querySelector('.command-battle')?.classList.toggle('is-core-danger', state.playerCore.hp / state.playerCore.maxHp < 0.3);
      this.root.querySelector('.energy-module')?.classList.toggle('is-full', state.energy >= state.maxEnergy - 0.05);
      const boss = b.entities.find((entity) => entity.alive && entity.isBoss && entity.side === 'enemy');
      const bossPanel = document.getElementById('command-boss');
      if (bossPanel) {
        bossPanel.hidden = !boss;
        if (boss) bossPanel.innerHTML = `<div><span>BOSS · ${esc(RF.CARDS[boss.cardId]?.name || '影渊君王')}</span><b>${Math.ceil(boss.hp / boss.maxHp * 100)}%</b></div><i><b style="width:${Math.max(0, boss.hp / boss.maxHp * 100)}%"></b></i>`;
      }
    };

    app.updateTutorial = function (goals) {
      const box = document.getElementById('tutorial-checklist');
      if (!box) return;
      box.hidden = !goals || this.coachDismissed;
      if (box.hidden) return;
      const steps = [['playedUnit', '部署你的第一支部队', '点击一张小队牌，再点击蓝色战区。'], ['playedSpell', '让战术牌支援前线', '选中轰击或治疗牌，对准合适的区域。'], ['destroyedOutpost', '突破敌方前哨', '前排吸引火力，远程在后方持续输出。']];
      const index = steps.findIndex(([key]) => !goals[key]);
      if (index < 0) { box.hidden = true; return; }
      const signature = `${index}`;
      if (box.dataset.step === signature) return;
      box.dataset.step = signature;
      box.innerHTML = `<span>实战引导 <b>${index + 1} / 3</b></span><strong>${steps[index][1]}</strong><p>${steps[index][2]}</p><button data-action="dismiss-coach" aria-label="隐藏引导">×</button>`;
    };

    const beginBattle = app.beginBattle.bind(app);
    app.beginBattle = function (config, context) {
      this.pauseView = null; this.coachDismissed = false;
      const tuned = prepareConfig(config, this.refreshSave().settings.difficulty, context.mode === 'training');
      beginBattle(tuned, context);
      this.battle.paused = true;
      this.battle.emitState(true);
      this.showReady();
      window.scrollTo(0, 0);
    };
    app.showTutorialSlides = function (onFinish) { onFinish(); };
    app.showReady = function () {
      const b = this.battle;
      if (!b) return;
      this.pauseView = 'ready';
      this.openModal(`<div class="modal-card command-ready"><span class="eyebrow">MISSION BRIEFING</span><h2>${esc(b.config.title)}</h2><p>${esc(b.config.objective)}</p><div class="ready-steps"><div><b>01</b><strong>选择卡牌</strong><span>点击手牌或按数字键</span></div><div><b>02</b><strong>部署部队</strong><span>点击蓝色区域，或拖牌落下</span></div><div><b>03</b><strong>突破战线</strong><span>掩护远程，集中攻击前哨</span></div></div><div class="ready-details"><span>${esc(b.map.name)} · ${b.routeCount} 条通路</span><span>${difficulties[b.config._difficulty].name} · ${UI.formatDuration(b.duration)}</span></div><div class="modal-actions"><button class="primary-button" data-modal-action="command-resume">准备完毕，开始作战 →</button><button class="ghost-button" data-modal-action="command-exit">返回</button></div><small>随时按空格暂停思考。战前准备期间，战场计时停止。</small></div>`, false);
    };
    app.showPause = function (automatic = false) {
      if (!this.battle || this.battle.ended) return;
      this.cleanupHandDrag(true); this.battle.paused = true; this.battle.emitState(true); this.pauseView = 'pause';
      this.openModal(`<div class="modal-card command-pause"><span class="eyebrow">TACTICAL PAUSE</span><h2>战场已暂停</h2><p>${automatic ? '离开窗口时已自动暂停。准备好后继续。' : '从容判断，下一次部署由你决定。'}</p><div class="pause-summary"><span>${esc(this.battle.config.title)}</span><b>${UI.formatDuration(this.battle.elapsed)} / ${UI.formatDuration(this.battle.duration)}</b></div><div class="pause-actions"><button class="primary-button" data-modal-action="command-resume">继续作战 <kbd>Space</kbd></button><button class="secondary-button" data-modal-action="command-settings">声音与设置</button><button class="secondary-button" data-modal-action="command-restart">重新开始本场</button><button class="ghost-button" data-modal-action="command-leave">撤离战场</button></div><small>计时、敌军行动和能量恢复均已暂停。</small></div>`, false);
    };
    app.resumeBattle = function () {
      if (!this.battle || this.battle.ended) return;
      this.closeModal(); this.pauseView = null; this.battle.paused = false; this.battle.lastFrameAt = performance.now(); this.battle.emitState(true); RF.audio.play('select');
    };

    const handleEnd = app.handleBattleEnd.bind(app);
    app.handleBattleEnd = function (result) {
      this.cleanupHandDrag(false); this.pauseView = null;
      if (this.battleContext.mode === 'training') { this.currentResult = result; this.showResultModal(result); return; }
      if (this.battleContext.mode === 'rogue' && result.victory && this.refreshSave().rogue?.active) {
        this.save.rogue.pendingVictory = { context: { ...this.battleContext }, result };
        RF.Storage.save();
      }
      if (this.battleContext.mode === 'rogue' && !result.victory && this.refreshSave().rogue?.active) {
        this.save.rogue.pendingDefeat = { optionId: this.battleContext.optionId };
        RF.Storage.save();
      }
      handleEnd(result);
    };
    app.showResultModal = function (result) {
      const training = this.battleContext.mode === 'training', rogue = this.battleContext.mode === 'rogue';
      const level = levels.find((item) => item.id === this.battleContext.levelId);
      const final = level?.id === levels.length;
      const primary = training ? '前往剧情战役' : rogue ? (result.victory ? '领取战利品 →' : '结束本轮远征') : result.victory ? (final ? '战役终章 →' : '下一项任务 →') : '重新部署';
      const tip = result.victory ? (training ? '训练完成。带上刚掌握的战术，加入影渊战役。' : '战线已推进。整理战术，下一座王桥正等待你的到来。') : result.stats.cardsPlayed < 8 ? '能量恢复后及时出牌。先部署前排，再让远程部队跟进。' : result.coreRatio < 0.3 ? '核心需要掩护。将炮塔部署在前哨附近，牵引敌方攻城单位。' : '尝试集中突破一条通路；对密集敌军保留范围战术牌。';
      this.openModal(`<div class="modal-card result-modal command-result ${result.victory ? 'victory' : 'defeat'}"><div class="result-emblem">${result.victory ? '✧' : '◇'}</div><span class="eyebrow">${training ? 'TRAINING REPORT' : result.victory ? 'MISSION COMPLETE' : 'MISSION REPORT'}</span><h2>${result.victory ? '战线突破' : '重整旗鼓'}</h2><p class="result-reason">${esc(result.reason)}</p>${result.victory && !rogue && !training ? UI.stars(result.stars) : ''}<div class="result-stats"><div><span>战斗用时</span><strong>${UI.formatDuration(result.elapsed)}</strong></div><div><span>核心完整度</span><strong>${Math.ceil(result.coreRatio * 100)}<small>%</small></strong></div><div><span>部署卡牌</span><strong>${result.stats.cardsPlayed}</strong></div><div><span>造成伤害</span><strong>${Math.round(result.stats.damageDealt).toLocaleString()}</strong></div></div><p class="result-tip">${tip}</p>${!training && !rogue && result.victory && level?.reward ? `<div class="result-reward"><span>◆ ${esc(level.reward.title)}</span><p>${esc(level.reward.text.replace('解锁新阵营卡：', '推荐尝试：').replace('解锁新阵营传奇：', '推荐传奇：').replace('并永久解锁影渊教团的完整标准卡牌。', '可继续挑战精锐难度与八层远征。'))}</p></div>` : ''}<div class="modal-actions"><button class="primary-button" data-modal-action="result-primary">${primary}</button>${training ? '<button class="secondary-button" data-modal-action="result-retry">再练一次</button>' : ''}${rogue && result.victory ? '' : '<button class="ghost-button" data-modal-action="result-back">返回</button>'}</div>${!training && !rogue ? '<small class="result-star-rule">★ 获胜　★ 核心 ≥60%　★ 在时限的78%内获胜</small>' : ''}</div>`, false);
    };
    const primaryResult = app.handleResultPrimary.bind(app);
    app.handleResultPrimary = function () {
      if (!this.currentResult) return;
      if (this.battleContext.mode === 'training') { this.renderCampaign(); return; }
      if (this.battleContext.mode === 'campaign' && this.currentResult.victory) {
        const level = levels.find((item) => item.id === this.battleContext.levelId);
        this.closeModal(); this.destroyBattle(); this.renderCampaign();
        this.showDialogue(level.outro, { eyebrow: '任务后续', title: level.title }, () => {
          if (level.id < levels.length) this.startStoryLevel(level.id + 1);
          else this.renderCampaign();
        });
        return;
      }
      primaryResult();
    };

    // Persist the unclaimed choice, rather than regenerating or losing it on reload.
    const encodeChoice = (choice) => ({ id: choice.id, type: choice.type, bundleId: choice.bundle?.id, relicId: choice.relic?.id, cardId: choice.cardId });
    const decodeChoice = (choice) => {
      if (!choice || typeof choice.id !== 'string') return null;
      if (choice.type === 'bundle') { const bundle = RF.ROGUE_BUNDLES.find((item) => item.id === choice.bundleId); return bundle ? { id: choice.id, type: choice.type, bundle } : null; }
      if (choice.type === 'relic') { const relic = RF.ROGUE_RELICS.find((item) => item.id === choice.relicId); return relic ? { id: choice.id, type: choice.type, relic } : null; }
      return choice.type === 'treasure' && RF.CARDS[choice.cardId]?.treasure ? { id: choice.id, type: choice.type, cardId: choice.cardId } : null;
    };
    const lootModal = app.renderRogueLootModal.bind(app);
    app.renderRogueLootModal = function () {
      const run = this.refreshSave().rogue;
      if (run?.active) { run.pendingLoot = { depth: run.depth, choices: this.rogueRewardChoices.map(encodeChoice) }; RF.Storage.save(); }
      lootModal();
    };
    const selectLoot = app.selectRogueLoot.bind(app);
    app.selectRogueLoot = function (rewardId) {
      const run = this.refreshSave().rogue;
      if (!run?.active || this.rogueRelicSelected || !this.rogueRewardChoices.some((item) => item.id === rewardId)) return;
      delete run.pendingLoot;
      selectLoot(rewardId);
    };
    const processVictory = app.processRogueVictory.bind(app);
    app.processRogueVictory = function () {
      const run = this.refreshSave().rogue;
      if (!run?.active) return this.renderRogue();
      if (run.pendingLoot) return this.renderRogue();
      const pending = run.pendingVictory;
      if (pending) { this.battleContext = pending.context; this.currentResult = pending.result; }
      if (!this.currentResult?.victory || this.battleContext?.mode !== 'rogue') return;
      if (run.history.some((entry) => entry.optionId === this.battleContext.optionId && entry.victory)) return this.renderRogue();
      delete run.pendingVictory;
      processVictory();
    };
    const renderRogue = app.renderRogue.bind(app);
    app.renderRogue = function () {
      const run = this.refreshSave().rogue;
      if (run?.active && run.pendingVictory) { this.processRogueVictory(); return; }
      if (run?.active && run.pendingDefeat) { this.battleContext = { mode: 'rogue', optionId: run.pendingDefeat.optionId }; this.processRogueDefeat(); return; }
      if (run?.active && run.pendingLoot) {
        this.destroyBattle(); this.closeModal();
        this.rogueRewardChoices = run.pendingLoot.choices.map(decodeChoice).filter(Boolean);
        if (!this.rogueRewardChoices.length) this.rogueRewardChoices = this.makeRogueLootChoices(run);
        this.rogueRelicSelected = false; this.renderRogueBackgroundForReward(); this.renderRogueLootModal(); return;
      }
      if (run?.active && !run.options?.length) { run.options = this.generateRogueOptions(run.depth); RF.Storage.save(); }
      renderRogue();
      const title = this.root.querySelector('.hero-copy h1');
      if (title && !run?.active) {
        title.textContent = '走进未知的裂界';
        const rewardPill = this.root.querySelector('.info-pill-row .info-pill:nth-child(3)');
        if (rewardPill) rewardPill.textContent = '卡包 / 遗物 / 宝藏';
      }
      this.root.querySelector('.hero-copy')?.insertAdjacentHTML('beforeend', `<div class="rogue-difficulty"><span>战斗难度</span>${difficultyPicker()}</div>`);
      if (run?.active && run.pendingCamp) this.openRogueCampEvent();
    };
    const processDefeat = app.processRogueDefeat.bind(app);
    app.processRogueDefeat = function () {
      const run = this.refreshSave().rogue;
      if (!run?.active) return this.renderRogue();
      delete run.pendingDefeat;
      processDefeat();
    };
    const camp = app.openRogueCampEvent.bind(app);
    app.openRogueCampEvent = function () {
      const run = this.refreshSave().rogue;
      if (run?.active) { run.pendingCamp = run.depth; RF.Storage.save(); }
      camp();
    };

    const renderDeck = app.renderDeckBuilder.bind(app);
    app.renderDeckBuilder = function (resetDraft = false) {
      renderDeck(resetDraft);
      const hero = this.root.querySelector('.hero-art-panel');
      hero.classList.add('command-deck-hero'); hero.style.removeProperty('background-image');
      this.root.querySelector('.hero-copy h1').textContent = '构筑你的战术';
      this.root.querySelector('.hero-copy p').textContent = '前排、远程与战术相互配合。30 张牌自由混编，标准卡最多 2 张，传奇卡最多 1 张。';
      const heading = this.root.querySelector('.library-heading');
      heading.querySelector('strong').textContent = this.deckDraft.arsenal.length >= 30 ? '先移除牌槽中的卡牌，再加入新卡' : '选择卡牌，加入你的套牌';
      heading.insertAdjacentHTML('beforeend', `<div class="deck-search"><input id="deck-search" type="search" placeholder="搜索卡名、能力或阵营" aria-label="搜索卡牌" value="${esc(this.deckSearch)}"><span id="deck-search-count"></span></div><div class="deck-factions" role="group" aria-label="阵营筛选"><button data-action="filter-faction" data-faction="all" aria-pressed="${this.deckFactionFilter === 'all'}">全部</button>${RF.FACTIONS.map((f) => `<button data-action="filter-faction" data-faction="${f.id}" aria-pressed="${this.deckFactionFilter === f.id}">${esc(f.name)}</button>`).join('')}</div>`);
      this.root.querySelector('.deck-actions').insertAdjacentHTML('beforeend', '<button class="ghost-button" data-action="undo-deck">撤销修改</button>');
      const list = this.deckDraft.arsenal;
      const units = list.filter((id) => RF.CARDS[id]?.type === 'unit').length, spells = list.filter((id) => RF.CARDS[id]?.type === 'spell').length;
      this.root.querySelector('.deck-group-stats').insertAdjacentHTML('afterend', `<div class="deck-composition"><span>小队 <b>${units}</b></span><span>建筑 <b>${list.length - units - spells}</b></span><span>战术 <b>${spells}</b></span></div><p class="deck-advice">${units < 10 ? '建议带上至少 10 张小队牌，保证持续推进。' : spells < 3 ? '补充几张范围战术，应对成群敌军。' : '先布置前排，再部署远程与治疗，保持进攻节奏。'}</p>`);
      this.filterDeckLibrary();
    };
    app.filterDeckLibrary = function () {
      const query = this.deckSearch.trim().toLocaleLowerCase(), counts = this.getDeckCounts(this.deckDraft);
      const cards = RF.PLAYER_CARD_IDS.map((id) => RF.CARDS[id]).filter((card) =>
        (this.deckFilter === 'all' || card.type === this.deckFilter) &&
        (this.deckFactionFilter === 'all' || card.faction === this.deckFactionFilter) &&
        (!query || `${card.name} ${card.desc} ${UI.factionNames[card.faction] || ''}`.toLocaleLowerCase().includes(query))
      ).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'zh-CN'));
      const grid = this.root.querySelector('.card-library-grid');
      if (grid) grid.innerHTML = cards.map((card) => UI.cardTile(card, { action: 'add-card', count: counts[card.id] || 0, disabled: this.deckDraft.arsenal.length >= 30 || (counts[card.id] || 0) >= (card.rarity === 'legendary' ? 1 : 2) })).join('') || '<p class="empty-library">没有匹配的卡牌。试试其他关键词或阵营。</p>';
      this.setText('deck-search-count', `${cards.length} 张`);
    };

    const showSettings = app.showSettings.bind(app);
    app.showSettings = function () {
      showSettings();
      const list = this.modalRoot.querySelector('.settings-list');
      const help = list?.querySelector('.setting-row small');
      if (help) help.textContent = '部署、攻击、提示与结算音效。';
      list?.insertAdjacentHTML('beforeend', `<label class="setting-volume" for="sound-volume"><span>音量 <b id="volume-label">${Math.round(this.save.settings.volume * 100)}%</b></span><input id="sound-volume" type="range" min="0" max="100" value="${Math.round(this.save.settings.volume * 100)}"></label>`);
    };

    const openModal = app.openModal.bind(app);
    app.openModal = function (html, dismissible = true) {
      if (!this.modalRoot.classList.contains('is-open')) this.modalReturnFocus = document.activeElement;
      openModal(html, dismissible);
      const card = this.modalRoot.querySelector('.modal-card');
      if (card) {
        card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
        const title = card.querySelector('h2');
        if (title) { title.id = 'dialog-title'; card.setAttribute('aria-labelledby', title.id); }
      }
      this.root.inert = true;
      this.modalRoot.querySelector('.primary-button, button, input, textarea')?.focus({ preventScroll: true });
    };
    const closeModal = app.closeModal.bind(app);
    app.closeModal = function () {
      closeModal(); this.root.inert = false;
      if (this.modalReturnFocus?.isConnected) this.modalReturnFocus.focus({ preventScroll: true });
      this.modalReturnFocus = null;
    };

    const handleAction = app.handleAction.bind(app);
    app.handleAction = function (action, element) {
      if (action === 'continue-campaign') { this.startStoryLevel(nextLevel(this.refreshSave()).id); return; }
      if (action === 'start-training') { this.beginBattle(levels[0], { mode: 'training', levelId: 1 }); return; }
      if (action === 'set-difficulty') {
        if (difficulties[element.dataset.difficulty]) RF.Storage.patch((save) => { save.settings.difficulty = element.dataset.difficulty; });
        this.currentScreen === 'rogue' ? this.renderRogue() : this.renderCampaign(); return;
      }
      if (action === 'battle-pause') { this.battle?.paused ? this.resumeBattle() : this.showPause(); return; }
      if (action === 'battle-speed') {
        if (this.battle && !this.battle.ended) { this.battle.cycleSpeed(); RF.Storage.patch((save) => { save.settings.battleSpeed = this.battle.speed; }); } return;
      }
      if (action === 'dismiss-coach') { this.coachDismissed = true; this.updateTutorial(null); return; }
      if (action === 'filter-faction') { this.deckFactionFilter = element.dataset.faction; this.renderDeckBuilder(); return; }
      if (action === 'undo-deck') { this.deckDraft = RF.Storage.cloneDeck(this.refreshSave().deck); this.renderDeckBuilder(); this.toast('已恢复到上次保存的套牌。', 'info'); return; }
      handleAction(action, element);
    };
    const handleModal = app.handleModalClick.bind(app);
    app.handleModalClick = function (event) {
      const button = event.target.closest('[data-modal-action]'), action = button?.dataset.modalAction;
      if (action === 'command-resume') { this.resumeBattle(); return; }
      if (action === 'command-exit') { this.pauseView = null; this.exitBattleToMode(); return; }
      if (action === 'command-settings') { this.pauseView = 'settings'; this.showSettings(); return; }
      if (action === 'command-restart') {
        this.pauseView = 'confirm';
        this.showConfirm('重新开始本场？', '本场部署将清空，战役与远征进度保留。', () => this.retryBattle()); return;
      }
      if (action === 'command-leave') {
        this.pauseView = 'confirm'; this.requestLeaveBattle(); return;
      }
      if ((action === 'close' && this.pauseView === 'settings') || (action === 'confirm-no' && this.pauseView === 'confirm')) { this.confirmHandler = null; this.showPause(); return; }
      if (action?.startsWith('camp-')) {
        const run = this.refreshSave().rogue;
        if (run) { delete run.pendingCamp; RF.Storage.save(); }
      }
      handleModal(event);
    };
    const handleKey = app.handleKeyDown.bind(app);
    app.handleKeyDown = function (event) {
      if (event.key === 'Tab' && this.modalRoot.classList.contains('is-open')) {
        const focusable = [...this.modalRoot.querySelectorAll('button:not(:disabled), input, textarea, select, [tabindex="0"]')];
        if (focusable.length) {
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (event.shiftKey && (document.activeElement === first || !this.modalRoot.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
        return;
      }
      if (event.target?.closest('input, textarea, select, [contenteditable="true"]') || event.repeat) return;
      if (this.modalRoot.classList.contains('is-open')) {
        if ((event.code === 'Space' || event.key === 'Escape') && this.pauseView === 'pause') { event.preventDefault(); this.resumeBattle(); return; }
        if (event.key === 'Escape' && ['settings', 'confirm'].includes(this.pauseView)) { event.preventDefault(); this.confirmHandler = null; this.showPause(); return; }
        handleKey(event); return;
      }
      if (this.battle && !this.battle.ended) {
        if (event.code === 'Space') { event.preventDefault(); this.showPause(); return; }
        if (event.key === 'Escape') {
          event.preventDefault();
          if (this.battle.selectedIndex != null) { this.cleanupHandDrag(false); this.battle.selectedIndex = null; this.battle.emitState(true); }
          else this.showPause();
          return;
        }
      }
      handleKey(event);
    };

    const battleEvent = app.handleBattleEvent.bind(app);
    app.handleBattleEvent = function (event) {
      if (event.type === 'invalid') {
        const now = performance.now();
        if (this.lastInvalidText === event.text && now - this.lastInvalidAt < 1000) return;
        this.lastInvalidText = event.text; this.lastInvalidAt = now;
      }
      battleEvent(event);
      if (event.type === 'cardPlayed') this.setText('command-status', `${event.card.name}已部署 · ${event.routeName}`);
    };
    const guide = app.renderGuide.bind(app);
    app.renderGuide = function () {
      guide();
      this.root.querySelector('.page-hero p').textContent = '学会部署、保护核心，再尝试阵营搭配与远征构筑。';
      const mirror = this.root.querySelector('.biome-manual .mirror p');
      if (mirror) mirror.textContent = '镜界每16秒最多复制一支新部署小队。镜像有5秒预警，生命与火力为原版的60%，30秒后消散。';
      this.root.querySelectorAll('.key-list').forEach((node) => { node.innerHTML = '<span><kbd>1–0</kbd>选择手牌</span><span><kbd>R</kbd>归档所选卡牌</span><span><kbd>Space</kbd>暂停或继续</span><span><kbd>Esc</kbd>取消选牌，再按打开暂停菜单</span>'; });
    };
    app.root.addEventListener('input', (event) => { if (event.target.id === 'deck-search') { app.deckSearch = event.target.value; app.filterDeckLibrary(); } });
    app.modalRoot.addEventListener('input', (event) => {
      if (event.target.id === 'sound-volume') { const value = Number(event.target.value) / 100; RF.audio.setVolume(value); RF.Storage.patch((save) => { save.settings.volume = value; }); app.setText('volume-label', `${Math.round(value * 100)}%`); }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && app.battle && !app.battle.paused && !app.battle.ended) app.showPause(true); });
    window.addEventListener('blur', () => { if (app.battle && !app.battle.paused && !app.battle.ended) app.showPause(true); });
    app.renderHome();
  });
})();
