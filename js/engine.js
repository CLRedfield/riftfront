(function () {
  'use strict';

  const RF = window.RF = window.RF || {};

  const WIDTH = 1280;
  const HEIGHT = 720;
  const FIELD = { left: 80, right: 1200, top: 104, bottom: 616, mid: 360 };
  const SIDE_PLAYER = 'player';
  const SIDE_ENEMY = 'enemy';

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randomBetween = (min, max) => min + Math.random() * (max - min);
  const shuffle = (list) => {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  const artCache = new Map();
  const getArtImage = (src) => {
    if (!src || typeof Image === 'undefined') return null;
    if (artCache.has(src)) return artCache.get(src);
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    artCache.set(src, image);
    return image;
  };

  const formatTime = (seconds) => {
    const safe = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(safe / 60);
    const s = String(safe % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  class BattleEngine {
    constructor(canvas, config, options = {}) {
      if (!canvas) throw new Error('BattleEngine requires a canvas element.');
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.canvas.width = WIDTH;
      this.canvas.height = HEIGHT;
      this.config = config;
      this.map = RF.MAPS?.[config.mapId] || RF.MAPS?.dock_delta;
      if (!this.map) throw new Error('No battlefield map definition is available.');
      this.routes = (this.map.routes || []).map((route, index) => ({
        ...route,
        index,
        points: (route.points || []).map((point) => ({ x: Number(point[0]), y: Number(point[1]) }))
      }));
      this.routeCount = this.routes.length;
      this.obstacles = (this.map.obstacles || []).map((obstacle) => ({ ...obstacle }));
      this.deckDefinition = options.deck || RF.DEFAULT_DECK;
      this.mods = {
        startEnergy: 0,
        maxEnergy: 0,
        unitHpMul: 0,
        unitDmgMul: 0,
        buildingHpMul: 0,
        buildingDurationMul: 0,
        drawSpeed: 0,
        passiveHeal: 0,
        spellPower: 0,
        moveSpeedMul: 0,
        stageEnergyBurst: 0,
        archiveMax: 0,
        archiveSpeed: 0,
        vanguardDiscount: 0,
        ...(options.playerMods || {})
      };
      this.callbacks = {
        onState: options.onState || (() => {}),
        onEvent: options.onEvent || (() => {}),
        onEnd: options.onEnd || (() => {})
      };
      this.isRogue = Boolean(options.isRogue);
      this.modeLabel = options.modeLabel || '剧情战役';
      this.uid = 1;
      this.animationFrame = null;
      this.lastFrameAt = 0;
      this.lastHudAt = 0;
      this.running = false;
      this.paused = false;
      this.ended = false;
      this.speed = Number(options.speed || 1);
      this.mouse = { x: 0, y: 0, inside: false, external: false };
      this.dragPreviewIndex = null;

      this.elapsed = 0;
      this.duration = config.duration || 180;
      this.stageIndex = 0;
      this.stage = config.stages?.[0] || { name: '侦察期', energyMultiplier: 1, drawMultiplier: 1, short: '1×' };
      this.stageChangedAt = 0;

      this.maxEnergy = 10 + Number(this.mods.maxEnergy || 0);
      this.energy = clamp(5 + Number(this.mods.startEnergy || 0), 0, this.maxEnergy);
      this.enemyMaxEnergy = 10;
      this.enemyEnergy = clamp(Number(config.ai?.startEnergy || 5), 0, this.enemyMaxEnergy);
      this.drawProgress = 0;
      this.enemyDrawProgress = 0;
      this.drawLockedUntil = 0;
      this.energySnareUntil = 0;
      this.costCurseUntil = 0;
      this.costCurseAmount = 0;
      this.archiveMax = 2 + Number(this.mods.archiveMax || 0);
      this.archiveCharges = this.archiveMax;
      this.archiveProgress = 0;
      this.resupplyTimer = 0;
      this.resupplyDuration = 8.4;
      this.resupplyCount = 0;
      this.vanguardDiscountAvailable = Boolean(this.mods.firstCardDiscount || this.mods.vanguardDiscount);

      this.activeGroup = RF.GROUPS?.[0]?.id || 'arsenal';
      this.selectedIndex = null;
      this.hand = [];
      this.groupPiles = {};
      this.groupDiscards = {};
      this.enemyPile = shuffle(config.enemyDeck || ['enemy_scrapper', 'enemy_gunner']);
      this.enemyDiscard = [];
      this.enemyHand = [];
      this.aiThinkTimer = Number(config.ai?.startDelay || 5);
      this.aiStallTime = 0;

      this.entities = [];
      this.projectiles = [];
      this.particles = [];
      this.floatingTexts = [];
      this.hazardVisuals = [];
      this.timedActions = [];
      this.hazardSchedulers = [];
      this.bossSpawned = false;
      this.lastPlayerCard = null;
      this.mirrorEnabled = Boolean((config.hazards || []).some((hazard) => hazard.type === 'mirror'));

      this.battleStats = {
        cardsPlayed: 0,
        unitsDeployed: 0,
        damageDealt: 0,
        damageTaken: 0,
        outpostsDestroyed: 0
      };
      this.tutorialGoals = config.tutorial ? {
        playedUnit: false,
        switchedSupply: RF.GROUPS.length <= 1,
        playedSpell: false,
        destroyedOutpost: false
      } : null;
      this.tutorialCompleteAnnounced = false;

      this.forts = this.createFortifications();
      this.initDeck();
      this.initEnemyHand();
      this.initHazards();
      this.boundLoop = (time) => this.loop(time);
      this.boundPointerMove = (event) => this.onPointerMove(event);
      this.boundPointerLeave = () => { if (!this.mouse.external) this.mouse.inside = false; };
      this.boundPointerDown = (event) => this.onPointerDown(event);
      this.canvas.addEventListener('pointermove', this.boundPointerMove);
      this.canvas.addEventListener('pointerleave', this.boundPointerLeave);
      this.canvas.addEventListener('pointerdown', this.boundPointerDown);
      this.emitState(true);
    }

    createFortifications() {
      const playerCoreHp = Number(this.config.playerCoreHp || 1800);
      const enemyCoreHp = Number(this.config.enemyCoreHp || 1500);
      const playerOutpostHp = Number(this.config.playerOutpostHp || 450);
      const enemyOutpostHp = Number(this.config.enemyOutpostHp || 420);
      const coreDef = this.map.core || { player: [78, 360], enemy: [1202, 360] };
      const makeFort = (side, kind, lane, x, y, hp, stats) => ({
        id: `fort-${this.uid++}`,
        side,
        kind,
        lane,
        x,
        y,
        radius: kind === 'core' ? 52 : 30,
        hp,
        maxHp: hp,
        shield: 0,
        alive: true,
        cooldownRemaining: randomBetween(0, 0.4),
        facing: side === SIDE_PLAYER ? 0 : Math.PI,
        ...stats
      });

      const playerOutposts = this.routes.map((route, lane) => {
        const point = this.routePointAtX(lane, 276);
        return makeFort(SIDE_PLAYER, 'outpost', lane, 276, point.y, playerOutpostHp, { damage: 23, range: 205, cooldown: 1.0 });
      });
      const enemyOutposts = this.routes.map((route, lane) => {
        const point = this.routePointAtX(lane, 1004);
        return makeFort(SIDE_ENEMY, 'outpost', lane, 1004, point.y, enemyOutpostHp, { damage: 22, range: 205, cooldown: 1.03 });
      });

      return {
        playerCore: makeFort(SIDE_PLAYER, 'core', null, Number(coreDef.player?.[0] || 78), Number(coreDef.player?.[1] || 360), playerCoreHp, { damage: 31, range: 245, cooldown: 1.1 }),
        enemyCore: makeFort(SIDE_ENEMY, 'core', null, Number(coreDef.enemy?.[0] || 1202), Number(coreDef.enemy?.[1] || 360), enemyCoreHp, { damage: 29, range: 245, cooldown: 1.15 }),
        playerOutposts,
        enemyOutposts
      };
    }
    initDeck() {
      RF.GROUPS.forEach((group) => {
        const source = Array.isArray(this.deckDefinition[group.id]) ? this.deckDefinition[group.id] : RF.DEFAULT_DECK[group.id];
        this.groupPiles[group.id] = shuffle(source);
        this.groupDiscards[group.id] = [];
      });

      if (this.config.tutorial && RF.GROUPS.length === 1) {
        const groupId = RF.GROUPS[0].id;
        ['shield_squad', 'rifle_squad', 'auto_turret', 'repair_wave', 'orbital_strike'].forEach((cardId) => this.drawSpecific(groupId, cardId));
        while (this.hand.length < 5) this.drawCardFromGroup(groupId, false);
      } else if (this.config.tutorial) {
        const desired = {
          vanguard: ['shield_squad', 'rifle_squad'],
          response: ['auto_turret', 'repair_wave'],
          finisher: ['orbital_strike', 'assault_mech']
        };
        RF.GROUPS.forEach((group) => {
          (desired[group.id] || []).forEach((cardId) => this.drawSpecific(group.id, cardId));
          while (this.hand.filter((item) => item.group === group.id).length < 2) this.drawCardFromGroup(group.id, false);
        });
      } else if (RF.GROUPS.length === 1) {
        const groupId = RF.GROUPS[0].id;
        for (let i = 0; i < 5; i += 1) this.drawCardFromGroup(groupId, false);
      } else {
        RF.GROUPS.forEach((group) => {
          this.drawCardFromGroup(group.id, false);
          this.drawCardFromGroup(group.id, false);
        });
      }
    }

    drawSpecific(groupId, cardId) {
      const pile = this.groupPiles[groupId];
      const index = pile.indexOf(cardId);
      if (index < 0 || this.hand.length >= 10) return false;
      pile.splice(index, 1);
      this.hand.push({ uid: `hand-${this.uid++}`, cardId, group: groupId });
      return true;
    }

    initEnemyHand() {
      for (let i = 0; i < 6; i += 1) this.drawEnemyCard();
    }

    initHazards() {
      (this.config.hazards || []).forEach((hazard, index) => {
        if (hazard.type === 'mirror') return;
        this.hazardSchedulers.push({
          ...hazard,
          index,
          nextAt: Number(hazard.startAt || hazard.every || 20),
          cycle: 0
        });
      });
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.lastFrameAt = performance.now();
      this.animationFrame = requestAnimationFrame(this.boundLoop);
      this.emitEvent('info', { title: this.config.title, text: this.config.objective || '摧毁敌方指挥核心。' });
    }

    destroy() {
      this.running = false;
      if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
      this.canvas.removeEventListener('pointermove', this.boundPointerMove);
      this.canvas.removeEventListener('pointerleave', this.boundPointerLeave);
      this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    }

    loop(now) {
      if (!this.running) return;
      const rawDelta = clamp((now - this.lastFrameAt) / 1000, 0, 0.05);
      this.lastFrameAt = now;
      if (!this.paused && !this.ended) this.update(rawDelta * this.speed);
      this.render();
      if (now - this.lastHudAt > 90) {
        this.emitState(false);
        this.lastHudAt = now;
      }
      this.animationFrame = requestAnimationFrame(this.boundLoop);
    }

    update(dt) {
      this.elapsed += dt;
      this.updateStage();
      this.updateEnergy(dt);
      this.updateDraw(dt);
      this.updateArchive(dt);
      this.updateResupply(dt);
      this.updateEnemyDraw(dt);
      this.updateAI(dt);
      this.updateBoss();
      this.updateHazards(dt);
      this.updateTimedActions();
      this.updateAuras(dt);
      this.updateEntities(dt);
      this.updateFortifications(dt);
      this.updateVisualEffects(dt);
      this.checkBattleEnd();
    }

    updateStage() {
      const stages = this.config.stages || [];
      const ratio = this.elapsed / this.duration;
      let nextIndex = 0;
      for (let i = 0; i < stages.length; i += 1) {
        if (ratio >= stages[i].at) nextIndex = i;
      }
      if (nextIndex !== this.stageIndex) {
        this.stageIndex = nextIndex;
        this.stage = stages[nextIndex];
        this.stageChangedAt = this.elapsed;
        const burst = Number(this.mods.stageEnergyBurst || 0);
        if (burst > 0) this.energy = Math.min(this.maxEnergy, this.energy + burst);
        this.emitEvent('stage', { stage: this.stage, index: this.stageIndex });
        RF.audio.play('stage');
      }
    }

    updateEnergy(dt) {
      const playerPenalty = this.elapsed < this.energySnareUntil ? 0.45 : 1;
      const playerRate = Number(this.stage.energyMultiplier || 1) / 2.8 * playerPenalty;
      const enemyRate = Number(this.stage.energyMultiplier || 1) / 2.8 * Number(this.config.ai?.energyMul || 1);
      this.energy = Math.min(this.maxEnergy, this.energy + playerRate * dt);
      this.enemyEnergy = Math.min(this.enemyMaxEnergy, this.enemyEnergy + enemyRate * dt);
    }

    currentDrawInterval() {
      const stageDraw = Number(this.stage.drawMultiplier || 1);
      return 5.6 / stageDraw / (1 + Number(this.mods.drawSpeed || 0));
    }

    updateDraw(dt) {
      if (this.elapsed < this.drawLockedUntil) return;
      if (this.hand.length >= 10 || this.resupplyTimer > 0) return;
      this.drawProgress += dt;
      const interval = this.currentDrawInterval();
      while (this.drawProgress >= interval && this.hand.length < 10 && this.resupplyTimer <= 0) {
        this.drawProgress -= interval;
        this.drawNextPlayerCard();
      }
    }

    updateArchive(dt) {
      if (this.archiveCharges >= this.archiveMax) {
        this.archiveProgress = 0;
        return;
      }
      this.archiveProgress += dt * (1 + Number(this.mods.archiveSpeed || 0));
      if (this.archiveProgress >= 11.2) {
        this.archiveProgress -= 11.2;
        this.archiveCharges += 1;
        this.emitEvent('archiveReady', { charges: this.archiveCharges });
      }
    }

    updateResupply(dt) {
      if (this.resupplyTimer <= 0) return;
      this.resupplyTimer -= dt;
      if (this.resupplyTimer > 0) return;
      this.resupplyTimer = 0;
      RF.GROUPS.forEach((group) => {
        this.groupPiles[group.id] = shuffle(this.groupDiscards[group.id]);
        this.groupDiscards[group.id] = [];
      });
      this.resupplyCount += 1;
      this.vanguardDiscountAvailable = Boolean(this.mods.firstCardDiscount || this.mods.vanguardDiscount);
      this.emitEvent('resupplyComplete', { count: this.resupplyCount });
      RF.audio.play('draw');
    }

    updateEnemyDraw(dt) {
      if (this.enemyHand.length >= 6) return;
      this.enemyDrawProgress += dt;
      const interval = 5.6 / Number(this.stage.drawMultiplier || 1);
      while (this.enemyDrawProgress >= interval && this.enemyHand.length < 6) {
        this.enemyDrawProgress -= interval;
        this.drawEnemyCard();
      }
    }

    updateAI(dt) {
      this.aiThinkTimer -= dt;
      if (this.aiThinkTimer > 0) return;
      const ai = this.config.ai || {};
      const affordable = this.enemyHand
        .map((cardId, index) => ({ cardId, index, card: RF.CARDS[cardId] }))
        .filter((entry) => entry.card && entry.card.cost <= this.enemyEnergy + 0.001);

      if (!affordable.length) {
        this.aiStallTime += 0.7;
        this.aiThinkTimer = 0.65;
        return;
      }

      const threat = this.routes.map((_, route) => this.laneStrength(SIDE_PLAYER, route) - this.laneStrength(SIDE_ENEMY, route));
      const scored = affordable.map((entry) => {
        let score = Math.random() * 1.4;
        const { card } = entry;
        const maxThreat = Math.max(...threat, 0);
        if (card.type === 'building' && maxThreat > 120) score += 2.4;
        if (card.type === 'unit') score += Number(card.cost || 0) * 0.16;
        if (card.unit?.heavy && this.enemyEnergy >= 6) score += 1.1;
        if (this.aiStallTime > 2.5) score += (5 - card.cost) * 0.12;
        if (card.building?.role === 'hospital' && this.entities.some((entity) => entity.side === SIDE_ENEMY && entity.hp < entity.maxHp * 0.65)) score += 1.7;
        return { ...entry, score };
      }).sort((a, b) => b.score - a.score);

      const choice = scored[0];
      const lane = this.chooseAILane(choice.card, threat);
      const zone = this.getDeployZone(SIDE_ENEMY);
      const routeY = this.routePointAtX(lane, choice.card.type === 'building' ? 970 : 1080).y;
      let x = choice.card.type === 'building' ? randomBetween(Math.max(zone.minX, 875), Math.min(zone.maxX, 1090)) : randomBetween(Math.max(zone.minX, 945), Math.min(zone.maxX, 1125));
      let y = clamp(routeY + randomBetween(-92, 92), FIELD.top + 24, FIELD.bottom - 24);
      const point = this.findOpenPoint(x, y, Number(choice.card.building?.radius || choice.card.unit?.radius || 14) + 5, SIDE_ENEMY);
      x = point.x;
      y = point.y;

      this.enemyEnergy -= choice.card.cost;
      this.enemyHand.splice(choice.index, 1);
      this.enemyDiscard.push(choice.cardId);
      this.playCardEffect(SIDE_ENEMY, choice.cardId, lane, x, { source: 'ai', y });
      this.aiStallTime = 0;
      this.aiThinkTimer = randomBetween(Number(ai.thinkMin || 1.8), Number(ai.thinkMax || 3.0));
    }
    chooseAILane(card, threat) {
      if (!this.routeCount) return 0;
      if (card.type === 'building') {
        let best = 0;
        threat.forEach((value, index) => { if (value > threat[best]) best = index; });
        return best;
      }
      const outposts = this.forts.playerOutposts;
      const weakness = outposts.map((fort, lane) => {
        const hpRatio = fort.alive ? fort.hp / fort.maxHp : 0;
        const playerStrength = this.laneStrength(SIDE_PLAYER, lane);
        return (1 - hpRatio) * 220 - playerStrength * 0.14 + Math.random() * 40;
      });
      const aggression = Number(this.config.ai?.aggression || 0.5);
      if (Math.random() > aggression && Math.max(...threat, 0) > 80) {
        return threat.reduce((best, value, index) => value > threat[best] ? index : best, 0);
      }
      return weakness.reduce((best, value, index) => value > weakness[best] ? index : best, 0);
    }
    drawEnemyCard() {
      if (!this.enemyPile.length) {
        this.enemyPile = shuffle(this.enemyDiscard.length ? this.enemyDiscard : (this.config.enemyDeck || ['enemy_scrapper']));
        this.enemyDiscard = [];
      }
      const cardId = this.enemyPile.shift();
      if (cardId) this.enemyHand.push(cardId);
    }

    drawNextPlayerCard() {
      if (this.hand.length >= 10) return false;
      if (this.groupPiles[this.activeGroup].length) return this.drawCardFromGroup(this.activeGroup, true);

      const available = RF.GROUPS.find((group) => this.groupPiles[group.id].length > 0);
      if (available) {
        this.activeGroup = available.id;
        this.emitEvent('autoSupply', { group: available });
        return this.drawCardFromGroup(available.id, true);
      }

      this.beginResupply();
      return false;
    }

    drawCardFromGroup(groupId, audible = true) {
      const pile = this.groupPiles[groupId];
      if (!pile || !pile.length || this.hand.length >= 10) return false;
      const cardId = pile.shift();
      this.hand.push({ uid: `hand-${this.uid++}`, cardId, group: groupId });
      if (audible) RF.audio.play('draw');
      return true;
    }

    beginResupply() {
      if (this.resupplyTimer > 0) return;
      const hasDiscard = RF.GROUPS.some((group) => this.groupDiscards[group.id].length > 0);
      if (!hasDiscard) return;
      this.resupplyTimer = this.resupplyDuration;
      this.drawProgress = 0;
      this.emitEvent('resupply', { duration: this.resupplyDuration });
    }

    updateBoss() {
      const boss = this.config.boss;
      if (!boss || this.bossSpawned || this.elapsed / this.duration < Number(boss.atRatio || 0.5)) return;
      this.bossSpawned = true;
      const lane = this.resolveBossLane(boss.lane);
      const card = RF.CARDS[boss.cardId];
      const x = card?.type === 'building' ? 1025 : 1080;
      const y = this.routePointAtX(lane, x).y + randomBetween(-34, 34);
      this.playCardEffect(SIDE_ENEMY, boss.cardId, lane, x, { source: 'boss', y });
      const bossEntity = this.entities.find((entity) => entity.alive && entity.side === SIDE_ENEMY && entity.cardId === boss.cardId && entity.isBoss);
      if (bossEntity && boss.power) this.startBossPowerLoop(boss, bossEntity);
      this.emitEvent('boss', { title: boss.announcement || card?.name || 'Boss进入战场', cardId: boss.cardId, lane, routeName: this.routeName(lane), power: boss.powerName || boss.power });
      RF.audio.play('warning');
    }
    startBossPowerLoop(boss, bossEntity) {
      const power = boss.power;
      const interval = Number(boss.powerEvery || 16.8);
      const trigger = () => {
        if (this.ended || !bossEntity?.alive) return;
        const lane = Number.isInteger(bossEntity.lane) ? bossEntity.lane : this.resolveBossLane('weaker');
        if (power === 'iceNova') {
          this.entities.filter((entity) => entity.alive && entity.side === SIDE_PLAYER && !entity.isBuilding).forEach((entity) => {
            entity.freezeUntil = Math.max(entity.freezeUntil, this.elapsed + 1.4);
            entity.slowUntil = Math.max(entity.slowUntil, this.elapsed + 5.6);
          });
          this.createBurst(bossEntity.x, bossEntity.y, '#b9efff', 46);
          this.emitEvent('warning', { title: boss.powerName || '极寒脉冲', text: 'Boss冻结全部我方作战单位，并留下长效减速。', hazard: 'ice' });
          RF.audio.play('freeze');
        } else if (power === 'sporeBrood') {
          const spawnX = clamp(bossEntity.x - 60, 760, 1120);
          this.playCardEffect(SIDE_ENEMY, 'jungle_stalker', lane, spawnX, { source: 'bossPower', y: bossEntity.y + randomBetween(-42, 42) });
          this.playCardEffect(SIDE_ENEMY, 'spore_thrower', lane, spawnX - 16, { source: 'bossPower', y: bossEntity.y + randomBetween(-55, 55) });
          this.healTarget(bossEntity, bossEntity.maxHp * 0.045, true);
          this.emitEvent('warning', { title: boss.powerName || '孢潮繁育', text: 'Boss孵化增援并恢复少量生命。', hazard: 'jungle' });
        } else if (power === 'magmaCrash') {
          this.triggerHazard({ type: 'lava', warning: 2, duration: 5.5 });
          this.entities.filter((entity) => entity.alive && entity.side === SIDE_ENEMY && !entity.isBuilding).forEach((entity) => {
            entity.rallyUntil = Math.max(entity.rallyUntil, this.elapsed + 4.2);
          });
          this.emitEvent('warning', { title: boss.powerName || '熔核震击', text: '随机通路即将喷发，敌军同时进入短暂狂热。', hazard: 'magma' });
        } else if (power === 'shieldMatrix') {
          this.entities.filter((entity) => entity.alive && entity.side === SIDE_ENEMY).forEach((entity) => {
            entity.shield = Math.min((entity.shield || 0) + Math.max(55, entity.maxHp * 0.12), entity.maxHp * 0.6);
          });
          this.createBurst(bossEntity.x, bossEntity.y, '#85c9ff', 42);
          this.emitEvent('warning', { title: boss.powerName || '蜂巢矩阵', text: '全部敌军获得一层再生护盾。', hazard: 'steel' });
        } else if (power === 'mirrorClone') {
          const candidates = this.entities.filter((entity) => entity.alive && entity.side === SIDE_PLAYER && !entity.isBuilding && RF.CARDS[entity.cardId] && !RF.CARDS[entity.cardId].treasure);
          const source = candidates[Math.floor(Math.random() * Math.max(1, candidates.length))];
          if (source) {
            const mirrorLane = (source.lane + 1 + Math.floor(Math.random() * Math.max(1, this.routeCount - 1))) % Math.max(1, this.routeCount);
            const spawnX = clamp(1050 + randomBetween(-40, 25), 850, 1115);
            const spawnY = this.routePointAtX(mirrorLane, spawnX).y + randomBetween(-30, 30);
            this.playCardEffect(SIDE_ENEMY, source.cardId, mirrorLane, spawnX, { source: 'bossPower', y: spawnY });
            this.emitEvent('warning', { title: boss.powerName || '镜像抄录', text: `${source.name}被复制到了另一条通路。`, hazard: 'mirror' });
          }
        } else if (power === 'voidDevour') {
          this.triggerHazard({ type: 'deckDevour', warning: 2.4, duration: 0.5, count: Number(boss.devourCount || 1) });
          this.healTarget(bossEntity, bossEntity.maxHp * 0.035, false);
        } else if (power === 'timeTyranny') {
          this.triggerHazard({ type: 'timeLock', warning: 2.2, duration: Number(boss.powerDuration || 7.5) });
        } else if (power === 'gravityHeart') {
          this.triggerHazard({ type: 'gravityWell', warning: 2.8, duration: Number(boss.powerDuration || 8), radius: 210 });
        } else if (power === 'meteorCrown') {
          this.triggerHazard({ type: 'meteorStorm', warning: 2.4, duration: 0.5, hits: Number(boss.powerHits || 3), damage: Number(boss.powerDamage || 118) });
        } else if (power === 'repairProtocol') {
          this.triggerHazard({ type: 'repairProtocol', warning: 2.2, duration: 0.5, healRatio: Number(boss.healRatio || 0.11) });
        } else if (power === 'absoluteZero') {
          this.triggerHazard({ type: 'allLanesBlizzard', warning: 2.8, duration: Number(boss.powerDuration || 6.5) });
        } else if (power === 'worldBloom') {
          this.triggerHazard({ type: 'swarmBloom', warning: 2.5, duration: 0.5, waves: Number(boss.powerWaves || 3) });
        } else if (power === 'worldEruption') {
          this.triggerHazard({ type: 'lavaEruption', warning: 2.8, duration: Number(boss.powerDuration || 5.5) });
        } else if (power === 'frostCurse') {
          this.triggerHazard({ type: 'handCurse', warning: 2.2, duration: Number(boss.powerDuration || 9), amount: Number(boss.curseAmount || 1) });
        }
        this.schedule(interval, trigger);
      };
      this.schedule(Math.max(6, interval * 0.55), trigger);
    }
    resolveBossLane(rule) {
      if (Number.isInteger(rule)) return clamp(rule, 0, Math.max(0, this.routeCount - 1));
      const playerStrengths = this.routes.map((_, route) => this.laneStrength(SIDE_PLAYER, route));
      if (rule === 'weaker') return playerStrengths.reduce((best, value, index) => value < playerStrengths[best] ? index : best, 0);
      if (rule === 'stronger') return playerStrengths.reduce((best, value, index) => value > playerStrengths[best] ? index : best, 0);
      return Math.floor(Math.random() * Math.max(1, this.routeCount));
    }
    updateHazards() {
      this.hazardSchedulers.forEach((scheduler) => {
        if (this.elapsed < scheduler.nextAt) return;
        scheduler.nextAt += Number(scheduler.every || 25);
        scheduler.cycle += 1;
        if (scheduler.type === 'coreCycle') {
          const cycleTypes = ['blizzard', 'sporePod', 'lava'];
          const type = cycleTypes[(scheduler.cycle - 1) % cycleTypes.length];
          this.triggerHazard({ ...scheduler, type });
        } else {
          this.triggerHazard(scheduler);
        }
      });
    }

    triggerHazard(hazard) {
      const lane = Math.floor(Math.random() * Math.max(1, this.routeCount));
      const warning = Number(hazard.warning || 3);
      const duration = Number(hazard.duration || 7);
      const route = this.routes[lane];
      if (hazard.type === 'blizzard') {
        const visual = { id: `hazard-${this.uid++}`, type: 'blizzard', lane, route: lane, x1: 350, x2: 930, width: Number(route?.width || 110) + 34, warningUntil: this.elapsed + warning, activeUntil: this.elapsed + warning + duration };
        this.hazardVisuals.push(visual);
        this.emitEvent('warning', { title: '暴风雪预警', text: `${this.routeName(lane)}将在${warning.toFixed(0)}秒后被寒潮覆盖。`, lane, hazard: 'ice' });
        RF.audio.play('warning');
      } else if (hazard.type === 'lava') {
        const center = randomBetween(565, 715);
        const visual = { id: `hazard-${this.uid++}`, type: 'lava', lane, route: lane, x1: center - 210, x2: center + 210, width: Number(route?.width || 105) + 22, warningUntil: this.elapsed + warning, activeUntil: this.elapsed + warning + duration };
        this.hazardVisuals.push(visual);
        this.emitEvent('warning', { title: '岩浆喷发预警', text: `${this.routeName(lane)}的中央区即将喷发。`, lane, hazard: 'magma' });
        RF.audio.play('warning');
      } else if (hazard.type === 'sporePod') {
        const x = randomBetween(525, 755);
        const y = this.routePointAtX(lane, x).y + randomBetween(-24, 24);
        const visual = { id: `hazard-${this.uid++}`, type: 'sporeWarning', lane, x, y, radius: 56, warningUntil: this.elapsed + warning, activeUntil: this.elapsed + warning + 0.4 };
        this.hazardVisuals.push(visual);
        this.schedule(warning, () => this.spawnSporePod(lane, x, duration, y));
        this.emitEvent('warning', { title: '孢子囊萌发', text: `${this.routeName(lane)}附近即将长出孢子囊。`, lane, hazard: 'jungle' });
        RF.audio.play('warning');
      } else if (hazard.type === 'shieldPulse') {
        this.emitEvent('warning', { title: '蜂巢护盾充能', text: '敌军将在短暂预警后获得护盾。', hazard: 'steel' });
        this.schedule(warning, () => {
          this.entities.filter((entity) => entity.side === SIDE_ENEMY && entity.alive).forEach((entity) => {
            entity.shield = Math.min((entity.shield || 0) + 75, entity.maxHp * 0.55);
          });
          this.forts.enemyOutposts.filter((fort) => fort.alive).forEach((fort) => { fort.shield = Math.min((fort.shield || 0) + 80, 160); });
          this.createBurst(1020, 360, '#ff7faf', 28);
          this.emitEvent('info', { title: '护盾脉冲', text: '敌方阵线获得临时护盾。' });
        });
        RF.audio.play('warning');
      } else if (hazard.type === 'deckDevour') {
        const count = Math.max(1, Number(hazard.count || 1));
        this.emitEvent('warning', { title: '吞牌仪式', text: `${warning.toFixed(0)}秒后，Boss将吞噬本场牌库中的${count}张牌。`, hazard: 'void' });
        this.schedule(warning, () => {
          const removed = [];
          const groupId = RF.GROUPS?.[0]?.id || this.activeGroup;
          const pile = this.groupPiles[groupId] || [];
          const discard = this.groupDiscards[groupId] || [];
          for (let i = 0; i < count; i += 1) {
            const source = pile.length ? pile : discard;
            if (!source.length) break;
            const index = Math.floor(Math.random() * source.length);
            const [cardId] = source.splice(index, 1);
            if (cardId) removed.push(RF.CARDS[cardId]?.name || cardId);
          }
          this.createBurst(640, 360, '#a75cff', 34);
          this.emitEvent('info', { title: '牌库被吞噬', text: removed.length ? `失去：${removed.join('、')}` : 'Boss没有找到可以吞噬的牌。' });
        });
        RF.audio.play('warning');
      } else if (hazard.type === 'timeLock') {
        this.emitEvent('warning', { title: '时间封锁', text: `${warning.toFixed(0)}秒后，抽牌暂停且费用恢复减慢。`, hazard: 'mirror' });
        this.schedule(warning, () => {
          this.drawLockedUntil = Math.max(this.drawLockedUntil, this.elapsed + duration);
          this.energySnareUntil = Math.max(this.energySnareUntil, this.elapsed + duration);
          shuffle(this.entities.filter((entity) => entity.alive && entity.side === SIDE_PLAYER && !entity.isBuilding)).slice(0, 4).forEach((entity) => {
            entity.freezeUntil = Math.max(entity.freezeUntil, this.elapsed + Math.min(3.2, duration));
          });
          this.createBurst(640, 360, '#c59aff', 38);
          this.emitEvent('info', { title: '时间债务生效', text: `${duration.toFixed(0)}秒内无法自然抽牌，费用恢复仅剩45%。` });
        });
        RF.audio.play('warning');
      } else if (hazard.type === 'handCurse') {
        const amount = Math.max(1, Number(hazard.amount || 1));
        this.emitEvent('warning', { title: '霜印诅咒', text: `${warning.toFixed(0)}秒后，所有手牌费用临时提高${amount}点。`, hazard: 'ice' });
        this.schedule(warning, () => {
          this.costCurseAmount = amount;
          this.costCurseUntil = Math.max(this.costCurseUntil, this.elapsed + duration);
          this.createBurst(230, 620, '#bfeeff', 28);
          this.emitEvent('info', { title: '霜印覆盖手牌', text: `${duration.toFixed(0)}秒内所有卡牌费用 +${amount}。` });
        });
        RF.audio.play('warning');
      } else if (hazard.type === 'gravityWell') {
        const x = Number(hazard.x || 640);
        const y = Number(hazard.y || 360);
        const radius = Number(hazard.radius || 205);
        this.hazardVisuals.push({ id: `hazard-${this.uid++}`, type: 'gravityWell', x, y, radius, warningUntil: this.elapsed + warning, activeUntil: this.elapsed + warning + duration });
        this.emitEvent('warning', { title: '引力井成形', text: '中央区域将牵引并灼伤靠近的友军。', hazard: 'void' });
        RF.audio.play('warning');
      } else if (hazard.type === 'meteorStorm') {
        const targetCount = Math.max(2, Number(hazard.hits || 3));
        const candidates = shuffle(this.entities.filter((entity) => entity.alive && entity.side === SIDE_PLAYER && !entity.isBuilding));
        const positions = [];
        for (let i = 0; i < targetCount; i += 1) {
          const entity = candidates[i];
          if (entity) positions.push({ x: entity.x, y: entity.y, lane: entity.lane });
          else {
            const hitLane = Math.floor(Math.random() * Math.max(1, this.routeCount));
            const hitX = randomBetween(250, 780);
            positions.push({ x: hitX, y: this.routePointAtX(hitLane, hitX).y, lane: hitLane });
          }
        }
        positions.forEach((position, index) => {
          const delay = warning + index * 0.28;
          const radius = Number(hazard.radius || 82);
          this.hazardVisuals.push({ id: `meteor-${this.uid++}`, type: 'orbitalTarget', lane: position.lane, x: position.x, y: position.y, radius, warningUntil: this.elapsed + delay, activeUntil: this.elapsed + delay + 0.35 });
          this.schedule(delay, () => {
            this.getTargetsAround(position.x, position.y, SIDE_PLAYER, position.lane, radius).forEach((target) => this.applyDamage(target, Number(hazard.damage || 115), null, { hazard: true }));
            this.createBurst(position.x, position.y, '#ff9c55', 30);
            RF.audio.play('boom');
          });
        });
        this.emitEvent('warning', { title: '星火陨落', text: `${positions.length}处友军阵地已被Boss锁定。`, hazard: 'magma' });
        RF.audio.play('warning');
      } else if (hazard.type === 'mirrorRaid') {
        this.emitEvent('warning', { title: '镜面窃取', text: 'Boss将复制你最近使用的一张单位牌。', hazard: 'mirror' });
        this.schedule(warning, () => {
          let cardId = this.lastPlayerCard?.cardId;
          let card = RF.CARDS[cardId];
          if (!card || (card.type !== 'unit' && card.type !== 'building') || card.treasure) {
            const candidate = shuffle(this.entities.filter((entity) => entity.alive && entity.side === SIDE_PLAYER && entity.cardId)).find((entity) => RF.CARDS[entity.cardId]?.type === 'unit');
            cardId = candidate?.cardId;
            card = RF.CARDS[cardId];
          }
          if (card) {
            const mirrorLane = Math.floor(Math.random() * Math.max(1, this.routeCount));
            const mirrorX = randomBetween(990, 1100);
            const mirrorY = this.routePointAtX(mirrorLane, mirrorX).y + randomBetween(-38, 38);
            this.playCardEffect(SIDE_ENEMY, cardId, mirrorLane, mirrorX, { source: 'bossMirror', y: mirrorY });
            this.createBurst(mirrorX, mirrorY, '#d88cff', 26);
            this.emitEvent('info', { title: '镜像军团降临', text: `Boss复制了${card.name}。` });
          }
        });
        RF.audio.play('warning');
      } else if (hazard.type === 'repairProtocol') {
        this.emitEvent('warning', { title: '母炉自修协议', text: '敌方核心、前哨与机械单位即将恢复生命并获得护盾。', hazard: 'steel' });
        this.schedule(warning, () => {
          [this.forts.enemyCore, ...this.forts.enemyOutposts].filter((fort) => fort.alive).forEach((fort) => {
            this.healTarget(fort, fort.maxHp * Number(hazard.healRatio || 0.12), true);
            fort.shield = Math.min((fort.shield || 0) + 100, 220);
          });
          this.entities.filter((entity) => entity.alive && entity.side === SIDE_ENEMY).forEach((entity) => {
            this.healTarget(entity, entity.maxHp * 0.16, false);
            entity.shield = Math.min((entity.shield || 0) + 55, entity.maxHp * 0.5);
          });
          this.createBurst(1080, 360, '#ff8caf', 38);
          this.emitEvent('info', { title: '自修完成', text: '敌方阵线重新封装并获得护盾。' });
        });
        RF.audio.play('warning');
      } else if (hazard.type === 'swarmBloom') {
        this.emitEvent('warning', { title: '狂野萌发', text: '多处孢子囊与猎袭群即将同时出现。', hazard: 'jungle' });
        this.schedule(warning, () => {
          const waves = Math.max(2, Number(hazard.waves || 3));
          for (let i = 0; i < waves; i += 1) {
            const spawnLane = i % Math.max(1, this.routeCount);
            const spawnX = randomBetween(760, 980);
            const spawnY = this.routePointAtX(spawnLane, spawnX).y + randomBetween(-45, 45);
            this.playCardEffect(SIDE_ENEMY, i % 2 ? 'spore_thrower' : 'jungle_stalker', spawnLane, spawnX, { source: 'bossBloom', y: spawnY });
            if (i < 2) this.spawnSporePod(spawnLane, randomBetween(540, 740), 12);
          }
          this.emitEvent('info', { title: '生态暴长', text: '新的敌军从战场缝隙中孵化。' });
        });
        RF.audio.play('warning');
      } else if (hazard.type === 'allLanesBlizzard') {
        this.routes.forEach((routeItem, routeIndex) => {
          this.hazardVisuals.push({ id: `hazard-${this.uid++}`, type: 'blizzard', lane: routeIndex, route: routeIndex, x1: 300, x2: 980, width: Number(routeItem?.width || 110) + 42, warningUntil: this.elapsed + warning, activeUntil: this.elapsed + warning + duration });
        });
        this.emitEvent('warning', { title: '绝对零度', text: '所有中央通路将同时被暴风雪覆盖。', hazard: 'ice' });
        RF.audio.play('warning');
      } else if (hazard.type === 'lavaEruption') {
        this.routes.forEach((routeItem, routeIndex) => {
          const center = randomBetween(560, 720);
          this.hazardVisuals.push({ id: `hazard-${this.uid++}`, type: 'lava', lane: routeIndex, route: routeIndex, x1: center - 185, x2: center + 185, width: Number(routeItem?.width || 105) + 30, warningUntil: this.elapsed + warning, activeUntil: this.elapsed + warning + duration });
        });
        this.emitEvent('warning', { title: '熔界总喷发', text: '每一条通路都将被岩浆同时切断。', hazard: 'magma' });
        RF.audio.play('warning');
      }
    }
    spawnSporePod(lane, x, duration, y = null) {
      const hp = 190 * Number(this.config.ai?.hpMul || 1);
      const spawnY = y == null ? this.routePointAtX(lane, x).y : y;
      const entity = {
        id: `entity-${this.uid++}`,
        cardId: 'spore_pod_hazard',
        name: '孢子囊',
        icon: '✾',
        side: SIDE_ENEMY,
        lane,
        x,
        y: spawnY,
        hp,
        maxHp: hp,
        shield: 0,
        radius: 24,
        damage: 0,
        speed: 0,
        range: 0,
        cooldown: 999,
        cooldownRemaining: 999,
        role: 'sporePod',
        isBuilding: true,
        alive: true,
        expiresAt: this.elapsed + duration,
        hatchCard: 'jungle_stalker',
        color: '#8edf6c',
        armor: 0,
        auraAttackBonus: 0,
        statuses: {},
        facing: Math.PI,
        sprite: 'sporePod'
      };
      this.entities.push(entity);
      this.createBurst(x, spawnY, '#7bda75', 18);
    }
    schedule(delay, fn) {
      this.timedActions.push({ at: this.elapsed + delay, fn });
    }

    updateTimedActions() {
      if (!this.timedActions.length) return;
      const ready = this.timedActions.filter((action) => action.at <= this.elapsed);
      this.timedActions = this.timedActions.filter((action) => action.at > this.elapsed);
      ready.forEach((action) => {
        try { action.fn(); } catch (error) { console.error('[Riftfront] Timed action failed.', error); }
      });
    }

    updateAuras(dt) {
      this.entities.forEach((entity) => {
        entity.auraAttackBonus = 0;
        entity.auraSlow = 0;
      });

      const activeBuildings = this.entities.filter((entity) => entity.alive && entity.isBuilding);
      activeBuildings.forEach((building) => {
        const inAura = (entity, range) => Math.hypot(entity.x - building.x, entity.y - building.y) <= range + entity.radius;
        if (building.role === 'hospital') {
          this.entities.forEach((ally) => {
            if (!ally.alive || ally.side !== building.side) return;
            if (inAura(ally, Number(building.auraRange || 150))) this.healTarget(ally, Number(building.healPerSecond || 8) * dt, false);
          });
        }
        if (building.role === 'beacon') {
          this.entities.forEach((ally) => {
            if (!ally.alive || ally.side !== building.side) return;
            if (inAura(ally, Number(building.auraRange || 165))) ally.auraAttackBonus = Math.max(ally.auraAttackBonus, Number(building.attackSpeedAura || 0.2));
          });
          if (building.shieldPulse && this.elapsed >= (building.nextShieldPulse || 0)) {
            building.nextShieldPulse = this.elapsed + 5.6;
            this.entities.forEach((ally) => {
              if (!ally.alive || ally.side !== building.side) return;
              if (inAura(ally, Number(building.auraRange || 165))) ally.shield = Math.min((ally.shield || 0) + building.shieldPulse, ally.maxHp * 0.5);
            });
          }
        }
        if (building.role === 'blizzard') {
          this.entities.forEach((enemy) => {
            if (!enemy.alive || enemy.side === building.side) return;
            if (inAura(enemy, Number(building.auraRange || 200))) enemy.auraSlow = Math.max(enemy.auraSlow, Number(building.slowAura || 0.22));
          });
        }
        if (building.role === 'bossSpawner' && building.healPerSecond) this.healTarget(building, Number(building.healPerSecond) * dt, false);
      });
    }
    updateEntities(dt) {
      const snapshot = [...this.entities];
      snapshot.forEach((entity) => {
        if (!entity.alive) return;
        entity.moving = false;

        if (entity.expiresAt && this.elapsed >= entity.expiresAt) {
          if (entity.role === 'sporePod' && entity.hatchCard) {
            this.playCardEffect(SIDE_ENEMY, entity.hatchCard, entity.lane, entity.x + 24, { source: 'hatch', y: entity.y - 18 });
            this.playCardEffect(SIDE_ENEMY, entity.hatchCard, entity.lane, entity.x + 2, { source: 'hatch', y: entity.y + 18 });
            this.emitEvent('info', { title: '孢子囊孵化', text: `${this.routeName(entity.lane)}出现了伏击群。` });
          }
          this.killEntity(entity, null, { expired: true });
          return;
        }

        if (entity.spawnCard && entity.spawnEvery && this.elapsed >= (entity.nextSpawnAt || 0)) {
          entity.nextSpawnAt = this.elapsed + entity.spawnEvery;
          const spawnX = entity.x + (entity.side === SIDE_PLAYER ? 30 : -30);
          const spawnY = entity.y + randomBetween(-26, 26);
          this.playCardEffect(entity.side, entity.spawnCard, entity.lane, spawnX, { source: 'spawner', y: spawnY });
        }

        if (this.mods.passiveHeal && entity.side === SIDE_PLAYER) this.healTarget(entity, entity.maxHp * Number(this.mods.passiveHeal) * dt, false);
        if (entity.poisonUntil > this.elapsed) this.applyDamage(entity, Number(entity.poisonDps || 0) * dt, null, { silent: true, ignoreShield: false });

        const hazardMod = this.getHazardModifier(entity, dt);
        if (!entity.alive) return;
        if (entity.freezeUntil > this.elapsed) return;

        const rallyActive = entity.rallyUntil > this.elapsed;
        const slowActive = entity.slowUntil > this.elapsed;
        const speedMul = (1 + Number(entity.moveSpeedBonus || 0) + (rallyActive ? 0.25 : 0))
          * (1 - (slowActive ? 0.38 : 0))
          * (1 - Number(entity.auraSlow || 0))
          * hazardMod.speedMul;
        const attackSpeedMul = (1 + Number(entity.auraAttackBonus || 0)) * (rallyActive ? 1.25 : 1) * hazardMod.attackMul;
        entity.cooldownRemaining -= dt * Math.max(0.1, attackSpeedMul);

        if (entity.role === 'healer') {
          const target = this.findHealTarget(entity);
          if (target) {
            const distance = this.distanceToTarget(entity, target);
            if (entity.cooldownRemaining <= 0 && distance <= entity.range + target.radius && (entity.flying || !this.isLineBlocked(entity.x, entity.y, target.x, target.y, 4))) {
              this.healTarget(target, entity.heal, true, entity);
              entity.cooldownRemaining = entity.cooldown;
              entity.facing = Math.atan2(target.y - entity.y, target.x - entity.x);
            } else if (!entity.isBuilding) {
              this.moveEntityToward(entity, target.x, target.y, dt, speedMul);
            }
          } else if (!entity.isBuilding) {
            this.advanceEntity(entity, dt, speedMul);
          }
          return;
        }

        if (entity.isBuilding && !entity.damage) return;
        const target = this.findCombatTarget(entity);
        if (!target) {
          if (!entity.isBuilding) this.advanceEntity(entity, dt, speedMul);
          return;
        }

        const distance = this.distanceToTarget(entity, target);
        const maxRange = Number(entity.range || 25) + Number(target.radius || 12);
        const minRange = Number(entity.minRange || 0);
        const clearShot = entity.flying || !this.isLineBlocked(entity.x, entity.y, target.x, target.y, Math.min(7, entity.radius * 0.35));
        if (distance <= maxRange && distance >= minRange && clearShot) {
          if (entity.cooldownRemaining <= 0) {
            this.performAttack(entity, target);
            entity.cooldownRemaining = entity.cooldown;
          }
        } else if (!entity.isBuilding) {
          if (distance < minRange) {
            const awayX = entity.x - (target.x - entity.x);
            const awayY = entity.y - (target.y - entity.y);
            this.moveEntityToward(entity, awayX, awayY, dt, speedMul * 0.68);
          } else if (!target.kind && distance < Number(entity.pursuitRange || Math.max(230, entity.range + 125)) && clearShot) {
            this.moveEntityToward(entity, target.x, target.y, dt, speedMul);
          } else {
            this.advanceEntity(entity, dt, speedMul);
          }
        }
      });

      this.entities = this.entities.filter((entity) => entity.alive || this.elapsed - Number(entity.diedAt || 0) < 0.5);
    }
    getHazardModifier(entity, dt) {
      let speedMul = 1;
      let attackMul = 1;
      this.hazardVisuals.forEach((hazard) => {
        if (this.elapsed < hazard.warningUntil || this.elapsed > hazard.activeUntil) return;
        if ((hazard.type === 'blizzard' || hazard.type === 'lava') && !this.pointInRouteHazard(entity.x, entity.y, hazard)) return;
        if (hazard.type === 'blizzard') {
          speedMul *= 0.52;
          attackMul *= 0.78;
        } else if (hazard.type === 'lava') {
          const resistant = entity.cardId && (entity.cardId.startsWith('magma_') || entity.cardId.includes('obsidian') || entity.cardId.includes('furnace') || entity.cardId.includes('lava_') || entity.cardId.includes('boss_magma'));
          this.applyDamage(entity, (resistant ? 7 : 25) * dt, null, { silent: true, hazard: true });
        } else if (hazard.type === 'gravityWell' && entity.side === SIDE_PLAYER && !entity.isBuilding) {
          const distance = Math.hypot(entity.x - hazard.x, entity.y - hazard.y);
          if (distance <= Number(hazard.radius || 205) + entity.radius) {
            speedMul *= 0.42;
            attackMul *= 0.82;
            const pull = Math.min(22 * dt, Math.max(0, distance - 18));
            if (distance > 1) {
              entity.x += (hazard.x - entity.x) / distance * pull;
              entity.y += (hazard.y - entity.y) / distance * pull;
            }
            this.applyDamage(entity, 10 * dt, null, { silent: true, hazard: true });
          }
        }
      });
      return { speedMul, attackMul };
    }
    advanceEntity(entity, dt, speedMul) {
      if (!entity.speed || !this.routeCount) return;
      const lane = clamp(Number(entity.lane || 0), 0, this.routeCount - 1);
      entity.lane = lane;
      const route = this.routes[lane];
      const points = route.points;
      const direction = entity.side === SIDE_PLAYER ? 1 : -1;
      if (!Number.isInteger(entity.waypointIndex)) entity.waypointIndex = this.initialWaypointIndex(lane, entity.x, entity.side);

      let index = entity.waypointIndex;
      let waypoint = points[index];
      let guard = 0;
      while (waypoint && Math.hypot(waypoint.x - entity.x, waypoint.y - entity.y) < Math.max(26, entity.radius + 12) && guard < points.length + 1) {
        index += direction;
        waypoint = points[index];
        guard += 1;
      }
      entity.waypointIndex = index;
      if (!waypoint) {
        const goal = this.getLaneGoal(entity.side, lane);
        waypoint = { x: goal.x, y: goal.y };
      }
      this.moveEntityToward(entity, waypoint.x, waypoint.y, dt, speedMul);
    }
    findHealTarget(healer) {
      const searchRange = Number(healer.range || 120) + 120;
      const candidates = this.entities.filter((entity) => entity.alive && entity.side === healer.side && entity.id !== healer.id && entity.hp < entity.maxHp * 0.98 && Math.hypot(entity.x - healer.x, entity.y - healer.y) <= searchRange + entity.radius);
      if (!candidates.length) return null;
      candidates.sort((a, b) => ((a.hp / a.maxHp) - (b.hp / b.maxHp)) || (Math.hypot(a.x - healer.x, a.y - healer.y) - Math.hypot(b.x - healer.x, b.y - healer.y)));
      return candidates[0];
    }
    findCombatTarget(entity) {
      const vision = entity.isBuilding ? Number(entity.range || 0) + 32 : Math.max(235, Number(entity.range || 25) + 135, entity.role === 'siege' ? 355 : 0);
      const direction = entity.side === SIDE_PLAYER ? 1 : -1;
      const enemies = this.entities.filter((other) => {
        if (!other.alive || other.side === entity.side) return false;
        const distance = Math.hypot(other.x - entity.x, other.y - entity.y);
        if (distance > vision + other.radius) return false;
        if (!entity.flying && this.isLineBlocked(entity.x, entity.y, other.x, other.y, Math.min(6, entity.radius * 0.3))) return false;
        return true;
      });
      if (enemies.length) {
        enemies.sort((a, b) => {
          const da = Math.hypot(a.x - entity.x, a.y - entity.y) - (a.lane === entity.lane ? 38 : 0) - (((a.x - entity.x) * direction) >= -8 ? 16 : 0);
          const db = Math.hypot(b.x - entity.x, b.y - entity.y) - (b.lane === entity.lane ? 38 : 0) - (((b.x - entity.x) * direction) >= -8 ? 16 : 0);
          return da - db;
        });
        return enemies[0];
      }
      return this.getLaneGoal(entity.side, entity.lane);
    }
    getLaneGoal(side, lane) {
      const safeLane = clamp(Number(lane || 0), 0, Math.max(0, this.routeCount - 1));
      const enemyOutpost = side === SIDE_PLAYER ? this.forts.enemyOutposts[safeLane] : this.forts.playerOutposts[safeLane];
      if (enemyOutpost?.alive) return enemyOutpost;
      return side === SIDE_PLAYER ? this.forts.enemyCore : this.forts.playerCore;
    }
    distanceToTarget(entity, target) {
      return Math.hypot(Number(target.x || 0) - entity.x, Number(target.y || 0) - entity.y);
    }
    performAttack(attacker, target) {
      let damage = Number(attacker.damage || 0);
      if (!damage) return;
      if (attacker.firstAttack && attacker.chargeBonus) {
        damage += attacker.chargeBonus;
        attacker.firstAttack = false;
      }
      if (attacker.bonusVsHeavy && target.heavy) damage *= 1 + attacker.bonusVsHeavy;
      if (attacker.bonusVsBuilding && (target.isBuilding || target.kind)) damage *= 1 + attacker.bonusVsBuilding;
      if (attacker.rallyUntil > this.elapsed) damage *= 1.25;

      attacker.facing = Math.atan2(target.y - attacker.y, target.x - attacker.x);
      attacker.attackFlashUntil = this.elapsed + (attacker.heavy ? 0.18 : 0.11);
      const projectileDuration = attacker.projectile ? clamp(this.distanceToTarget(attacker, target) / 650, 0.12, 0.42) : 0.08;
      this.projectiles.push({
        id: `projectile-${this.uid++}`,
        x1: attacker.x,
        y1: attacker.y,
        x2: target.x,
        y2: target.y,
        color: attacker.side === SIDE_PLAYER ? '#92eaff' : '#ff9a8a',
        start: this.elapsed,
        end: this.elapsed + projectileDuration,
        thick: attacker.heavy ? 4 : 2,
        arc: attacker.role === 'siege'
      });

      this.applyDamage(target, damage, attacker);
      if (attacker.aoe) {
        const splashTargets = this.getTargetsAround(target.x, target.y, attacker.side === SIDE_PLAYER ? SIDE_ENEMY : SIDE_PLAYER, attacker.lane, attacker.aoe);
        splashTargets.forEach((other) => {
          if (other.id !== target.id) this.applyDamage(other, damage * 0.62, attacker, { splash: true });
        });
      }
      if (attacker.chill && target.alive !== false) {
        target.chillStacks = Number(target.chillStacks || 0) + attacker.chill;
        if (target.chillStacks >= 3) {
          target.chillStacks = 0;
          target.freezeUntil = Math.max(Number(target.freezeUntil || 0), this.elapsed + 2.8);
          target.slowUntil = Math.max(Number(target.slowUntil || 0), this.elapsed + 7);
          RF.audio.play('freeze');
        }
      }
      if (attacker.poison && target.alive !== false) {
        target.poisonUntil = this.elapsed + 5;
        target.poisonDps = Math.max(Number(target.poisonDps || 0), attacker.poison);
      }
      if (attacker.lifeSteal) this.healTarget(attacker, damage * attacker.lifeSteal, false);
      RF.audio.play(attacker.heavy ? 'boom' : 'hit');
    }
    getTargetsAround(x, y, side, lane, radius) {
      const entityTargets = this.entities.filter((entity) => entity.alive && entity.side === side && Math.hypot(entity.x - x, entity.y - y) <= radius + entity.radius);
      const forts = side === SIDE_PLAYER
        ? [this.forts.playerCore, ...this.forts.playerOutposts]
        : [this.forts.enemyCore, ...this.forts.enemyOutposts];
      return entityTargets.concat(forts.filter((fort) => fort.alive && Math.hypot(fort.x - x, fort.y - y) <= radius + fort.radius));
    }
    applyDamage(target, amount, source, options = {}) {
      if (!target || target.alive === false || amount <= 0) return 0;
      let damage = amount;
      const armor = clamp(Number(target.armor || 0) + (target.kind ? 0.05 : 0), 0, 0.65);
      damage *= 1 - armor;
      if (target.kind === 'core' && source && source.spellSource) damage *= 0.38;

      if (!options.ignoreShield && target.shield > 0) {
        const absorbed = Math.min(target.shield, damage);
        target.shield -= absorbed;
        damage -= absorbed;
      }
      if (damage <= 0) return 0;

      target.hp -= damage;
      if (source?.side === SIDE_PLAYER) this.battleStats.damageDealt += damage;
      if (target.side === SIDE_PLAYER) this.battleStats.damageTaken += damage;

      if (!options.silent && damage >= 8) this.addFloatingText(target.x, target.y || 360, `-${Math.round(damage)}`, target.side === SIDE_PLAYER ? '#ff9b8f' : '#ffe09a');
      if (target.hp <= 0) {
        target.hp = 0;
        if (target.kind) this.destroyFort(target, source);
        else this.killEntity(target, source);
      }
      return damage;
    }

    healTarget(target, amount, show = false, source = null) {
      if (!target || target.alive === false || amount <= 0 || target.hp >= target.maxHp) return 0;
      const healed = Math.min(amount, target.maxHp - target.hp);
      target.hp += healed;
      if (show && healed >= 3) {
        this.addFloatingText(target.x, target.y || 360, `+${Math.round(healed)}`, '#70ffc3');
        if (source) this.projectiles.push({ id: `heal-${this.uid++}`, x1: source.x, y1: source.y, x2: target.x, y2: target.y, color: '#70ffc3', start: this.elapsed, end: this.elapsed + 0.24, thick: 2, arc: true });
      }
      return healed;
    }

    killEntity(entity, source, options = {}) {
      if (!entity.alive) return;
      entity.alive = false;
      entity.diedAt = this.elapsed;
      this.createBurst(entity.x, entity.y, entity.color || '#ffffff', entity.isBoss ? 36 : 12);
      if (entity.deathBurst && !options.expired) {
        const targets = this.getTargetsAround(entity.x, entity.y, entity.side === SIDE_PLAYER ? SIDE_ENEMY : SIDE_PLAYER, entity.lane, 72);
        targets.forEach((target) => this.applyDamage(target, entity.deathBurst, entity, { splash: true }));
        RF.audio.play('boom');
      }
      if (entity.isBoss) this.emitEvent('bossDefeated', { title: `${entity.name}已被击破`, text: '敌方战线出现短暂空档。' });
    }

    destroyFort(fort, source) {
      if (!fort.alive) return;
      fort.alive = false;
      this.createBurst(fort.x, fort.y, fort.side === SIDE_PLAYER ? '#6dd8ff' : '#ff846f', fort.kind === 'core' ? 54 : 32);
      RF.audio.play('boom');
      if (fort.kind === 'outpost') {
        const defenderEnergy = fort.side === SIDE_PLAYER ? 'energy' : 'enemyEnergy';
        const max = fort.side === SIDE_PLAYER ? this.maxEnergy : this.enemyMaxEnergy;
        this[defenderEnergy] = Math.min(max, this[defenderEnergy] + 2);
        if (source?.side === SIDE_PLAYER) this.battleStats.outpostsDestroyed += 1;
        if (fort.side === SIDE_ENEMY && this.tutorialGoals) {
          this.tutorialGoals.destroyedOutpost = true;
          this.checkTutorialComplete();
        }
        this.emitEvent('outpost', { side: fort.side, lane: fort.lane, title: fort.side === SIDE_ENEMY ? '敌方前哨已摧毁' : '我方前哨失守', text: '防守方获得2点紧急费用。' });
      }
    }

    updateFortifications(dt) {
      const forts = [this.forts.playerCore, this.forts.enemyCore, ...this.forts.playerOutposts, ...this.forts.enemyOutposts];
      forts.forEach((fort) => {
        if (!fort.alive) return;
        fort.cooldownRemaining -= dt;
        if (fort.cooldownRemaining > 0) return;
        const candidates = this.entities.filter((entity) => {
          if (!entity.alive || entity.side === fort.side) return false;
          return Math.hypot(entity.x - fort.x, entity.y - fort.y) <= fort.range + entity.radius;
        }).sort((a, b) => Math.hypot(a.x - fort.x, a.y - fort.y) - Math.hypot(b.x - fort.x, b.y - fort.y));
        const target = candidates[0];
        if (!target) return;
        fort.facing = Math.atan2(target.y - fort.y, target.x - fort.x);
        fort.attackFlashUntil = this.elapsed + 0.13;
        this.projectiles.push({ id: `fort-shot-${this.uid++}`, x1: fort.x, y1: fort.y, x2: target.x, y2: target.y, color: fort.side === SIDE_PLAYER ? '#82ddff' : '#ff8f7c', start: this.elapsed, end: this.elapsed + 0.18, thick: 3, arc: false });
        this.applyDamage(target, fort.damage, fort);
        fort.cooldownRemaining = fort.cooldown;
      });
    }
    updateVisualEffects(dt) {
      this.projectiles = this.projectiles.filter((projectile) => projectile.end > this.elapsed);
      this.particles.forEach((particle) => {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 32 * dt;
        particle.life -= dt;
      });
      this.particles = this.particles.filter((particle) => particle.life > 0);
      this.floatingTexts.forEach((text) => {
        text.y -= 24 * dt;
        text.life -= dt;
      });
      this.floatingTexts = this.floatingTexts.filter((text) => text.life > 0);
      this.hazardVisuals = this.hazardVisuals.filter((hazard) => hazard.activeUntil > this.elapsed);
    }

    createBurst(x, y, color, count = 16) {
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = randomBetween(35, count > 30 ? 150 : 95);
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 20,
          radius: randomBetween(1.5, count > 30 ? 5 : 3.5),
          color,
          life: randomBetween(0.35, count > 30 ? 1.0 : 0.7),
          maxLife: 1
        });
      }
    }

    addFloatingText(x, y, text, color) {
      if (this.floatingTexts.length > 40) return;
      this.floatingTexts.push({ x: x + randomBetween(-8, 8), y: y - 20, text, color, life: 0.72, maxLife: 0.72 });
    }

    checkBattleEnd() {
      if (this.ended) return;
      if (!this.forts.enemyCore.alive) {
        this.finishBattle(true, '敌方核心已摧毁');
        return;
      }
      if (!this.forts.playerCore.alive) {
        this.finishBattle(false, '我方核心失守');
        return;
      }
      if (this.elapsed >= this.duration) {
        const playerRatio = this.forts.playerCore.hp / this.forts.playerCore.maxHp;
        const enemyRatio = this.forts.enemyCore.hp / this.forts.enemyCore.maxHp;
        if (Math.abs(playerRatio - enemyRatio) > 0.001) {
          this.finishBattle(playerRatio > enemyRatio, '战斗时限结束，按核心完整度判定');
          return;
        }
        const playerOutposts = this.forts.playerOutposts.filter((fort) => fort.alive).length;
        const enemyOutposts = this.forts.enemyOutposts.filter((fort) => fort.alive).length;
        this.finishBattle(playerOutposts >= enemyOutposts, '核心完整度相同，按前哨数量判定');
      }
    }

    finishBattle(victory, reason) {
      this.ended = true;
      this.selectedIndex = null;
      const remaining = Math.max(0, this.duration - this.elapsed);
      const coreRatio = this.forts.playerCore.hp / this.forts.playerCore.maxHp;
      const stars = victory ? 1 + (coreRatio >= 0.6 ? 1 : 0) + (remaining >= this.duration * 0.22 ? 1 : 0) : 0;
      const result = {
        victory,
        reason,
        stars,
        elapsed: this.elapsed,
        remaining,
        coreRatio,
        stats: { ...this.battleStats }
      };
      RF.audio.play(victory ? 'victory' : 'defeat');
      this.emitState(true);
      setTimeout(() => this.callbacks.onEnd(result), 600);
    }


    routeName(lane) {
      return this.routes[clamp(Number(lane || 0), 0, Math.max(0, this.routeCount - 1))]?.name || '未命名通路';
    }

    routePointAtX(lane, x) {
      const route = this.routes[clamp(Number(lane || 0), 0, Math.max(0, this.routeCount - 1))];
      const points = route?.points || [{ x: 250, y: 360 }, { x: 1030, y: 360 }];
      if (x <= points[0].x) return { x, y: points[0].y };
      if (x >= points[points.length - 1].x) return { x, y: points[points.length - 1].y };
      for (let i = 0; i < points.length - 1; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        if (x >= Math.min(a.x, b.x) && x <= Math.max(a.x, b.x)) {
          const t = (x - a.x) / Math.max(0.001, b.x - a.x);
          return { x, y: lerp(a.y, b.y, clamp(t, 0, 1)) };
        }
      }
      return { x, y: points[Math.floor(points.length / 2)].y };
    }

    distancePointToSegment(px, py, ax, ay, bx, by) {
      const dx = bx - ax;
      const dy = by - ay;
      const lengthSq = dx * dx + dy * dy;
      if (lengthSq <= 0.001) return Math.hypot(px - ax, py - ay);
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
      return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
    }

    distanceToRoute(lane, x, y, minX = -Infinity, maxX = Infinity) {
      const route = this.routes[clamp(Number(lane || 0), 0, Math.max(0, this.routeCount - 1))];
      if (!route) return Infinity;
      let best = Infinity;
      for (let i = 0; i < route.points.length - 1; i += 1) {
        const a = route.points[i];
        const b = route.points[i + 1];
        if (Math.max(a.x, b.x) < minX || Math.min(a.x, b.x) > maxX) continue;
        best = Math.min(best, this.distancePointToSegment(x, y, a.x, a.y, b.x, b.y));
      }
      return best;
    }

    nearestRoute(x, y) {
      if (!this.routeCount) return 0;
      let best = 0;
      let distance = Infinity;
      this.routes.forEach((route, index) => {
        const d = this.distanceToRoute(index, x, y);
        if (d < distance) {
          distance = d;
          best = index;
        }
      });
      return best;
    }

    initialWaypointIndex(lane, x, side) {
      const points = this.routes[lane]?.points || [];
      if (!points.length) return 0;
      if (side === SIDE_PLAYER) {
        const index = points.findIndex((point) => point.x > x + 24);
        return index >= 0 ? index : points.length;
      }
      for (let i = points.length - 1; i >= 0; i -= 1) {
        if (points[i].x < x - 24) return i;
      }
      return -1;
    }

    getDeployZone(side) {
      const source = this.map.deploy?.[side] || (side === SIDE_PLAYER ? { minX: 105, maxX: 470 } : { minX: 810, maxX: 1175 });
      return { minX: Number(source.minX), maxX: Number(source.maxX), minY: FIELD.top + 8, maxY: FIELD.bottom - 8 };
    }

    isInDeploymentZone(side, x, y, lane = null) {
      const zone = this.getDeployZone(side);
      if (x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY) return true;
      const outposts = side === SIDE_PLAYER ? this.forts.enemyOutposts : this.forts.playerOutposts;
      const routeIndices = lane == null ? this.routes.map((_, index) => index) : [clamp(Number(lane), 0, Math.max(0, this.routeCount - 1))];
      return routeIndices.some((routeIndex) => {
        if (outposts[routeIndex]?.alive !== false) return false;
        const forwardMin = side === SIDE_PLAYER ? zone.maxX : 575;
        const forwardMax = side === SIDE_PLAYER ? 705 : zone.minX;
        if (x < Math.min(forwardMin, forwardMax) || x > Math.max(forwardMin, forwardMax)) return false;
        const width = Number(this.routes[routeIndex]?.width || 110) * 0.62;
        return this.distanceToRoute(routeIndex, x, y, Math.min(forwardMin, forwardMax) - 40, Math.max(forwardMin, forwardMax) + 40) <= width;
      });
    }

    isPointBlocked(x, y, radius = 0) {
      if (x - radius < FIELD.left || x + radius > FIELD.right || y - radius < FIELD.top || y + radius > FIELD.bottom) return true;
      return this.obstacles.some((obstacle) => {
        if (obstacle.shape === 'circle') return Math.hypot(x - Number(obstacle.x), y - Number(obstacle.y)) < Number(obstacle.r || 0) + radius;
        const width = Number(obstacle.w || 0);
        const height = Number(obstacle.h || 0);
        const halfWidth = width * 0.5;
        const halfHeight = height * 0.5;
        const corner = clamp(Number(obstacle.radius || 0), 0, Math.min(halfWidth, halfHeight));
        const qx = Math.abs(x - (Number(obstacle.x) + halfWidth)) - (halfWidth - corner);
        const qy = Math.abs(y - (Number(obstacle.y) + halfHeight)) - (halfHeight - corner);
        const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
        const inside = Math.min(Math.max(qx, qy), 0);
        return outside + inside - corner < radius;
      });
    }

    findOpenPoint(x, y, radius = 12, side = null) {
      const valid = (px, py) => !this.isPointBlocked(px, py, radius) && (!side || this.isInDeploymentZone(side, px, py));
      if (valid(x, y)) return { x, y };
      for (let ring = 1; ring <= 8; ring += 1) {
        const distance = ring * 20;
        for (let i = 0; i < 16; i += 1) {
          const angle = i / 16 * Math.PI * 2;
          const px = clamp(x + Math.cos(angle) * distance, FIELD.left + radius + 2, FIELD.right - radius - 2);
          const py = clamp(y + Math.sin(angle) * distance, FIELD.top + radius + 2, FIELD.bottom - radius - 2);
          if (valid(px, py)) return { x: px, y: py };
        }
      }
      return { x: clamp(x, FIELD.left + radius, FIELD.right - radius), y: clamp(y, FIELD.top + radius, FIELD.bottom - radius) };
    }

    isLineBlocked(x1, y1, x2, y2, clearance = 3) {
      const distance = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(2, Math.ceil(distance / 22));
      for (let i = 1; i < steps; i += 1) {
        const t = i / steps;
        if (this.isPointBlocked(lerp(x1, x2, t), lerp(y1, y2, t), clearance)) return true;
      }
      return false;
    }

    pointInRouteHazard(x, y, hazard) {
      if (x < Number(hazard.x1 || FIELD.left) || x > Number(hazard.x2 || FIELD.right)) return false;
      return this.distanceToRoute(Number(hazard.route ?? hazard.lane ?? 0), x, y, Number(hazard.x1 || FIELD.left), Number(hazard.x2 || FIELD.right)) <= Number(hazard.width || 120) * 0.5;
    }

    moveEntityToward(entity, targetX, targetY, dt, speedMul) {
      const dx = targetX - entity.x;
      const dy = targetY - entity.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1) return;
      let vx = dx / distance;
      let vy = dy / distance;

      let separationX = 0;
      let separationY = 0;
      this.entities.forEach((other) => {
        if (!other.alive || other.id === entity.id || other.side !== entity.side || other.isBuilding) return;
        const ox = entity.x - other.x;
        const oy = entity.y - other.y;
        const d = Math.hypot(ox, oy);
        const desired = entity.radius + other.radius + 7;
        if (d > 0.1 && d < desired * 1.35) {
          const force = (desired * 1.35 - d) / (desired * 1.35);
          separationX += ox / d * force;
          separationY += oy / d * force;
        }
      });
      vx += separationX * 0.72;
      vy += separationY * 0.72;
      const vectorLength = Math.hypot(vx, vy) || 1;
      vx /= vectorLength;
      vy /= vectorLength;

      const step = Math.min(distance, Math.max(0, Number(entity.speed || 0) * speedMul * dt));
      const tryDirection = (angleOffset) => {
        const angle = Math.atan2(vy, vx) + angleOffset;
        const nx = clamp(entity.x + Math.cos(angle) * step, FIELD.left + entity.radius + 2, FIELD.right - entity.radius - 2);
        const ny = clamp(entity.y + Math.sin(angle) * step, FIELD.top + entity.radius + 2, FIELD.bottom - entity.radius - 2);
        if (!entity.flying && this.isPointBlocked(nx, ny, entity.radius * 0.78)) return null;
        return { x: nx, y: ny, angle, score: Math.hypot(targetX - nx, targetY - ny) };
      };
      const options = [0, 0.48, -0.48, 0.92, -0.92, 1.35, -1.35].map(tryDirection).filter(Boolean).sort((a, b) => a.score - b.score);
      const next = options[0];
      if (!next) return;
      entity.x = next.x;
      entity.y = next.y;
      entity.facing = next.angle;
      entity.moving = true;
      entity.walkPhase = Number(entity.walkPhase || 0) + dt * (4 + entity.speed * 0.06);
    }

    laneStrength(side, lane) {
      return this.entities.filter((entity) => entity.alive && entity.side === side && entity.lane === lane).reduce((sum, entity) => {
        const hpWeight = entity.hp / Math.max(1, entity.maxHp);
        return sum + (entity.damage || entity.heal || 8) * hpWeight + entity.maxHp * 0.08 + (entity.heavy ? 35 : 0);
      }, 0);
    }

    getDeployBounds(side, lane) {
      const zone = this.getDeployZone(side);
      return { min: zone.minX, max: zone.maxX, minY: zone.minY, maxY: zone.maxY };
    }
    spawnCardUnits(side, card, lane, x, options = {}) {
      const stats = card.unit;
      const count = Number(stats.count || 1);
      const safeLane = Number.isInteger(lane) ? clamp(lane, 0, Math.max(0, this.routeCount - 1)) : this.nearestRoute(x, Number(options.y || 360));
      const baseY = Number(options.y ?? this.routePointAtX(safeLane, x).y);
      const sideMul = side === SIDE_PLAYER
        ? { hp: 1 + Number(this.mods.unitHpMul || 0), dmg: 1 + Number(this.mods.unitDmgMul || 0), speed: 1 + Number(this.mods.moveSpeedMul || 0) }
        : { hp: Number(this.config.ai?.hpMul || 1), dmg: Number(this.config.ai?.damageMul || 1), speed: Number(this.config.ai?.speedMul || 1) };

      const offsets = this.getFormationOffsets(count);
      offsets.forEach((offset, index) => {
        const hp = Number(stats.hp || 50) * sideMul.hp;
        const radius = Number(stats.radius || 12);
        const desiredX = clamp(x + offset.x * (side === SIDE_PLAYER ? -1 : 1), FIELD.left + 45, FIELD.right - 45);
        const desiredY = clamp(baseY + offset.y, FIELD.top + radius + 2, FIELD.bottom - radius - 2);
        const point = this.findOpenPoint(desiredX, desiredY, radius * 0.82);
        const entity = {
          id: `entity-${this.uid++}`,
          cardId: card.id,
          name: card.name,
          icon: card.icon,
          sprite: RF.CARD_SPRITES?.[card.id] || stats.role || 'rifle',
          side,
          lane: safeLane,
          x: point.x,
          y: point.y,
          hp,
          maxHp: hp,
          shield: Number(stats.shield || 0) * sideMul.hp,
          damage: Number(stats.damage || 0) * sideMul.dmg,
          heal: Number(stats.heal || 0) * sideMul.dmg,
          speed: Number(stats.speed || 0) * sideMul.speed,
          range: Number(stats.range || 25),
          minRange: Number(stats.minRange || 0),
          pursuitRange: Math.max(225, Number(stats.range || 25) + 135),
          cooldown: Number(stats.cooldown || 1),
          cooldownRemaining: randomBetween(0.1, 0.45) + index * 0.03,
          radius,
          role: stats.role || 'melee',
          armor: Number(stats.armor || 0),
          aoe: Number(stats.aoe || 0),
          projectile: Boolean(stats.projectile),
          flying: Boolean(stats.flying),
          heavy: Boolean(stats.heavy || stats.role === 'heavy' || stats.role === 'boss'),
          isBoss: Boolean(card.boss),
          isBuilding: false,
          alive: true,
          firstAttack: true,
          chargeBonus: Number(stats.chargeBonus || 0) * sideMul.dmg,
          bonusVsHeavy: Number(stats.bonusVsHeavy || 0),
          bonusVsBuilding: Number(stats.bonusVsBuilding || 0),
          chill: Number(stats.chill || 0),
          poison: Number(stats.poison || 0),
          lifeSteal: Number(stats.lifeSteal || 0),
          deathBurst: Number(stats.deathBurst || 0) * sideMul.dmg,
          spawnCard: stats.spawnCard,
          spawnEvery: Number(stats.spawnEvery || 0),
          nextSpawnAt: stats.spawnEvery ? this.elapsed + Number(stats.spawnEvery) : 0,
          freezeUntil: 0,
          slowUntil: 0,
          rallyUntil: 0,
          poisonUntil: 0,
          poisonDps: 0,
          chillStacks: 0,
          auraAttackBonus: 0,
          auraSlow: 0,
          color: stats.color || (side === SIDE_PLAYER ? '#67d8ff' : '#ff7b6e'),
          source: options.source || 'card',
          facing: side === SIDE_PLAYER ? 0 : Math.PI,
          walkPhase: randomBetween(0, Math.PI * 2),
          attackFlashUntil: 0,
          waypointIndex: this.initialWaypointIndex(safeLane, point.x, side)
        };
        this.entities.push(entity);
        this.createBurst(entity.x, entity.y, entity.color, card.boss ? 26 : 5);
      });
      if (side === SIDE_PLAYER) this.battleStats.unitsDeployed += count;
    }
    spawnCardBuilding(side, card, lane, x, options = {}) {
      const stats = card.building;
      const safeLane = Number.isInteger(lane) ? clamp(lane, 0, Math.max(0, this.routeCount - 1)) : this.nearestRoute(x, Number(options.y || 360));
      const radius = Number(stats.radius || 22);
      const targetY = Number(options.y ?? this.routePointAtX(safeLane, x).y);
      const point = this.findOpenPoint(x, targetY, radius * 0.9);
      const hpMul = side === SIDE_PLAYER ? 1 + Number(this.mods.buildingHpMul || 0) : Number(this.config.ai?.hpMul || 1);
      const dmgMul = side === SIDE_PLAYER ? 1 + Number(this.mods.unitDmgMul || 0) : Number(this.config.ai?.damageMul || 1);
      const durationMul = side === SIDE_PLAYER ? 1 + Number(this.mods.buildingDurationMul || 0) : 1;
      const hp = Number(stats.hp || 250) * hpMul;
      const entity = {
        id: `entity-${this.uid++}`,
        cardId: card.id,
        name: card.name,
        icon: card.icon,
        sprite: RF.CARD_SPRITES?.[card.id] || stats.role || 'turret',
        side,
        lane: safeLane,
        x: point.x,
        y: point.y,
        hp,
        maxHp: hp,
        shield: Number(stats.shield || 0) * hpMul,
        damage: Number(stats.damage || 0) * dmgMul,
        heal: 0,
        speed: 0,
        range: Number(stats.range || 0),
        minRange: 0,
        cooldown: Number(stats.cooldown || 1),
        cooldownRemaining: randomBetween(0.1, 0.4),
        radius,
        role: stats.role || 'wall',
        armor: Number(stats.armor || 0.05),
        aoe: Number(stats.aoe || 0),
        projectile: Boolean(stats.projectile),
        heavy: Boolean(card.boss),
        isBoss: Boolean(card.boss),
        isBuilding: true,
        alive: true,
        expiresAt: this.elapsed + Number(stats.duration || 45) * durationMul,
        auraRange: Number(stats.auraRange || 0),
        healPerSecond: Number(stats.healPerSecond || 0),
        attackSpeedAura: Number(stats.attackSpeedAura || 0),
        slowAura: Number(stats.slowAura || 0),
        shieldPulse: Number(stats.shieldPulse || 0),
        spawnCard: stats.spawnCard,
        spawnEvery: Number(stats.spawnEvery || 0),
        nextSpawnAt: stats.spawnEvery ? this.elapsed + Number(stats.spawnEvery) : 0,
        freezeUntil: 0,
        slowUntil: 0,
        rallyUntil: 0,
        poisonUntil: 0,
        poisonDps: 0,
        chillStacks: 0,
        auraAttackBonus: 0,
        auraSlow: 0,
        color: stats.color || (side === SIDE_PLAYER ? '#67d8ff' : '#ff7b6e'),
        source: options.source || 'card',
        facing: side === SIDE_PLAYER ? 0 : Math.PI,
        attackFlashUntil: 0
      };
      this.entities.push(entity);
      this.createBurst(point.x, point.y, entity.color, card.boss ? 32 : 10);
    }
    getFormationOffsets(count) {
      const patterns = {
        1: [{ x: 0, y: 0 }],
        2: [{ x: 0, y: -15 }, { x: 0, y: 15 }],
        3: [{ x: 0, y: -20 }, { x: 12, y: 0 }, { x: 0, y: 20 }],
        4: [{ x: 0, y: -23 }, { x: 0, y: 23 }, { x: 18, y: -8 }, { x: 18, y: 8 }]
      };
      return patterns[count] || Array.from({ length: count }, (_, i) => ({ x: Math.floor(i / 2) * 15, y: (i % 2 ? 1 : -1) * (10 + Math.floor(i / 2) * 8) }));
    }

    playCardEffect(side, cardId, lane, x, options = {}) {
      const card = RF.CARDS[cardId];
      if (!card) return false;
      const y = Number(options.y ?? this.routePointAtX(lane, x).y);
      if (card.type === 'unit') this.spawnCardUnits(side, card, lane, x, { ...options, y });
      else if (card.type === 'building') this.spawnCardBuilding(side, card, lane, x, { ...options, y });
      else if (card.type === 'spell') this.castSpell(side, card, lane, x, y);
      return true;
    }
    castSpell(side, card, lane, x, y = null) {
      const spell = card.spell || {};
      const power = side === SIDE_PLAYER ? 1 + Number(this.mods.spellPower || 0) : Number(this.config.ai?.damageMul || 1);
      const allySide = side;
      const enemySide = side === SIDE_PLAYER ? SIDE_ENEMY : SIDE_PLAYER;
      const targetY = Number(y ?? this.routePointAtX(lane, x).y);
      const inRadius = (entity, radius) => Math.hypot(entity.x - x, entity.y - targetY) <= radius + entity.radius;

      if (spell.effect === 'rally') {
        this.entities.filter((entity) => entity.alive && entity.side === allySide && inRadius(entity, Number(spell.radius || 145))).forEach((entity) => {
          entity.rallyUntil = Math.max(entity.rallyUntil, this.elapsed + Number(spell.duration || 8));
        });
        this.createBurst(x, targetY, '#70ffc3', 24);
      } else if (spell.effect === 'freeze') {
        this.entities.filter((entity) => entity.alive && entity.side === enemySide && inRadius(entity, Number(spell.radius || 125))).forEach((entity) => {
          entity.freezeUntil = Math.max(entity.freezeUntil, this.elapsed + Number(spell.freeze || 2.8));
          entity.slowUntil = Math.max(entity.slowUntil, this.elapsed + Number(spell.freeze || 2.8) + Number(spell.slow || 6));
        });
        this.createBurst(x, targetY, '#aeeaff', 30);
        RF.audio.play('freeze');
      } else if (spell.effect === 'repair') {
        const heal = Number(spell.heal || 180) * power;
        this.entities.filter((entity) => entity.alive && entity.side === allySide && inRadius(entity, Number(spell.radius || 155))).forEach((entity) => this.healTarget(entity, heal, true));
        const forts = allySide === SIDE_PLAYER ? [this.forts.playerCore, ...this.forts.playerOutposts] : [this.forts.enemyCore, ...this.forts.enemyOutposts];
        forts.filter((fort) => fort.alive && Math.hypot(fort.x - x, fort.y - targetY) <= Number(spell.radius || 155) + fort.radius).forEach((fort) => this.healTarget(fort, fort.kind === 'core' ? heal * 0.28 : heal * 0.7, true));
        this.createBurst(x, targetY, '#73ffc7', 24);
      } else if (spell.effect === 'reposition') {
        const targets = this.entities.filter((entity) => entity.alive && entity.side === allySide && !entity.isBuilding && inRadius(entity, Number(spell.radius || 150)))
          .sort((a, b) => Math.hypot(a.x - x, a.y - targetY) - Math.hypot(b.x - x, b.y - targetY)).slice(0, Number(spell.count || 4));
        targets.forEach((entity, index) => {
          const direction = entity.y <= targetY ? -1 : 1;
          let nextLane = (entity.lane + direction + this.routeCount) % this.routeCount;
          if (nextLane === entity.lane && this.routeCount > 1) nextLane = (entity.lane + 1) % this.routeCount;
          entity.lane = nextLane;
          entity.waypointIndex = this.initialWaypointIndex(nextLane, entity.x, entity.side);
          const routePoint = this.routePointAtX(nextLane, entity.x);
          const open = this.findOpenPoint(entity.x, routePoint.y + randomBetween(-18, 18), entity.radius * 0.8);
          entity.x = open.x;
          entity.y = open.y;
          entity.rallyUntil = Math.max(entity.rallyUntil, this.elapsed + 3.5);
          this.createBurst(entity.x, entity.y, '#c79aff', 8 + index);
        });
      } else if (spell.effect === 'energy') {
        const amount = Number(spell.amount || 3);
        if (side === SIDE_PLAYER) this.energy = Math.min(this.maxEnergy, this.energy + amount);
        else this.enemyEnergy = Math.min(this.enemyMaxEnergy, this.enemyEnergy + amount);
        this.createBurst(x, targetY, '#ffe178', 30);
        this.emitEvent('warning', { title: '宝藏协议启动', text: `立即恢复${amount}点费用。`, hazard: 'treasure' });
        RF.audio.play('stage');
      } else if (spell.effect === 'timeStop') {
        const duration = Number(spell.duration || 4.2);
        this.entities.filter((entity) => entity.alive && entity.side === enemySide && !entity.isBuilding).forEach((entity) => {
          entity.freezeUntil = Math.max(entity.freezeUntil, this.elapsed + duration);
        });
        this.createBurst(x, targetY, '#e0c5ff', 44);
        this.emitEvent('warning', { title: '全域时停', text: `全部敌方单位被冻结${duration.toFixed(1)}秒。`, hazard: 'treasure' });
        RF.audio.play('freeze');
      } else if (spell.effect === 'orbital') {
        const delay = Number(spell.delay || 0.8);
        this.hazardVisuals.push({ id: `target-${this.uid++}`, type: 'orbitalTarget', lane, x, y: targetY, radius: Number(spell.radius || 118), warningUntil: this.elapsed + delay, activeUntil: this.elapsed + delay + 0.35 });
        this.schedule(delay, () => {
          const source = { side, spellSource: true };
          this.getTargetsAround(x, targetY, enemySide, lane, Number(spell.radius || 115)).forEach((target) => this.applyDamage(target, Number(spell.damage || 200) * power, source));
          this.createBurst(x, targetY, '#ffd27b', 42);
          RF.audio.play('boom');
        });
      } else if (spell.effect === 'barrage') {
        const hits = Number(spell.hits || 3);
        for (let i = 0; i < hits; i += 1) {
          this.schedule(i * Number(spell.interval || 0.7) + 0.35, () => {
            const hitX = x + randomBetween(-48, 48);
            const hitY = targetY + randomBetween(-34, 34);
            const source = { side, spellSource: true };
            this.getTargetsAround(hitX, hitY, enemySide, lane, Number(spell.radius || 105)).forEach((target) => this.applyDamage(target, Number(spell.damage || 100) * power, source));
            this.createBurst(hitX, hitY, '#ffb45e', 24);
            RF.audio.play('boom');
          });
        }
      } else if (spell.effect === 'treasureEnergy') {
        const amount = Number(spell.gain || 4);
        if (side === SIDE_PLAYER) {
          this.energy = Math.min(this.maxEnergy, this.energy + amount);
          for (let i = 0; i < Number(spell.draw || 2); i += 1) this.drawNextPlayerCard();
        } else {
          this.enemyEnergy = Math.min(this.enemyMaxEnergy, this.enemyEnergy + amount);
        }
        this.createBurst(x, targetY, '#ffe16d', 40);
        this.emitEvent('info', { title: '无限流电容启动', text: `获得${amount}点费用并紧急抽牌。` });
        RF.audio.play('stage');
      } else if (spell.effect === 'treasureMirror') {
        const previous = this.lastPlayerCard;
        const previousCard = previous ? RF.CARDS[previous.cardId] : null;
        if (side === SIDE_PLAYER && previousCard && (previousCard.type === 'unit' || previousCard.type === 'building') && !previousCard.treasure) {
          this.playCardEffect(SIDE_PLAYER, previous.cardId, lane, x, { source: 'treasureMirror', y: targetY });
          this.createBurst(x, targetY, '#d8a0ff', 32);
          this.emitEvent('info', { title: '万象复制完成', text: `${previousCard.name}被再次部署。` });
        } else if (side === SIDE_PLAYER) {
          this.energy = Math.min(this.maxEnergy, this.energy + 2);
          this.emitEvent('info', { title: '复制镜无目标', text: '未找到可复制单位，返还2点费用。' });
        }
      } else if (spell.effect === 'treasureWave') {
        (spell.cards || []).forEach((cardId, index) => {
          this.schedule(index * 0.32, () => this.playCardEffect(side, cardId, lane, x + (side === SIDE_PLAYER ? index * 24 : -index * 24), { source: 'treasureWave', y: targetY + (index ? 26 : -22) }));
        });
        this.createBurst(x, targetY, '#ffd779', 36);
      } else if (spell.effect === 'treasureBloom') {
        const radius = 185;
        this.entities.filter((entity) => entity.alive && entity.side === allySide && inRadius(entity, radius)).forEach((entity) => this.healTarget(entity, Number(spell.heal || 300) * power, true));
        for (let i = 0; i < Number(spell.waves || 2); i += 1) {
          this.schedule(i * 0.48, () => this.playCardEffect(side, spell.card || 'swarm_raiders', lane, x + (side === SIDE_PLAYER ? i * 22 : -i * 22), { source: 'treasureBloom', y: targetY + randomBetween(-28, 28) }));
        }
        this.createBurst(x, targetY, '#8eff79', 42);
      } else if (spell.effect === 'treasureNova') {
        const delay = Number(spell.delay || 0.8);
        const radius = Number(spell.radius || 165);
        this.hazardVisuals.push({ id: `target-${this.uid++}`, type: 'orbitalTarget', lane, x, y: targetY, radius, warningUntil: this.elapsed + delay, activeUntil: this.elapsed + delay + 0.45 });
        this.schedule(delay, () => {
          const source = { side, spellSource: true };
          this.getTargetsAround(x, targetY, enemySide, lane, radius).forEach((target) => this.applyDamage(target, Number(spell.damage || 390) * power, source));
          this.createBurst(x, targetY, '#c580ff', 58);
          RF.audio.play('boom');
        });
      } else if (spell.effect === 'treasureTime') {
        if (side === SIDE_PLAYER) {
          for (let i = 0; i < Number(spell.draw || 3); i += 1) this.drawNextPlayerCard();
          this.drawProgress = this.currentDrawInterval();
        }
        this.createBurst(x, targetY, '#d9c2ff', 34);
        this.emitEvent('info', { title: '逆秒完成', text: '紧急抽牌完成，下一次自然抽牌立即就绪。' });
      }
    }
    getEffectiveCost(handItem) {
      const card = RF.CARDS[handItem.cardId];
      if (!card) return 99;
      let cost = Number(card.cost || 0);
      if (this.vanguardDiscountAvailable && Number(this.mods.firstCardDiscount || this.mods.vanguardDiscount || 0) > 0) cost -= Number(this.mods.firstCardDiscount || this.mods.vanguardDiscount || 0);
      if (this.elapsed < this.costCurseUntil) cost += Number(this.costCurseAmount || 0);
      return Math.max(0, cost);
    }

    selectCard(index, force = false) {
      if (this.ended || index < 0 || index >= this.hand.length) return false;
      this.selectedIndex = force ? index : (this.selectedIndex === index ? null : index);
      RF.audio.play('select');
      this.emitState(true);
      return true;
    }

    setDragPreview(index, x, y, inside = true) {
      if (index != null && index >= 0 && index < this.hand.length) {
        this.selectedIndex = index;
        this.dragPreviewIndex = index;
      }
      this.mouse.x = Number(x || 0);
      this.mouse.y = Number(y || 0);
      this.mouse.inside = Boolean(inside);
      this.mouse.external = true;
    }

    clearDragPreview(keepSelection = true) {
      this.dragPreviewIndex = null;
      this.mouse.external = false;
      this.mouse.inside = false;
      if (!keepSelection) this.selectedIndex = null;
      this.emitState(true);
    }

    getPlacementPreview(index, x, y) {
      const item = this.hand[index];
      const card = item ? RF.CARDS[item.cardId] : null;
      if (!card) return { ok: false, reason: '卡牌已不在手中。', route: 0 };
      const route = this.nearestRoute(x, y);
      const validation = this.validatePlacement(card, route, x, y);
      const cost = this.getEffectiveCost(item);
      if (validation.ok && this.energy + 0.001 < cost) return { ok: false, reason: `费用不足，还需要${Math.max(0, cost - this.energy).toFixed(1)}费。`, route, routeName: this.routeName(route), cost };
      return { ...validation, route, routeName: this.routeName(route), cost };
    }

    playCardAtIndex(index, x, y) {
      if (index == null || index < 0 || index >= this.hand.length) return false;
      this.selectedIndex = index;
      return this.playSelectedAt(x, y);
    }
    archiveCard(index = this.selectedIndex) {
      if (this.ended || this.archiveCharges <= 0 || index == null || index < 0 || index >= this.hand.length) return false;
      const [item] = this.hand.splice(index, 1);
      this.groupDiscards[item.group].push(item.cardId);
      this.archiveCharges -= 1;
      this.archiveProgress = 0;
      this.selectedIndex = null;
      RF.audio.play('archive');
      this.emitEvent('info', { title: '卡牌已归档', text: `${RF.CARDS[item.cardId].name}将在下次全军补给后重新进入牌库。` });
      this.checkForEmptyPiles();
      this.emitState(true);
      return true;
    }

    switchSupply(groupId) {
      if (!this.groupPiles[groupId] || groupId === this.activeGroup) return false;
      this.activeGroup = groupId;
      if (this.tutorialGoals) {
        this.tutorialGoals.switchedSupply = true;
        this.checkTutorialComplete();
      }
      RF.audio.play('click');
      this.emitEvent('supply', { group: RF.GROUPS.find((group) => group.id === groupId) });
      this.emitState(true);
      return true;
    }

    checkForEmptyPiles() {
      const allEmpty = RF.GROUPS.every((group) => this.groupPiles[group.id].length === 0);
      if (allEmpty) this.beginResupply();
    }

    playSelectedAt(x, y) {
      if (this.selectedIndex == null || !this.hand[this.selectedIndex]) return false;
      const item = this.hand[this.selectedIndex];
      const card = RF.CARDS[item.cardId];
      const lane = this.nearestRoute(x, y);
      const valid = this.validatePlacement(card, lane, x, y);
      if (!valid.ok) {
        this.emitEvent('invalid', { text: valid.reason });
        RF.audio.play('warning');
        return false;
      }
      const cost = this.getEffectiveCost(item);
      if (this.energy + 0.001 < cost) {
        this.emitEvent('invalid', { text: `费用不足，还需要${Math.max(0, cost - this.energy).toFixed(1)}费。` });
        RF.audio.play('warning');
        return false;
      }

      this.energy -= cost;
      this.hand.splice(this.selectedIndex, 1);
      this.groupDiscards[item.group].push(item.cardId);
      this.selectedIndex = null;
      this.dragPreviewIndex = null;
      if (this.vanguardDiscountAvailable) this.vanguardDiscountAvailable = false;
      this.playCardEffect(SIDE_PLAYER, item.cardId, lane, x, { source: 'player', y });
      this.battleStats.cardsPlayed += 1;
      this.lastPlayerCard = { cardId: item.cardId, lane, x, y, at: this.elapsed };
      RF.audio.play('card');

      if (this.tutorialGoals) {
        if (card.type === 'unit' || card.type === 'building') this.tutorialGoals.playedUnit = true;
        if (card.type === 'spell') this.tutorialGoals.playedSpell = true;
        this.checkTutorialComplete();
      }
      this.emitEvent('cardPlayed', { card, lane, routeName: this.routeName(lane), x, y });

      if (this.mirrorEnabled && card.type === 'unit') {
        const mirrorLane = Math.max(0, this.routeCount - 1 - lane);
        const mirrorX = clamp(WIDTH - x, 815, 1120);
        const mirroredY = clamp(HEIGHT - y, FIELD.top + 30, FIELD.bottom - 30);
        const mirrorY = this.findOpenPoint(mirrorX, mirroredY, Number(card.unit?.radius || 14)).y;
        this.schedule(5, () => {
          this.playCardEffect(SIDE_ENEMY, item.cardId, mirrorLane, mirrorX, { source: 'mirror', y: mirrorY });
          this.emitEvent('warning', { title: '镜像复制完成', text: `${card.name}的敌方镜像出现在${this.routeName(mirrorLane)}附近。`, lane: mirrorLane, hazard: 'mirror' });
          this.createBurst(mirrorX, mirrorY, '#e98cff', 20);
        });
      }

      this.checkForEmptyPiles();
      this.emitState(true);
      return true;
    }
    validatePlacement(card, lane, x, y) {
      if (!card) return { ok: false, reason: '未识别的战术协议。' };
      if (y < FIELD.top || y > FIELD.bottom || x < FIELD.left || x > FIELD.right) return { ok: false, reason: '请在战场内部选择目标。' };
      if (card.type === 'unit' || card.type === 'building') {
        const radius = card.type === 'building' ? Number(card.building?.radius || 22) + 5 : Math.max(11, Number(card.unit?.radius || 12));
        if (!this.isInDeploymentZone(SIDE_PLAYER, x, y, lane)) return { ok: false, reason: '请部署在蓝色己方战区，或已攻破前哨后开启的前沿投送带。' };
        if (this.isPointBlocked(x, y, radius)) return { ok: false, reason: '该位置被地形阻挡，请换一个落点。' };
        const tooCloseFort = [this.forts.playerCore, ...this.forts.playerOutposts].find((fort) => fort.alive && Math.hypot(fort.x - x, fort.y - y) < fort.radius + radius + 8);
        if (tooCloseFort) return { ok: false, reason: '投送点距离固定防御设施过近。' };
        if (card.type === 'building') {
          const nearby = this.entities.find((entity) => entity.alive && entity.isBuilding && entity.side === SIDE_PLAYER && Math.hypot(entity.x - x, entity.y - y) < entity.radius + radius + 18);
          if (nearby) return { ok: false, reason: '建筑之间需要留出部署间距。' };
          const buildingCount = this.entities.filter((entity) => entity.alive && entity.isBuilding && entity.side === SIDE_PLAYER).length;
          if (buildingCount >= 3) return { ok: false, reason: '同时最多维持3座友方建筑。' };
        }
      } else if (card.target === 'friendly' && x > 790) {
        return { ok: false, reason: '该战术只能指定我方或中央区域。' };
      }
      return { ok: true };
    }
    checkTutorialComplete() {
      if (!this.tutorialGoals || this.tutorialCompleteAnnounced) return;
      if (Object.values(this.tutorialGoals).every(Boolean)) {
        this.tutorialCompleteAnnounced = true;
        this.emitEvent('tutorialComplete', { title: '训练目标全部完成', text: '现在按自己的节奏攻破敌方核心。' });
      }
    }

    togglePause() {
      if (this.ended) return;
      this.paused = !this.paused;
      RF.audio.play('click');
      this.emitState(true);
    }

    setSpeed(speed) {
      this.speed = [1, 1.5, 2].includes(Number(speed)) ? Number(speed) : 1;
      this.emitState(true);
    }

    cycleSpeed() {
      const speeds = [1, 1.5, 2];
      const index = speeds.indexOf(this.speed);
      this.setSpeed(speeds[(index + 1) % speeds.length]);
      RF.audio.play('click');
    }

    onPointerMove(event) {
      if (this.mouse.external) return;
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (event.clientX - rect.left) * WIDTH / rect.width;
      this.mouse.y = (event.clientY - rect.top) * HEIGHT / rect.height;
      this.mouse.inside = true;
    }
    onPointerDown(event) {
      if (event.button !== 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * WIDTH / rect.width;
      const y = (event.clientY - rect.top) * HEIGHT / rect.height;
      this.playSelectedAt(x, y);
    }
    emitEvent(type, payload = {}) {
      this.callbacks.onEvent({ type, ...payload });
    }

    emitState(force) {
      this.callbacks.onState(this.getHudState(), force);
    }

    getHudState() {
      const drawInterval = this.currentDrawInterval();
      return {
        modeLabel: this.modeLabel,
        title: this.config.title,
        objective: this.config.objective,
        map: { id: this.map.id, name: this.map.name, summary: this.map.summary || '', routeCount: this.routeCount },
        routes: this.routes.map((route, lane) => ({ lane, id: route.id, name: route.name || this.routeName(lane) })),
        elapsed: this.elapsed,
        duration: this.duration,
        timeLeft: Math.max(0, this.duration - this.elapsed),
        timeText: formatTime(this.duration - this.elapsed),
        stage: this.stage,
        stageIndex: this.stageIndex,
        stageProgress: this.config.stages?.map((stage) => stage.at) || [0, 0.43, 0.76],
        energy: this.energy,
        maxEnergy: this.maxEnergy,
        enemyEnergy: this.enemyEnergy,
        hand: this.hand.map((item, index) => ({ ...item, index, card: RF.CARDS[item.cardId], effectiveCost: this.getEffectiveCost(item) })),
        selectedIndex: this.selectedIndex,
        activeGroup: this.activeGroup,
        groups: RF.GROUPS.map((group) => ({
          ...group,
          pile: this.groupPiles[group.id].length,
          discard: this.groupDiscards[group.id].length,
          active: this.activeGroup === group.id
        })),
        drawProgress: this.hand.length >= 10 || this.resupplyTimer > 0 ? 0 : clamp(this.drawProgress / drawInterval, 0, 1),
        drawPaused: this.hand.length >= 10,
        resupplyTimer: Math.max(0, this.resupplyTimer),
        archiveCharges: this.archiveCharges,
        archiveMax: this.archiveMax,
        archiveProgress: this.archiveCharges >= this.archiveMax ? 1 : clamp(this.archiveProgress / 11.2, 0, 1),
        paused: this.paused,
        ended: this.ended,
        speed: this.speed,
        tutorialGoals: this.tutorialGoals ? { ...this.tutorialGoals } : null,
        playerCore: { hp: this.forts.playerCore.hp, maxHp: this.forts.playerCore.maxHp },
        enemyCore: { hp: this.forts.enemyCore.hp, maxHp: this.forts.enemyCore.maxHp },
        playerOutposts: this.forts.playerOutposts.map((fort) => ({ hp: fort.hp, maxHp: fort.maxHp, alive: fort.alive, lane: fort.lane, routeName: this.routeName(fort.lane) })),
        enemyOutposts: this.forts.enemyOutposts.map((fort) => ({ hp: fort.hp, maxHp: fort.maxHp, alive: fort.alive, lane: fort.lane, routeName: this.routeName(fort.lane) })),
        vanguardDiscountAvailable: this.vanguardDiscountAvailable,
        stats: { ...this.battleStats }
      };
    }

    // =============================
    // 绘制
    // =============================
    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      this.drawBackground(ctx);
      this.drawLanes(ctx);
      this.drawDeploymentZones(ctx);
      this.drawMapObstacles(ctx);
      this.drawHazards(ctx);
      this.drawFortifications(ctx);
      this.drawEntities(ctx);
      this.drawProjectiles(ctx);
      this.drawParticles(ctx);
      this.drawFloatingTexts(ctx);
      this.drawSelectionGhost(ctx);
      if (this.paused && !this.ended) this.drawPausedOverlay(ctx);
    }
    drawBackground(ctx) {
      const palettes = {
        wasteland: ['#071523', '#10263a', '#163044'],
        ice: ['#071827', '#12364b', '#1d5067'],
        jungle: ['#071a18', '#123528', '#1b4930'],
        magma: ['#1d0d12', '#3b1c19', '#5c2b1c'],
        steel: ['#160f1d', '#2a1b32', '#3c263f'],
        mirror: ['#160e25', '#2a1944', '#3d2a55'],
        core: ['#0b1020', '#241a3b', '#46304d']
      };
      const palette = palettes[this.config.biome] || palettes.wasteland;
      const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
      gradient.addColorStop(0, palette[0]);
      gradient.addColorStop(0.5, palette[1]);
      gradient.addColorStop(1, palette[2]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = this.config.biome === 'magma' ? '#ff8a4a' : this.config.biome === 'jungle' ? '#75e09a' : '#86d9ff';
      ctx.lineWidth = 1;
      const offset = (this.elapsed * 12) % 48;
      for (let x = -48 + offset; x < WIDTH + 48; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 220, HEIGHT);
        ctx.stroke();
      }
      ctx.restore();

      this.drawBiomeDetails(ctx);
    }

    drawBiomeDetails(ctx) {
      ctx.save();
      if (this.config.biome === 'ice') {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#dff8ff';
        for (let i = 0; i < 46; i += 1) {
          const x = (i * 83 + this.elapsed * (8 + i % 5)) % WIDTH;
          const y = (i * 137 + this.elapsed * 16) % HEIGHT;
          ctx.fillRect(x, y, 2, 2);
        }
      } else if (this.config.biome === 'jungle') {
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = '#65d77a';
        ctx.lineWidth = 3;
        for (let i = 0; i < 9; i += 1) {
          const x = i * 165 - 40;
          ctx.beginPath();
          ctx.moveTo(x, HEIGHT);
          ctx.bezierCurveTo(x + 40, 590, x - 20, 510, x + 70, 420);
          ctx.stroke();
        }
      } else if (this.config.biome === 'magma') {
        ctx.globalAlpha = 0.32;
        ctx.strokeStyle = '#ff7d35';
        ctx.lineWidth = 2;
        for (let i = 0; i < 12; i += 1) {
          const x = i * 118;
          ctx.beginPath();
          ctx.moveTo(x, HEIGHT);
          ctx.lineTo(x + 35, 650);
          ctx.lineTo(x + 12, 610);
          ctx.stroke();
        }
      } else if (this.config.biome === 'steel') {
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = '#ff7fa8';
        for (let y = 35; y < HEIGHT; y += 58) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(WIDTH, y);
          ctx.stroke();
        }
      } else if (this.config.biome === 'mirror' || this.config.biome === 'core') {
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = '#e49cff';
        for (let i = 0; i < 10; i += 1) {
          const x = i * 150 + 20;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + 80, 90);
          ctx.lineTo(x - 20, 190);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    drawRouteSegment(ctx, lane, minX = 245, maxX = 1035) {
      const samples = Math.max(8, Math.ceil((maxX - minX) / 22));
      ctx.beginPath();
      for (let i = 0; i <= samples; i += 1) {
        const x = lerp(minX, maxX, i / samples);
        const point = this.routePointAtX(lane, x);
        if (i === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      }
    }

    routeAngleAtX(lane, x) {
      const a = this.routePointAtX(lane, x - 8);
      const b = this.routePointAtX(lane, x + 8);
      return Math.atan2(b.y - a.y, b.x - a.x);
    }

    drawDeploymentZones(ctx) {
      if (this.selectedIndex == null || !this.hand[this.selectedIndex]) return;
      const card = RF.CARDS[this.hand[this.selectedIndex].cardId];
      if (!card) return;
      ctx.save();
      if (card.type === 'unit' || card.type === 'building') {
        const zone = this.getDeployZone(SIDE_PLAYER);
        const gradient = ctx.createLinearGradient(zone.minX, 0, zone.maxX, 0);
        gradient.addColorStop(0, 'rgba(65, 175, 255, 0.08)');
        gradient.addColorStop(1, 'rgba(83, 229, 255, 0.21)');
        ctx.fillStyle = gradient;
        this.roundRect(ctx, zone.minX, zone.minY, zone.maxX - zone.minX, zone.maxY - zone.minY, 24);
        ctx.fill();
        ctx.strokeStyle = 'rgba(116, 229, 255, 0.72)';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 9]);
        this.roundRect(ctx, zone.minX, zone.minY, zone.maxX - zone.minX, zone.maxY - zone.minY, 24);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(216, 249, 255, 0.74)';
        ctx.font = '800 12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('己方自由部署战区', zone.minX + 18, zone.minY + 24);

        this.routes.forEach((route, lane) => {
          if (this.forts.enemyOutposts[lane]?.alive !== false) return;
          ctx.strokeStyle = 'rgba(90, 225, 255, 0.19)';
          ctx.lineWidth = Number(route.width || 110) * 1.18;
          ctx.lineCap = 'round';
          this.drawRouteSegment(ctx, lane, zone.maxX - 10, 705);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(122, 239, 255, 0.66)';
          ctx.lineWidth = 2;
          ctx.setLineDash([9, 7]);
          this.drawRouteSegment(ctx, lane, zone.maxX, 705);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      } else if (card.target === 'friendly') {
        ctx.fillStyle = 'rgba(105, 235, 206, 0.07)';
        ctx.fillRect(FIELD.left, FIELD.top, 710, FIELD.bottom - FIELD.top);
        ctx.strokeStyle = 'rgba(110, 255, 211, 0.35)';
        ctx.setLineDash([12, 9]);
        ctx.strokeRect(FIELD.left, FIELD.top, 710, FIELD.bottom - FIELD.top);
      }
      ctx.restore();
    }
    drawLanes(ctx) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      this.routes.forEach((route, lane) => {
        const width = Number(route.width || 108);
        ctx.strokeStyle = 'rgba(2, 7, 12, 0.52)';
        ctx.lineWidth = width + 22;
        this.drawRouteSegment(ctx, lane);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(206, 232, 241, 0.085)';
        ctx.lineWidth = width;
        this.drawRouteSegment(ctx, lane);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(77, 198, 255, 0.13)';
        ctx.lineWidth = width * 0.86;
        this.drawRouteSegment(ctx, lane, 245, 640);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 112, 96, 0.12)';
        this.drawRouteSegment(ctx, lane, 640, 1035);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(232, 246, 251, 0.22)';
        ctx.lineWidth = 2;
        ctx.setLineDash([18, 15]);
        this.drawRouteSegment(ctx, lane);
        ctx.stroke();
        ctx.setLineDash([]);

        [390, 640, 890].forEach((x) => {
          const point = this.routePointAtX(lane, x);
          const angle = this.routeAngleAtX(lane, x);
          ctx.save();
          ctx.translate(point.x, point.y);
          ctx.rotate(angle);
          ctx.globalAlpha = 0.34;
          ctx.strokeStyle = x < 640 ? '#8ddfff' : '#ffad9a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-6, -6); ctx.lineTo(2, 0); ctx.lineTo(-6, 6);
          ctx.moveTo(2, -6); ctx.lineTo(10, 0); ctx.lineTo(2, 6);
          ctx.stroke();
          ctx.restore();
        });

        const labelPoint = this.routePointAtX(lane, 500);
        ctx.fillStyle = 'rgba(241, 250, 253, 0.58)';
        ctx.font = '800 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${route.short || lane + 1} · ${route.name}`, labelPoint.x, labelPoint.y - width * 0.5 - 13);
      });

      const relay = this.map.relay || [640, 360];
      const pulse = 0.58 + Math.sin(this.elapsed * 2.2) * 0.12;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#c2e8ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(relay[0], relay[1], 31, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(relay[0], relay[1], 17, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.68)';
      ctx.font = '800 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('中继', relay[0], relay[1] + 4);

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(235,248,252,0.54)';
      ctx.font = '800 11px system-ui, sans-serif';
      ctx.fillText(`${this.map.name} · ${this.routeCount}条通路`, FIELD.left + 16, FIELD.bottom - 14);
      ctx.restore();
    }

    drawMapObstacles(ctx) {
      const colors = {
        cargo: ['#314454', '#17242e', '#7391a2'], iceLake: ['#24536d', '#102f45', '#8fe9ff'], iceRidge: ['#4f7991', '#1c4259', '#c1f4ff'],
        rootMass: ['#305835', '#132d22', '#71d77c'], motherRoot: ['#4d4932', '#1e2d1e', '#9bd873'], lavaChasm: ['#7a2d18', '#2b1111', '#ff8d42'],
        factory: ['#55334e', '#211724', '#ff83ad'], reactor: ['#563d6a', '#21172f', '#df9cff'], crystal: ['#4b3e70', '#1c1831', '#d19cff']
      };
      this.obstacles.forEach((obstacle, index) => {
        const palette = colors[obstacle.type] || colors.cargo;
        ctx.save();
        ctx.shadowColor = palette[2];
        ctx.shadowBlur = obstacle.type === 'lavaChasm' || obstacle.type === 'reactor' ? 18 : 8;
        let cx;
        let cy;
        if (obstacle.shape === 'circle') {
          cx = Number(obstacle.x); cy = Number(obstacle.y);
          const gradient = ctx.createRadialGradient(cx - obstacle.r * 0.3, cy - obstacle.r * 0.35, 4, cx, cy, obstacle.r);
          gradient.addColorStop(0, palette[0]); gradient.addColorStop(1, palette[1]);
          ctx.fillStyle = gradient;
          ctx.strokeStyle = palette[2];
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(cx, cy, Number(obstacle.r), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else {
          cx = Number(obstacle.x) + Number(obstacle.w) / 2; cy = Number(obstacle.y) + Number(obstacle.h) / 2;
          const gradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x + obstacle.w, obstacle.y + obstacle.h);
          gradient.addColorStop(0, palette[0]); gradient.addColorStop(1, palette[1]);
          ctx.fillStyle = gradient;
          ctx.strokeStyle = palette[2];
          ctx.lineWidth = 2.5;
          this.roundRect(ctx, Number(obstacle.x), Number(obstacle.y), Number(obstacle.w), Number(obstacle.h), Number(obstacle.radius || 18));
          ctx.fill(); ctx.stroke();
        }
        ctx.shadowBlur = 0;

        if (obstacle.type === 'lavaChasm') {
          ctx.globalAlpha = 0.76;
          for (let i = 0; i < 12; i += 1) {
            const angle = i * 2.4 + index;
            const rx = obstacle.shape === 'circle' ? obstacle.r * 0.68 : obstacle.w * 0.42;
            const ry = obstacle.shape === 'circle' ? obstacle.r * 0.68 : obstacle.h * 0.34;
            const px = cx + Math.sin(angle) * rx * 0.8;
            const py = cy + Math.cos(angle * 1.3) * ry;
            ctx.fillStyle = i % 2 ? '#ff9f46' : '#ffcf5b';
            ctx.beginPath(); ctx.arc(px, py, 3 + Math.sin(this.elapsed * 4 + i) * 1.3, 0, Math.PI * 2); ctx.fill();
          }
        } else if (obstacle.type === 'iceLake' || obstacle.type === 'iceRidge' || obstacle.type === 'crystal') {
          ctx.strokeStyle = 'rgba(220,250,255,0.42)';
          ctx.lineWidth = 1.4;
          for (let i = 0; i < 7; i += 1) {
            const angle = i / 7 * Math.PI * 2;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle) * 42, cy + Math.sin(angle) * 32); ctx.stroke();
          }
        } else if (obstacle.type === 'rootMass' || obstacle.type === 'motherRoot') {
          ctx.strokeStyle = 'rgba(129,225,126,0.38)';
          ctx.lineWidth = 3;
          for (let i = 0; i < 5; i += 1) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.bezierCurveTo(cx + Math.sin(i * 2) * 50, cy + Math.cos(i) * 35, cx + Math.cos(i * 1.7) * 72, cy + Math.sin(i) * 62, cx + Math.cos(i) * 88, cy + Math.sin(i * 1.3) * 70);
            ctx.stroke();
          }
        } else if (obstacle.type === 'factory' || obstacle.type === 'cargo') {
          ctx.strokeStyle = 'rgba(235,250,255,0.22)';
          ctx.lineWidth = 1;
          const w = obstacle.w || obstacle.r * 1.4;
          for (let i = -2; i <= 2; i += 1) {
            ctx.beginPath(); ctx.moveTo(cx + i * w / 6, cy - 18); ctx.lineTo(cx + i * w / 6, cy + 18); ctx.stroke();
          }
        }

        ctx.fillStyle = 'rgba(233,247,251,0.5)';
        ctx.font = '700 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        if (obstacle.label) ctx.fillText(obstacle.label, cx, cy + 3);
        ctx.restore();
      });
    }
    drawHazards(ctx) {
      this.hazardVisuals.forEach((hazard) => {
        const warning = this.elapsed < hazard.warningUntil;
        const warningWindow = Math.max(0.2, hazard.warningUntil - (hazard.createdAt || hazard.warningUntil - 3));
        const t = warning ? clamp(1 - (hazard.warningUntil - this.elapsed) / warningWindow, 0, 1) : 1;
        ctx.save();
        ctx.lineCap = 'round';
        if (hazard.type === 'blizzard' || hazard.type === 'lava') {
          const width = Number(hazard.width || 120);
          if (hazard.type === 'blizzard') {
            ctx.strokeStyle = warning ? `rgba(116, 221, 255, ${0.09 + t * 0.16})` : 'rgba(184, 240, 255, 0.28)';
            ctx.shadowColor = '#8de8ff';
          } else {
            ctx.strokeStyle = warning ? `rgba(255, 104, 45, ${0.12 + t * 0.2})` : 'rgba(255, 91, 30, 0.42)';
            ctx.shadowColor = '#ff7138';
          }
          ctx.shadowBlur = warning ? 8 : 16;
          ctx.lineWidth = width;
          this.drawRouteSegment(ctx, Number(hazard.route ?? hazard.lane), Number(hazard.x1), Number(hazard.x2));
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = hazard.type === 'blizzard' ? '#d8f8ff' : '#ffd06c';
          ctx.lineWidth = 2.5;
          ctx.setLineDash(warning ? [13, 9] : hazard.type === 'blizzard' ? [4, 8] : []);
          this.drawRouteSegment(ctx, Number(hazard.route ?? hazard.lane), Number(hazard.x1), Number(hazard.x2));
          ctx.stroke();
          ctx.setLineDash([]);
          if (!warning) {
            for (let i = 0; i < 22; i += 1) {
              const x = Number(hazard.x1) + ((i * 67 + this.elapsed * (hazard.type === 'blizzard' ? 58 : 24)) % Math.max(1, Number(hazard.x2) - Number(hazard.x1)));
              const p = this.routePointAtX(Number(hazard.route ?? hazard.lane), x);
              const offset = Math.sin(i * 2.7 + this.elapsed * 3) * width * 0.32;
              ctx.fillStyle = hazard.type === 'blizzard' ? 'rgba(230,252,255,0.76)' : i % 2 ? '#ffb84d' : '#ffdf68';
              ctx.beginPath(); ctx.arc(p.x, p.y + offset, hazard.type === 'blizzard' ? 2 : 3 + (i % 3), 0, Math.PI * 2); ctx.fill();
            }
          }
        } else if (hazard.type === 'gravityWell') {
          const radius = Number(hazard.radius || 205);
          const pulse = 0.82 + Math.sin(this.elapsed * 5) * 0.12;
          const gradient = ctx.createRadialGradient(hazard.x, hazard.y, 12, hazard.x, hazard.y, radius);
          gradient.addColorStop(0, warning ? 'rgba(215,157,255,0.5)' : 'rgba(114,55,180,0.7)');
          gradient.addColorStop(0.45, 'rgba(95,45,150,0.24)');
          gradient.addColorStop(1, 'rgba(20,5,45,0)');
          ctx.fillStyle = gradient;
          ctx.strokeStyle = warning ? '#e4c2ff' : '#b56cff';
          ctx.lineWidth = warning ? 3 : 4;
          ctx.setLineDash(warning ? [12, 9] : []);
          ctx.beginPath(); ctx.arc(hazard.x, hazard.y, radius * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.setLineDash([]);
          for (let i = 0; i < 4; i += 1) {
            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.arc(hazard.x, hazard.y, radius * (0.22 + i * 0.16) + Math.sin(this.elapsed * 4 + i) * 6, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        } else if (hazard.type === 'sporeWarning') {
          ctx.fillStyle = `rgba(104, 224, 113, ${0.08 + t * 0.18})`;
          ctx.strokeStyle = '#9bf78f';
          ctx.setLineDash([7, 6]);
          ctx.beginPath(); ctx.arc(hazard.x, hazard.y, Number(hazard.radius || 54) - t * 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else if (hazard.type === 'orbitalTarget') {
          const radius = Number(hazard.radius || 118);
          ctx.strokeStyle = '#ffcf70';
          ctx.fillStyle = 'rgba(255, 190, 80, 0.12)';
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 6]);
          ctx.beginPath(); ctx.arc(hazard.x, hazard.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(hazard.x - radius, hazard.y); ctx.lineTo(hazard.x + radius, hazard.y);
          ctx.moveTo(hazard.x, hazard.y - radius); ctx.lineTo(hazard.x, hazard.y + radius); ctx.stroke();
        }
        ctx.restore();
      });
    }
    drawFortifications(ctx) {
      [this.forts.playerCore, this.forts.enemyCore].forEach((fort) => this.drawFort(ctx, fort));
      [...this.forts.playerOutposts, ...this.forts.enemyOutposts].forEach((fort) => this.drawFort(ctx, fort));
    }

    drawFort(ctx, fort) {
      const player = fort.side === SIDE_PLAYER;
      ctx.save();
      ctx.translate(fort.x, fort.y);
      if (!fort.alive) {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#26313b';
        ctx.beginPath();
        ctx.arc(0, 0, fort.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#607080';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-fort.radius * 0.6, -fort.radius * 0.6);
        ctx.lineTo(fort.radius * 0.6, fort.radius * 0.6);
        ctx.moveTo(fort.radius * 0.6, -fort.radius * 0.6);
        ctx.lineTo(-fort.radius * 0.6, fort.radius * 0.6);
        ctx.stroke();
        ctx.restore();
        return;
      }

      ctx.shadowColor = player ? '#59d8ff' : '#ff725f';
      ctx.shadowBlur = fort.kind === 'core' ? 20 : 12;
      const gradient = ctx.createRadialGradient(-10, -12, 4, 0, 0, fort.radius);
      gradient.addColorStop(0, player ? '#a8eeff' : '#ffc0a8');
      gradient.addColorStop(0.35, player ? '#3589b9' : '#b7463f');
      gradient.addColorStop(1, '#101b26');
      ctx.fillStyle = gradient;
      ctx.strokeStyle = player ? '#72dcff' : '#ff8a72';
      ctx.lineWidth = fort.kind === 'core' ? 5 : 3;
      this.hexagon(ctx, 0, 0, fort.radius, fort.kind === 'core' ? 6 : 5);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(8,15,24,0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, fort.kind === 'core' ? 22 : 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = player ? '#c8f5ff' : '#ffe1d4';
      ctx.font = `800 ${fort.kind === 'core' ? 24 : 16}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fort.kind === 'core' ? '核心' : '塔', 0, 1);

      if (fort.shield > 0) {
        ctx.strokeStyle = '#dcadff';
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, fort.radius + 7, -Math.PI * 0.1, Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.restore();

      this.drawHealthBar(ctx, fort.x - (fort.kind === 'core' ? 55 : 34), fort.y + fort.radius + 10, fort.kind === 'core' ? 110 : 68, 8, fort.hp / fort.maxHp, player ? '#67d9ff' : '#ff7767', fort.shield, fort.maxHp);
    }

    drawEntities(ctx) {
      const sorted = [...this.entities].filter((entity) => entity.alive).sort((a, b) => a.y - b.y || a.x - b.x);
      sorted.forEach((entity) => this.drawEntity(ctx, entity));
    }

    drawEntity(ctx, entity) {
      const player = entity.side === SIDE_PLAYER;
      const baseColor = entity.color || (player ? '#62d6ff' : '#ff7e6d');
      const attacking = Number(entity.attackFlashUntil || 0) > this.elapsed;
      const hover = entity.flying ? -11 + Math.sin(this.elapsed * 4.2 + entity.x * 0.03) * 2.4 : 0;
      const walkBob = !entity.isBuilding && !entity.flying && entity.moving
        ? Math.sin(Number(entity.walkPhase || 0)) * Math.min(2.2, entity.radius * 0.11)
        : 0;

      ctx.save();
      ctx.translate(entity.x, entity.y);
      ctx.globalAlpha = entity.flying ? 0.42 : 0.28;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, entity.radius + (entity.flying ? 17 : 6), entity.radius * (entity.heavy ? 1.08 : 0.92), entity.radius * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.translate(0, hover + walkBob);

      ctx.shadowColor = baseColor;
      ctx.shadowBlur = entity.isBoss ? 25 : entity.isBuilding ? 12 : 7;
      const artSrc = RF.CARDS?.[entity.cardId]?.art || RF.CARD_ART?.[entity.cardId];
      const artImage = artSrc ? getArtImage(artSrc) : null;
      const artReady = artImage && artImage.complete && artImage.naturalWidth > 0;
      if (!entity.isBuilding && artReady) {
        this.drawGeneratedArtSprite(ctx, entity, artImage, baseColor, player, attacking);
      } else if (entity.isBuilding) {
        this.drawBuildingSprite(ctx, entity, baseColor, player, attacking);
      } else {
        ctx.rotate(Number(entity.facing || (player ? 0 : Math.PI)));
        if (entity.isBoss) this.drawBossSprite(ctx, entity, baseColor, player, attacking);
        else if (entity.heavy || ['mech', 'tank', 'titan', 'walker', 'carrier', 'brute', 'mirrorKnight'].includes(entity.sprite)) {
          this.drawHeavySprite(ctx, entity, baseColor, player, attacking);
        } else if (['drone', 'firebug'].includes(entity.sprite)) {
          this.drawDroneSprite(ctx, entity, baseColor, player, attacking);
        } else if (['frostling', 'stalker', 'spore', 'vine', 'devourer', 'beast', 'imp'].includes(entity.sprite)) {
          this.drawCreatureSprite(ctx, entity, baseColor, player, attacking);
        } else {
          this.drawTrooperSprite(ctx, entity, baseColor, player, attacking);
        }
      }
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.save();
      ctx.translate(entity.x, entity.y + hover + walkBob);
      if (entity.shield > 0) {
        ctx.strokeStyle = '#dba7ff';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(0, 0, entity.radius + 6, -0.62, Math.PI * 1.58);
        ctx.stroke();
      }
      if (entity.freezeUntil > this.elapsed) {
        ctx.strokeStyle = '#d7fbff';
        ctx.fillStyle = 'rgba(126,225,255,0.12)';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(0, 0, entity.radius + 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        for (let i = 0; i < 6; i += 1) {
          const angle = i * Math.PI / 3;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * (entity.radius + 5), Math.sin(angle) * (entity.radius + 5));
          ctx.lineTo(Math.cos(angle) * (entity.radius + 12), Math.sin(angle) * (entity.radius + 12));
          ctx.stroke();
        }
      } else if (entity.slowUntil > this.elapsed || entity.auraSlow > 0) {
        ctx.strokeStyle = '#8de4ff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.64;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, entity.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (entity.rallyUntil > this.elapsed) {
        ctx.strokeStyle = '#72ffc5';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.72 + Math.sin(this.elapsed * 8) * 0.16;
        ctx.beginPath();
        ctx.arc(0, 0, entity.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-5, -entity.radius - 13);
        ctx.lineTo(0, -entity.radius - 18);
        ctx.lineTo(5, -entity.radius - 13);
        ctx.stroke();
      }
      ctx.restore();

      const barWidth = entity.isBoss ? 96 : Math.max(31, entity.radius * 2.25);
      this.drawHealthBar(ctx, entity.x - barWidth / 2, entity.y - entity.radius - (entity.flying ? 24 : 15), barWidth, entity.isBoss ? 8 : 5, entity.hp / entity.maxHp, player ? '#60dcff' : '#ff7566', entity.shield, entity.maxHp);
      if (entity.isBoss) {
        ctx.fillStyle = 'rgba(5,10,16,0.84)';
        ctx.font = '800 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(entity.name, entity.x, entity.y - entity.radius - 25);
      }
    }

    drawGeneratedArtSprite(ctx, entity, image, baseColor, player, attacking) {
      const radius = Math.max(13, entity.radius * (entity.isBoss ? 1.28 : entity.heavy ? 1.14 : 1));
      const size = radius * 2.35;
      const sourceRatio = image.naturalWidth / Math.max(1, image.naturalHeight);
      const targetRatio = 1;
      let sx = 0; let sy = 0; let sw = image.naturalWidth; let sh = image.naturalHeight;
      if (sourceRatio > targetRatio) {
        sw = image.naturalHeight;
        sx = (image.naturalWidth - sw) * 0.5;
      } else {
        sh = image.naturalWidth;
        sy = (image.naturalHeight - sh) * 0.5;
      }
      ctx.save();
      ctx.beginPath();
      if (entity.isBoss) {
        const r = size * 0.52;
        for (let i = 0; i < 8; i += 1) {
          const a = -Math.PI / 2 + i * Math.PI / 4;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
      } else {
        ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
      }
      ctx.clip();
      ctx.drawImage(image, sx, sy, sw, sh, -size * 0.5, -size * 0.5, size, size);
      const gradient = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
      gradient.addColorStop(0, 'rgba(255,255,255,0.05)');
      gradient.addColorStop(1, player ? 'rgba(31,143,210,0.22)' : 'rgba(210,56,45,0.24)');
      ctx.fillStyle = gradient;
      ctx.fillRect(-size * 0.5, -size * 0.5, size, size);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = attacking ? '#fff1a3' : baseColor;
      ctx.lineWidth = entity.isBoss ? 4.5 : 3;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5 + 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = player ? 'rgba(130,225,255,0.7)' : 'rgba(255,132,112,0.75)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5 + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (attacking) {
        ctx.fillStyle = 'rgba(255,238,151,0.26)';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.52, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawTrooperSprite(ctx, entity, baseColor, player, attacking) {
      const r = Math.max(10, entity.radius);
      const s = r / 14;
      const sprite = entity.sprite || 'rifle';
      ctx.save();
      ctx.scale(s, s);
      const accent = player ? '#d4f7ff' : '#ffe0d8';
      const dark = '#101b24';
      const metal = '#7d92a1';
      const step = entity.moving ? Math.sin(Number(entity.walkPhase || 0)) * 2.3 : 0;

      // 双腿和靴子，朝向始终沿局部 +X。
      ctx.strokeStyle = dark;
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-3, -3);
      ctx.lineTo(-8 + step, -7);
      ctx.moveTo(-3, 3);
      ctx.lineTo(-8 - step, 7);
      ctx.stroke();
      ctx.strokeStyle = metal;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-5, -3);
      ctx.lineTo(-9 + step, -7);
      ctx.moveTo(-5, 3);
      ctx.lineTo(-9 - step, 7);
      ctx.stroke();

      if (sprite === 'medic' || sprite === 'tesla' || sprite === 'flamer' || sprite === 'mage') {
        ctx.fillStyle = dark;
        this.roundRect(ctx, -10, -7, 8, 14, 3);
        ctx.fill();
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      if (sprite === 'flamer') {
        ctx.fillStyle = '#5b6b73';
        ctx.beginPath(); ctx.arc(-7, -4, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-7, 4, 3.2, 0, Math.PI * 2); ctx.fill();
      }

      const body = ctx.createLinearGradient(-8, -9, 8, 9);
      body.addColorStop(0, accent);
      body.addColorStop(0.22, baseColor);
      body.addColorStop(1, dark);
      ctx.fillStyle = body;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      this.roundRect(ctx, -7, -8, 14, 16, 5);
      ctx.fill();
      ctx.stroke();

      // 肩甲和头盔。
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(-1, -8, 6.5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = baseColor;
      ctx.beginPath(); ctx.arc(6, 0, 5.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#07131d';
      this.roundRect(ctx, 7, -3.2, 4.8, 6.4, 2);
      ctx.fill();
      ctx.fillStyle = sprite.startsWith('mirror') ? '#eaa2ff' : '#aef3ff';
      this.roundRect(ctx, 8.3, -2.1, 2.4, 4.2, 1.2);
      ctx.fill();

      if (sprite === 'shield' || sprite === 'shieldBot') {
        const shield = ctx.createLinearGradient(8, -11, 18, 11);
        shield.addColorStop(0, accent);
        shield.addColorStop(0.35, baseColor);
        shield.addColorStop(1, '#24313a');
        ctx.fillStyle = shield;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(9, -10); ctx.lineTo(17, -7); ctx.lineTo(18, 6); ctx.lineTo(12, 11); ctx.lineTo(8, 5); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(12, -7); ctx.lineTo(13, 8); ctx.stroke();
      } else if (sprite === 'blade') {
        ctx.strokeStyle = '#e9fbff';
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(3, -5); ctx.lineTo(18, -10); ctx.lineTo(14, -5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(3, 5); ctx.lineTo(18, 10); ctx.lineTo(14, 5); ctx.stroke();
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(9, -7); ctx.lineTo(18, -10); ctx.moveTo(9, 7); ctx.lineTo(18, 10); ctx.stroke();
      } else if (sprite === 'medic') {
        ctx.fillStyle = '#f3ffff';
        ctx.beginPath(); ctx.arc(-6, 0, 4.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4cd7aa';
        ctx.fillRect(-8.5, -1.3, 5, 2.6);
        ctx.fillRect(-7.2, -2.6, 2.6, 5.2);
        ctx.strokeStyle = '#8fffe0';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(4, 6); ctx.lineTo(15, 7); ctx.stroke();
      } else if (sprite === 'mage') {
        ctx.strokeStyle = metal;
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(1, -5); ctx.lineTo(16, -9); ctx.stroke();
        const pulse = 3.5 + Math.sin(this.elapsed * 6) * 0.7;
        ctx.fillStyle = baseColor;
        ctx.shadowColor = baseColor;
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(17, -9, pulse, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      } else if (sprite === 'tesla') {
        ctx.strokeStyle = '#b9f8ff';
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(-8, -7); ctx.lineTo(-12, -12); ctx.lineTo(-7, -15); ctx.lineTo(-11, -19);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-8, 7); ctx.lineTo(-12, 12); ctx.lineTo(-7, 15); ctx.lineTo(-11, 19);
        ctx.stroke();
        ctx.strokeStyle = metal;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(16, 0); ctx.stroke();
        ctx.fillStyle = '#d8fbff'; ctx.beginPath(); ctx.arc(17, 0, 2.8, 0, Math.PI * 2); ctx.fill();
      } else if (sprite === 'flamer') {
        ctx.strokeStyle = '#4d5a62';
        ctx.lineWidth = 4.2;
        ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(17, 0); ctx.stroke();
        ctx.strokeStyle = '#f6c36b';
        ctx.lineWidth = 1.7;
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(19, 0); ctx.stroke();
        if (attacking) {
          const flame = ctx.createLinearGradient(18, 0, 31, 0);
          flame.addColorStop(0, '#fff2a6'); flame.addColorStop(0.45, '#ff9c43'); flame.addColorStop(1, 'rgba(255,57,37,0)');
          ctx.fillStyle = flame;
          ctx.beginPath(); ctx.moveTo(18, -3); ctx.quadraticCurveTo(27, -7, 32, 0); ctx.quadraticCurveTo(27, 7, 18, 3); ctx.closePath(); ctx.fill();
        }
      } else if (sprite === 'mortar') {
        ctx.fillStyle = '#283640';
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(2, 0, 7.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.rotate(-0.48);
        ctx.fillStyle = metal;
        this.roundRect(ctx, 2, -3.2, 18, 6.4, 2.5); ctx.fill();
        ctx.fillStyle = '#07131d'; ctx.fillRect(16, -2.2, 5, 4.4);
        ctx.restore();
      } else {
        const longGun = sprite === 'sniper';
        ctx.strokeStyle = '#18262f';
        ctx.lineWidth = longGun ? 4 : 4.6;
        ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(longGun ? 24 : 18, -3); ctx.stroke();
        ctx.strokeStyle = metal;
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(4, -3); ctx.lineTo(longGun ? 26 : 20, -3); ctx.stroke();
        if (longGun) {
          ctx.fillStyle = '#bfeefa'; ctx.fillRect(9, -5.2, 7, 2.2);
          ctx.strokeStyle = baseColor; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(22, -5); ctx.lineTo(22, -1); ctx.stroke();
        }
        if (sprite === 'scout') {
          ctx.strokeStyle = baseColor; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(-4, -9); ctx.lineTo(-9, -15); ctx.stroke();
          ctx.fillStyle = '#d8fbff'; ctx.beginPath(); ctx.arc(-10, -16, 2, 0, Math.PI * 2); ctx.fill();
        }
        if (sprite === 'scrapper') {
          ctx.strokeStyle = '#f1bd74'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(-7, 7); ctx.lineTo(-13, 12); ctx.lineTo(-9, 14); ctx.stroke();
        }
        if (attacking) {
          ctx.fillStyle = '#fff4b0';
          ctx.shadowColor = '#ffcf66'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.moveTo(longGun ? 26 : 20, -6); ctx.lineTo(longGun ? 32 : 26, -3); ctx.lineTo(longGun ? 26 : 20, 0); ctx.closePath(); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      ctx.restore();
    }

    drawDroneSprite(ctx, entity, baseColor, player, attacking) {
      const r = Math.max(10, entity.radius);
      const s = r / 14;
      ctx.save();
      ctx.scale(s, s);
      const accent = player ? '#d5f9ff' : '#ffe0d7';
      const wingBeat = 0.8 + Math.sin(this.elapsed * 12 + entity.x) * 0.14;
      ctx.strokeStyle = '#30424e';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(-12, -9 * wingBeat); ctx.moveTo(-2, 2); ctx.lineTo(-12, 9 * wingBeat); ctx.stroke();
      ctx.fillStyle = 'rgba(180,238,255,0.2)';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(-13, -10 * wingBeat, 6, 2.6, -0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-13, 10 * wingBeat, 6, 2.6, 0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const body = ctx.createLinearGradient(-9, -7, 10, 7);
      body.addColorStop(0, accent); body.addColorStop(0.35, baseColor); body.addColorStop(1, '#14212a');
      ctx.fillStyle = body;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-3, -8); ctx.lineTo(9, -5); ctx.lineTo(14, 0); ctx.lineTo(9, 5); ctx.lineTo(-3, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#07131d'; ctx.beginPath(); ctx.ellipse(7, 0, 5, 3.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = entity.sprite === 'firebug' ? '#ffbc52' : '#bdf6ff';
      ctx.beginPath(); ctx.arc(9, 0, 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9badb7'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(4, -3); ctx.lineTo(19, -5); ctx.moveTo(4, 3); ctx.lineTo(19, 5); ctx.stroke();
      if (attacking) {
        ctx.fillStyle = entity.sprite === 'firebug' ? '#ff8b39' : '#e8fbff';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(21, entity.sprite === 'firebug' ? 0 : -5, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    drawCreatureSprite(ctx, entity, baseColor, player, attacking) {
      const r = Math.max(10, entity.radius);
      const s = r / 15;
      const sprite = entity.sprite;
      ctx.save();
      ctx.scale(s, s);
      const dark = '#102019';
      const pale = player ? '#dbfbff' : '#ffe1d7';
      const step = entity.moving ? Math.sin(Number(entity.walkPhase || 0)) * 2.4 : 0;

      // 多足轮廓，让生物不再像贴着图标的圆点。
      ctx.strokeStyle = dark;
      ctx.lineCap = 'round';
      ctx.lineWidth = sprite === 'beast' || sprite === 'devourer' ? 4.5 : 3.2;
      [[-5,-6,-11 + step,-11],[-5,6,-11 - step,11],[3,-6,8 - step,-12],[3,6,8 + step,12]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });

      if (sprite === 'stalker' || sprite === 'vine') {
        ctx.strokeStyle = '#66c884';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.bezierCurveTo(-18, -8, -18, 9, -25, 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-5, -6); ctx.quadraticCurveTo(-7, -15, -1, -18); ctx.stroke();
      } else if (sprite === 'imp' || sprite === 'frostling') {
        ctx.strokeStyle = sprite === 'imp' ? '#ff9c45' : '#b9f8ff';
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-17, -11); ctx.moveTo(-8, 4); ctx.lineTo(-17, 11); ctx.stroke();
      }

      const body = ctx.createRadialGradient(5, -5, 2, 0, 0, 18);
      body.addColorStop(0, pale);
      body.addColorStop(0.22, baseColor);
      body.addColorStop(1, dark);
      ctx.fillStyle = body;
      ctx.strokeStyle = pale;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (sprite === 'spore') {
        ctx.ellipse(-1, 0, 13, 10, 0, 0, Math.PI * 2);
      } else if (sprite === 'vine') {
        ctx.moveTo(-12, 0); ctx.quadraticCurveTo(-3, -14, 10, -7); ctx.quadraticCurveTo(18, 0, 10, 7); ctx.quadraticCurveTo(-3, 14, -12, 0);
      } else {
        ctx.ellipse(-1, 0, sprite === 'beast' || sprite === 'devourer' ? 16 : 13, sprite === 'beast' ? 11 : 9, 0, 0, Math.PI * 2);
      }
      ctx.fill(); ctx.stroke();

      if (sprite === 'spore') {
        ctx.fillStyle = '#e1b3ff';
        for (let i = 0; i < 5; i += 1) {
          const a = i * Math.PI * 2 / 5;
          ctx.beginPath(); ctx.arc(-3 + Math.cos(a) * 9, Math.sin(a) * 7, 2.3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = '#bdf6d0'; ctx.lineWidth = 2.3;
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(19, -4); ctx.stroke();
      } else {
        // 头、下颚、眼睛。
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(7, -7); ctx.lineTo(18, -5); ctx.lineTo(21, 0); ctx.lineTo(18, 6); ctx.lineTo(7, 7); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = pale; ctx.lineWidth = 1.3; ctx.stroke();
        ctx.fillStyle = sprite === 'imp' ? '#fff09c' : sprite === 'frostling' ? '#dcfbff' : '#d7ff9c';
        ctx.beginPath(); ctx.arc(15, -2.5, 1.8, 0, Math.PI * 2); ctx.fill();
        if (sprite === 'devourer' || sprite === 'beast') {
          ctx.strokeStyle = '#f4eee5'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(17, 2); ctx.lineTo(22, 5); ctx.moveTo(16, 1); ctx.lineTo(21, -1); ctx.stroke();
        }
      }

      if (sprite === 'frostling') {
        ctx.fillStyle = '#d9fbff';
        ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(0, -17); ctx.lineTo(4, -8); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(0, 17); ctx.lineTo(4, 8); ctx.closePath(); ctx.fill();
      }
      if (sprite === 'imp') {
        ctx.fillStyle = '#ffbe66';
        ctx.beginPath(); ctx.moveTo(5, -7); ctx.lineTo(11, -15); ctx.lineTo(13, -5); ctx.closePath(); ctx.fill();
      }
      if (attacking) {
        ctx.fillStyle = sprite === 'imp' ? '#ff9b3d' : sprite === 'frostling' ? '#dffcff' : '#d7ff8a';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(sprite === 'spore' ? 21 : 24, sprite === 'spore' ? -5 : 0, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    drawHeavySprite(ctx, entity, baseColor, player, attacking) {
      const r = Math.max(15, entity.radius);
      const s = r / 22;
      const sprite = entity.sprite || 'mech';
      ctx.save();
      ctx.scale(s, s);
      const accent = player ? '#d5f8ff' : '#ffe0d6';
      const dark = '#101922';
      const metal = '#607583';
      const step = entity.moving ? Math.sin(Number(entity.walkPhase || 0)) * 2.5 : 0;

      if (sprite === 'tank' || sprite === 'carrier') {
        ctx.fillStyle = '#0a1117';
        this.roundRect(ctx, -18, -15, 32, 8, 4); ctx.fill();
        this.roundRect(ctx, -18, 7, 32, 8, 4); ctx.fill();
        ctx.strokeStyle = metal; ctx.lineWidth = 2;
        for (let x = -14; x <= 10; x += 8) {
          ctx.beginPath(); ctx.moveTo(x, -14); ctx.lineTo(x + 4, -8); ctx.moveTo(x, 14); ctx.lineTo(x + 4, 8); ctx.stroke();
        }
      } else {
        ctx.strokeStyle = dark;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(-13 + step, -17); ctx.moveTo(-8, 8); ctx.lineTo(-13 - step, 17); ctx.stroke();
        ctx.strokeStyle = metal; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-9, -8); ctx.lineTo(-14 + step, -17); ctx.moveTo(-9, 8); ctx.lineTo(-14 - step, 17); ctx.stroke();
        if (sprite === 'titan' || sprite === 'walker') {
          ctx.beginPath(); ctx.moveTo(5, -9); ctx.lineTo(10 - step, -18); ctx.moveTo(5, 9); ctx.lineTo(10 + step, 18); ctx.stroke();
        }
      }

      const hull = ctx.createLinearGradient(-18, -16, 17, 16);
      hull.addColorStop(0, accent); hull.addColorStop(0.25, baseColor); hull.addColorStop(0.62, '#334651'); hull.addColorStop(1, dark);
      ctx.fillStyle = hull;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      if (sprite === 'brute' || sprite === 'mirrorKnight') {
        ctx.moveTo(-15, -7); ctx.lineTo(-5, -16); ctx.lineTo(10, -12); ctx.lineTo(18, 0); ctx.lineTo(10, 12); ctx.lineTo(-5, 16); ctx.lineTo(-15, 7); ctx.closePath();
      } else {
        ctx.moveTo(-17, -11); ctx.lineTo(7, -14); ctx.lineTo(17, -7); ctx.lineTo(19, 7); ctx.lineTo(7, 14); ctx.lineTo(-17, 11); ctx.closePath();
      }
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#0a141c';
      ctx.beginPath(); ctx.ellipse(4, 0, 8, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = baseColor; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = sprite === 'mirrorKnight' ? '#f2b0ff' : '#bff5ff';
      this.roundRect(ctx, 8, -3.5, 5, 7, 2); ctx.fill();

      if (sprite === 'brute' || sprite === 'mirrorKnight') {
        ctx.fillStyle = sprite === 'mirrorKnight' ? 'rgba(223,144,255,0.38)' : 'rgba(255,255,255,0.2)';
        ctx.strokeStyle = accent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(12, -17); ctx.lineTo(24, -11); ctx.lineTo(25, 9); ctx.lineTo(14, 17); ctx.lineTo(9, 7); ctx.lineTo(9, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#e9f8ff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(27, 17); ctx.stroke();
      } else if (sprite === 'carrier') {
        ctx.fillStyle = '#2a1510';
        ctx.strokeStyle = '#ffb05f'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(-7, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff7b39';
        for (let i = 0; i < 5; i += 1) { const a = this.elapsed * 0.5 + i * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(-7 + Math.cos(a) * 6, Math.sin(a) * 6, 1.6, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = metal; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(26, 0); ctx.stroke();
      } else {
        const barrelY = sprite === 'titan' ? -7 : 0;
        ctx.strokeStyle = '#1b2a33'; ctx.lineWidth = sprite === 'tank' || sprite === 'titan' ? 7 : 5;
        ctx.beginPath(); ctx.moveTo(3, barrelY); ctx.lineTo(sprite === 'titan' ? 34 : 29, barrelY); ctx.stroke();
        ctx.strokeStyle = metal; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(8, barrelY); ctx.lineTo(sprite === 'titan' ? 36 : 31, barrelY); ctx.stroke();
        if (sprite === 'titan') {
          ctx.strokeStyle = '#aeeeff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(18, 15); ctx.stroke();
        }
        if (attacking) {
          ctx.fillStyle = '#fff3ad'; ctx.shadowColor = '#ffc85e'; ctx.shadowBlur = 16;
          ctx.beginPath(); ctx.moveTo(sprite === 'titan' ? 36 : 31, barrelY - 6); ctx.lineTo(sprite === 'titan' ? 46 : 41, barrelY); ctx.lineTo(sprite === 'titan' ? 36 : 31, barrelY + 6); ctx.closePath(); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      ctx.restore();
    }

    drawBuildingSprite(ctx, entity, baseColor, player, attacking) {
      const r = Math.max(16, entity.radius);
      const s = r / 22;
      const sprite = entity.sprite || 'turret';
      ctx.save();
      ctx.scale(s, s);
      const accent = player ? '#d6f8ff' : '#ffe1d7';
      const dark = '#0b151d';
      const metal = '#607582';

      if (sprite === 'barricade') {
        ctx.fillStyle = dark;
        this.roundRect(ctx, -22, -14, 44, 28, 5); ctx.fill();
        const plate = ctx.createLinearGradient(-22, -14, 22, 14);
        plate.addColorStop(0, accent); plate.addColorStop(0.24, baseColor); plate.addColorStop(1, '#26343d');
        ctx.fillStyle = plate; ctx.strokeStyle = accent; ctx.lineWidth = 1.6;
        [-15, 0, 15].forEach((x) => { ctx.beginPath(); ctx.moveTo(x - 8, -12); ctx.lineTo(x + 7, -12); ctx.lineTo(x + 10, 10); ctx.lineTo(x - 10, 10); ctx.closePath(); ctx.fill(); ctx.stroke(); });
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.stroke();
      } else if (sprite === 'nest' || sprite === 'sporePod' || sprite === 'bloomBoss') {
        const organic = ctx.createRadialGradient(-5, -7, 2, 0, 0, 27);
        organic.addColorStop(0, '#efffd7'); organic.addColorStop(0.3, baseColor); organic.addColorStop(1, '#18301d');
        ctx.fillStyle = organic; ctx.strokeStyle = '#d9ffc4'; ctx.lineWidth = 1.6;
        for (let i = 0; i < (sprite === 'bloomBoss' ? 10 : 7); i += 1) {
          const a = this.elapsed * 0.08 + i * Math.PI * 2 / (sprite === 'bloomBoss' ? 10 : 7);
          ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(12, 0, sprite === 'bloomBoss' ? 17 : 12, sprite === 'bloomBoss' ? 6 : 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
        }
        ctx.fillStyle = '#15271a'; ctx.beginPath(); ctx.arc(0, 0, sprite === 'bloomBoss' ? 14 : 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e7b7ff';
        for (let i = 0; i < 5; i += 1) { const a = i * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * 7, Math.sin(a) * 7, 2.4, 0, Math.PI * 2); ctx.fill(); }
      } else {
        // 六边形基座。
        const base = ctx.createLinearGradient(-21, -19, 21, 19);
        base.addColorStop(0, accent); base.addColorStop(0.23, baseColor); base.addColorStop(1, dark);
        ctx.fillStyle = base; ctx.strokeStyle = accent; ctx.lineWidth = 1.7;
        this.hexagon(ctx, 0, 0, 21, sprite === 'hospital' || sprite === 'repairNode' ? 8 : 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#07121a'; this.hexagon(ctx, 0, 0, 13, 6); ctx.fill();

        if (sprite === 'turret') {
          ctx.fillStyle = metal; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
          ctx.save(); ctx.rotate(Number(entity.facing || 0));
          ctx.strokeStyle = '#17252e'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(27, 0); ctx.stroke();
          ctx.strokeStyle = '#91a6b2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(29, 0); ctx.stroke();
          if (attacking) { ctx.fillStyle = '#fff2a3'; ctx.beginPath(); ctx.moveTo(29,-5); ctx.lineTo(38,0); ctx.lineTo(29,5); ctx.closePath(); ctx.fill(); }
          ctx.restore();
        } else if (sprite === 'hospital' || sprite === 'repairNode') {
          ctx.fillStyle = '#eaffff'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = sprite === 'repairNode' ? '#65d9ff' : '#55e6ad';
          ctx.fillRect(-6, -2, 12, 4); ctx.fillRect(-2, -6, 4, 12);
          ctx.strokeStyle = ctx.fillStyle; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.5;
          for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.arc(0, 0, 12 + i * 4 + Math.sin(this.elapsed * 3 + i) * 1.5, 0, Math.PI * 2); ctx.stroke(); }
          ctx.globalAlpha = 1;
        } else if (sprite === 'beacon' || sprite === 'pylon') {
          ctx.strokeStyle = metal; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -22); ctx.stroke();
          ctx.fillStyle = baseColor; ctx.shadowColor = baseColor; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.arc(0, -24, sprite === 'pylon' ? 7 : 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
          ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -24, 12 + Math.sin(this.elapsed * 3) * 2, 0, Math.PI * 2); ctx.stroke();
        } else if (sprite === 'totem') {
          ctx.fillStyle = '#d7fbff';
          ctx.beginPath(); ctx.moveTo(0,-25); ctx.lineTo(8,-9); ctx.lineTo(2,10); ctx.lineTo(-8,-8); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#8deaff'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#73d5ff';
          for (let i = 0; i < 4; i += 1) { const a = this.elapsed * 0.7 + i * Math.PI / 2; ctx.beginPath(); ctx.arc(Math.cos(a) * 14, -7 + Math.sin(a) * 8, 2.5, 0, Math.PI * 2); ctx.fill(); }
        } else {
          ctx.fillStyle = baseColor; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-7,-7); ctx.lineTo(7,7); ctx.moveTo(7,-7); ctx.lineTo(-7,7); ctx.stroke();
        }
      }
      ctx.restore();
    }

    drawBossSprite(ctx, entity, baseColor, player, attacking) {
      const r = Math.max(25, entity.radius);
      const s = r / 34;
      const sprite = entity.sprite || 'coreBoss';
      ctx.save();
      ctx.scale(s, s);
      const pale = player ? '#e1fbff' : '#ffe4dc';
      const dark = '#0b141c';
      const pulse = 1 + Math.sin(this.elapsed * 3.4) * 0.05;
      ctx.scale(pulse, pulse);

      if (sprite === 'frostBoss') {
        ctx.strokeStyle = '#85ddff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-11,-9); ctx.lineTo(-23,-24); ctx.moveTo(-11,9); ctx.lineTo(-23,24); ctx.moveTo(7,-11); ctx.lineTo(18,-27); ctx.moveTo(7,11); ctx.lineTo(18,27); ctx.stroke();
        const ice = ctx.createLinearGradient(-28,-30,25,30);
        ice.addColorStop(0,'#efffff'); ice.addColorStop(0.28,baseColor); ice.addColorStop(1,'#17344d');
        ctx.fillStyle = ice; ctx.strokeStyle = pale; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-24,0); ctx.lineTo(-13,-24); ctx.lineTo(0,-18); ctx.lineTo(12,-30); ctx.lineTo(24,-9); ctx.lineTo(31,0); ctx.lineTo(23,13); ctx.lineTo(7,22); ctx.lineTo(-9,19); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(4,-9); ctx.lineTo(18,-5); ctx.lineTo(21,6); ctx.lineTo(5,10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e7ffff'; ctx.beginPath(); ctx.arc(14,-2,3,0,Math.PI*2); ctx.fill();
        for (let i=0;i<5;i+=1){ctx.save();ctx.rotate(i*Math.PI*2/5);ctx.fillStyle='rgba(198,247,255,0.55)';ctx.beginPath();ctx.moveTo(-3,-24);ctx.lineTo(0,-38);ctx.lineTo(4,-24);ctx.closePath();ctx.fill();ctx.restore();}
      } else if (sprite === 'magmaBoss') {
        ctx.strokeStyle = '#34201c'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-10,-9);ctx.lineTo(-22,-24);ctx.moveTo(-10,9);ctx.lineTo(-22,24);ctx.moveTo(11,-8);ctx.lineTo(21,-23);ctx.moveTo(11,8);ctx.lineTo(21,23);ctx.stroke();
        const rock = ctx.createRadialGradient(9,-8,2,0,0,38);
        rock.addColorStop(0,'#ffe47a');rock.addColorStop(0.2,'#ff783d');rock.addColorStop(0.55,baseColor);rock.addColorStop(1,'#211619');
        ctx.fillStyle=rock;ctx.strokeStyle='#ffb567';ctx.lineWidth=2;
        this.hexagon(ctx,0,0,31,8);ctx.fill();ctx.stroke();
        ctx.strokeStyle='#ff8a45';ctx.lineWidth=2.2;
        ctx.beginPath();ctx.moveTo(-18,-18);ctx.lineTo(-5,-3);ctx.lineTo(-11,18);ctx.moveTo(12,-22);ctx.lineTo(5,-4);ctx.lineTo(19,11);ctx.stroke();
        ctx.fillStyle='#fff0a5';ctx.beginPath();ctx.arc(12,-3,4,0,Math.PI*2);ctx.fill();
      } else if (sprite === 'hiveBoss') {
        const ring = (radius, rotation, color) => {ctx.save();ctx.rotate(rotation);ctx.strokeStyle=color;ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,0,radius,radius*0.42,0,0,Math.PI*2);ctx.stroke();ctx.restore();};
        ring(30,this.elapsed*0.4,baseColor);ring(25,-this.elapsed*0.58,pale);ring(18,this.elapsed*0.8,'#9deaff');
        ctx.fillStyle=dark;ctx.strokeStyle=pale;ctx.lineWidth=2;this.hexagon(ctx,0,0,17,6);ctx.fill();ctx.stroke();
        ctx.fillStyle=baseColor;ctx.shadowColor=baseColor;ctx.shadowBlur=18;ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
        for(let i=0;i<4;i+=1){const a=this.elapsed*0.9+i*Math.PI/2;ctx.save();ctx.translate(Math.cos(a)*34,Math.sin(a)*18);ctx.rotate(a);ctx.fillStyle='#21323d';ctx.strokeStyle=pale;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(0,-5);ctx.lineTo(8,0);ctx.lineTo(0,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
      } else {
        // 镜界核心化身：错位的双层晶体与旋转碎片。
        ctx.save();ctx.rotate(this.elapsed*0.12);
        ctx.fillStyle='rgba(207,125,255,0.3)';ctx.strokeStyle='#efc7ff';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(-27,0);ctx.lineTo(-8,-31);ctx.lineTo(9,-15);ctx.lineTo(28,0);ctx.lineTo(9,16);ctx.lineTo(-8,31);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
        ctx.save();ctx.rotate(-this.elapsed*0.18);
        ctx.fillStyle=baseColor;ctx.strokeStyle=pale;ctx.lineWidth=2.2;
        this.hexagon(ctx,0,0,22,6);ctx.fill();ctx.stroke();ctx.restore();
        ctx.fillStyle=dark;ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#f5d5ff';ctx.shadowColor='#df8cff';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(5,-2,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
        for(let i=0;i<6;i+=1){const a=this.elapsed*0.55+i*Math.PI/3;ctx.save();ctx.translate(Math.cos(a)*37,Math.sin(a)*25);ctx.rotate(a);ctx.fillStyle=i%2?'#c3f4ff':'#e5a8ff';ctx.beginPath();ctx.moveTo(-3,-7);ctx.lineTo(7,0);ctx.lineTo(-3,7);ctx.closePath();ctx.fill();ctx.restore();}
      }

      if (attacking) {
        ctx.fillStyle = '#fff6c2'; ctx.shadowColor = baseColor; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.arc(37, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    drawHealthBar(ctx, x, y, width, height, ratio, color, shield = 0, maxHp = 1) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      this.roundRect(ctx, x, y, width, height, height / 2);
      ctx.fill();
      if (ratio > 0) {
        ctx.fillStyle = color;
        this.roundRect(ctx, x + 1, y + 1, Math.max(1, (width - 2) * clamp(ratio, 0, 1)), height - 2, (height - 2) / 2);
        ctx.fill();
      }
      if (shield > 0) {
        ctx.fillStyle = '#d39cff';
        const shieldRatio = clamp(shield / Math.max(1, maxHp), 0, 0.65);
        this.roundRect(ctx, x + 1, y - 3, Math.max(2, (width - 2) * shieldRatio), 2, 1);
        ctx.fill();
      }
      ctx.restore();
    }

    drawProjectiles(ctx) {
      this.projectiles.forEach((projectile) => {
        const t = clamp((this.elapsed - projectile.start) / Math.max(0.001, projectile.end - projectile.start), 0, 1);
        const x = lerp(projectile.x1, projectile.x2, t);
        let y = lerp(projectile.y1, projectile.y2, t);
        if (projectile.arc) y -= Math.sin(t * Math.PI) * 54;
        ctx.save();
        ctx.strokeStyle = projectile.color;
        ctx.fillStyle = projectile.color;
        ctx.lineWidth = projectile.thick;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(lerp(projectile.x1, projectile.x2, Math.max(0, t - 0.12)), projectile.arc ? lerp(projectile.y1, projectile.y2, Math.max(0, t - 0.12)) - Math.sin(Math.max(0, t - 0.12) * Math.PI) * 54 : lerp(projectile.y1, projectile.y2, Math.max(0, t - 0.12)));
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, projectile.thick + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    drawParticles(ctx) {
      this.particles.forEach((particle) => {
        ctx.save();
        ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    drawFloatingTexts(ctx) {
      this.floatingTexts.forEach((text) => {
        ctx.save();
        ctx.globalAlpha = clamp(text.life / text.maxLife, 0, 1);
        ctx.fillStyle = text.color;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 3;
        ctx.font = '800 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeText(text.text, text.x, text.y);
        ctx.fillText(text.text, text.x, text.y);
        ctx.restore();
      });
    }

    drawSelectionGhost(ctx) {
      if (!this.mouse.inside || this.selectedIndex == null || !this.hand[this.selectedIndex]) return;
      const item = this.hand[this.selectedIndex];
      const card = RF.CARDS[item.cardId];
      if (!card) return;
      const x = clamp(this.mouse.x, FIELD.left, FIELD.right);
      const y = clamp(this.mouse.y, FIELD.top, FIELD.bottom);
      const route = this.nearestRoute(x, y);
      const preview = this.getPlacementPreview(this.selectedIndex, x, y);
      const valid = preview.ok;
      const radius = card.type === 'spell'
        ? Number(card.spell?.radius || 110)
        : card.type === 'building'
          ? Number(card.building?.radius || 22) + 11
          : Math.max(27, Number(card.unit?.radius || 12) + 15);
      const routePoint = this.routePointAtX(route, x);

      ctx.save();
      ctx.globalAlpha = 0.82;
      ctx.strokeStyle = valid ? '#7df1ff' : '#ff776a';
      ctx.fillStyle = valid ? 'rgba(100, 232, 255, 0.13)' : 'rgba(255, 100, 90, 0.13)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      if (card.type !== 'spell') {
        ctx.globalAlpha = 0.48;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(routePoint.x, routePoint.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = valid ? '#bff7ff' : '#ffc6bc';
        ctx.beginPath(); ctx.arc(routePoint.x, routePoint.y, 5, 0, Math.PI * 2); ctx.fill();
      }

      ctx.globalAlpha = 0.95;
      ctx.fillStyle = 'rgba(4,12,19,0.9)';
      const label = `${card.icon} ${card.name} · ${preview.routeName || this.routeName(route)}`;
      ctx.font = '800 14px system-ui, sans-serif';
      const labelWidth = Math.min(300, ctx.measureText(label).width + 28);
      const labelX = clamp(x - labelWidth / 2, FIELD.left + 4, FIELD.right - labelWidth - 4);
      const labelY = clamp(y - radius - 42, FIELD.top + 6, FIELD.bottom - 60);
      this.roundRect(ctx, labelX, labelY, labelWidth, 30, 10);
      ctx.fill();
      ctx.strokeStyle = valid ? 'rgba(125,241,255,0.7)' : 'rgba(255,119,106,0.75)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = valid ? '#d9fbff' : '#ffd6cf';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, labelX + labelWidth / 2, labelY + 15);

      if (!valid && preview.reason) {
        ctx.font = '700 11px system-ui, sans-serif';
        const reason = String(preview.reason).slice(0, 32);
        const reasonWidth = Math.min(360, ctx.measureText(reason).width + 24);
        const reasonX = clamp(x - reasonWidth / 2, FIELD.left + 4, FIELD.right - reasonWidth - 4);
        const reasonY = labelY + 34;
        ctx.fillStyle = 'rgba(56,13,13,0.9)';
        this.roundRect(ctx, reasonX, reasonY, reasonWidth, 24, 8); ctx.fill();
        ctx.fillStyle = '#ffd5cf';
        ctx.fillText(reason, reasonX + reasonWidth / 2, reasonY + 12);
      }
      ctx.restore();
    }
    drawPausedOverlay(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 7, 13, 0.72)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#f3fbff';
      ctx.font = '900 42px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('战术暂停', WIDTH / 2, HEIGHT / 2 - 12);
      ctx.fillStyle = 'rgba(220,240,250,0.72)';
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillText('按空格或点击暂停按钮继续', WIDTH / 2, HEIGHT / 2 + 24);
      ctx.restore();
    }

    roundRect(ctx, x, y, width, height, radius) {
      const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + width, y, x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x, y + height, r);
      ctx.arcTo(x, y + height, x, y, r);
      ctx.arcTo(x, y, x + width, y, r);
      ctx.closePath();
    }

    hexagon(ctx, x, y, radius, sides = 6) {
      ctx.beginPath();
      for (let i = 0; i < sides; i += 1) {
        const angle = -Math.PI / 2 + i * Math.PI * 2 / sides;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
  }

  RF.BattleEngine = BattleEngine;
  RF.BATTLE_CONSTANTS = Object.freeze({ WIDTH, HEIGHT, FIELD });
})();
