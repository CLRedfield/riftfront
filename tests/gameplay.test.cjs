/* Run with: node --test tests/gameplay.test.cjs. No runtime or test dependencies. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { runtime, playTurn } = require('./helpers.cjs');

test('all campaign, deck, faction, map, bundle and treasure references resolve', () => {
  const { RF } = runtime();
  for (const level of RF.LEVELS) {
    assert.ok(RF.MAPS[level.mapId], level.mapId);
    level.enemyDeck.forEach((id) => assert.ok(RF.CARDS[id], id));
    if (level.boss) assert.ok(RF.CARDS[level.boss.cardId]);
    assert.ok(level.stages.every((stage) => stage.energyMultiplier > 0 && stage.drawMultiplier > 0));
  }
  for (const list of [RF.DEFAULT_DECK.arsenal, ...Object.values(RF.ROGUE_STARTER_DECKS).map((d) => d.cards.arsenal), ...RF.ROGUE_BUNDLES.map((b) => b.cards)]) {
    assert.ok(Array.isArray(list)); list.forEach((id) => assert.ok(RF.CARDS[id], id));
  }
  assert.equal(RF.DEFAULT_DECK.arsenal.length, 30);
});

test('pause, completion and destruction reject deployment and archiving without mutation', () => {
  const { create } = runtime(); const { battle: b } = create();
  b.selectCard(0);
  const energy = b.energy, size = b.hand.length;
  b.paused = true;
  assert.equal(b.playCardAtIndex(0, 390, 205), false);
  assert.equal(b.archiveCard(0), false);
  b.update(1); assert.equal(b.elapsed, 0);
  b.paused = false;
  assert.equal(b.playCardAtIndex(0, 390, 205), true);
  assert.equal(b.hand.length, size - 1); assert.equal(b.energy, energy - 2);
  b.finishBattle(true, 'test');
  assert.equal(b.playCardAtIndex(0, 390, 205), false);
  assert.equal(b.archiveCard(0), false);
  b.destroy(); assert.equal(b.selectCard(0), false);
});

test('destroying a completed battle cancels its delayed result and duplicate completion', () => {
  const r = runtime(); let ends = 0;
  const { battle, listeners } = r.create(0, { onEnd: () => ends++ });
  battle.finishBattle(true, 'test'); battle.finishBattle(true, 'again');
  assert.equal(r.timers.size, 1);
  battle.destroy(); assert.equal(listeners.size, 0);
  r.flush(); assert.equal(ends, 0);
});

test('invalid or unaffordable placements never spend a card or energy', () => {
  const { create } = runtime(); const { battle: b } = create();
  for (const [x, y] of [[-1, 200], [1000, 205], [NaN, 200], [350, Infinity], [640, 360], [276, 205]]) {
    assert.equal(b.playCardAtIndex(0, x, y), false, `${x},${y}`);
  }
  assert.equal(b.energy, 5); assert.equal(b.hand.length, 5);
  b.energy = 0; assert.equal(b.playCardAtIndex(0, 390, 205), false);
});

test('canvas coordinate mapping includes object-fit letterboxing', () => {
  const { battle: b } = runtime().create();
  assert.equal(b.canvasPointFromClient(330, 220).x, 640);
  assert.equal(b.canvasPointFromClient(330, 220).y, 360);
  assert.equal(b.canvasPointFromClient(330, 25).inside, false);
});

test('full hands preserve card counts; discard reshuffle conserves the deck', () => {
  const { battle: b } = runtime().create();
  b.updateDraw(100); assert.equal(b.hand.length, 10);
  const pile = b.groupPiles.arsenal.length; b.updateDraw(100); assert.equal(b.groupPiles.arsenal.length, pile);
  while (b.groupPiles.arsenal.length) { b.archiveCharges = 2; b.archiveCard(0); b.drawNextPlayerCard(); }
  b.archiveCharges = 2; b.archiveCard(0); assert.ok(b.resupplyTimer > 0);
  b.updateResupply(9);
  assert.equal(b.hand.length + b.groupPiles.arsenal.length + b.groupDiscards.arsenal.length, 30);
});

test('difficulty tuning never mutates or multiplies the original level on retry', () => {
  const { RF } = runtime(); const original = RF.LEVELS[0];
  const one = RF.Experience.prepareConfig(original, 'relaxed');
  const two = RF.Experience.prepareConfig(one, 'relaxed');
  assert.equal(one.playerCoreHp, two.playerCoreHp);
  assert.equal(one.ai.damageMul, two.ai.damageMul);
  assert.ok(one.playerCoreHp > original.playerCoreHp);
  assert.ok(one.ai.damageMul < original.ai.damageMul);
});

test('ties require a real advantage; doing nothing does not grant a victory', () => {
  const r = runtime(); let result;
  const { battle: b } = r.create(0, { onEnd: (value) => { result = value; } });
  b.elapsed = b.duration; b.checkBattleEnd(); r.flush(); assert.equal(result.victory, false);
});

test('save import validates settings, standard deck copies and legacy expedition fields', () => {
  const { RF } = runtime(); const value = JSON.parse(JSON.stringify(RF.Storage.get()));
  value.campaign.completed = [1, '2', 2, 1.5, -1, 200];
  value.settings = { battleSpeed: 999, volume: 999, difficulty: 'bogus', sound: 'oops' };
  value.deck.arsenal = Array(30).fill('rifle_squad');
  value.rogue = { active: true, factionId: RF.FACTIONS[0].id, deck: RF.ROGUE_STARTER_DECKS[RF.FACTIONS[0].id].cards, depth: 1 };
  const encoded = Buffer.from(JSON.stringify(value)).toString('base64');
  RF.Storage.importSave(encoded);
  const result = RF.Storage.get();
  assert.equal(JSON.stringify(result.campaign.completed), '[1,2]');
  assert.equal(result.settings.battleSpeed, 1); assert.equal(result.settings.difficulty, 'standard');
  assert.equal(result.settings.volume, 1); assert.equal(result.settings.sound, true);
  assert.equal(result.deck.arsenal.filter((id) => id === 'rifle_squad').length, 2);
  assert.ok(Array.isArray(result.rogue.options)); assert.ok(Array.isArray(result.rogue.history));
  assert.throws(() => RF.Storage.importSave(Buffer.from('{}').toString('base64')));
  assert.equal(RF.Storage.get().rogue.depth, 1);
});

test('next mission follows the first incomplete mission, including free-select saves', () => {
  const { RF } = runtime(); const save = RF.Storage.get();
  save.campaign.completed = [1, 5, 8]; assert.equal(RF.Experience.nextLevel(save).id, 2);
});

test('a squad that pursued beyond a waypoint resumes moving forward', () => {
  const { battle: b } = runtime().create();
  let target;
  b.moveEntityToward = (entity, x, y) => { target = { x, y }; };
  b.advanceEntity({ x: 850, y: 230, radius: 14, speed: 30, side: 'player', lane: 0, waypointIndex: 1 }, 0.1, 1);
  assert.ok(target.x > 850, 'pursuit should not send the squad back to x=430');
});

test('forging only upgrades allied copies, never opposing copies', () => {
  const { RF, create } = runtime(); const { battle: b } = create(0, { playerMods: { cardUpgrades: { rifle_squad: 2, auto_turret: 2 } } });
  b.spawnCardUnits('player', RF.CARDS.rifle_squad, 0, 350, { y: 200 });
  b.spawnCardUnits('enemy', RF.CARDS.rifle_squad, 0, 1050, { y: 200 });
  const ally = b.entities.find((e) => e.side === 'player'), enemy = b.entities.find((e) => e.side === 'enemy');
  assert.equal(ally.maxHp, RF.CARDS.rifle_squad.unit.hp * 1.32);
  assert.equal(enemy.maxHp, RF.CARDS.rifle_squad.unit.hp * b.config.ai.hpMul);
  b.spawnCardBuilding('enemy', RF.CARDS.auto_turret, 1, 1050, { y: 520 });
  const tower = b.entities.find((e) => e.isBuilding); assert.equal(tower.maxHp, RF.CARDS.auto_turret.building.hp * b.config.ai.hpMul);
});

test('mirror copies have a telegraph, cooldown, reduced strength and finite lifetime', () => {
  const r = runtime(); const { battle: b } = r.create(5);
  b.hand = [{ uid: 'a', cardId: 'rifle_squad', group: 'arsenal' }, { uid: 'b', cardId: 'rifle_squad', group: 'arsenal' }];
  b.energy = 10;
  const p = b.findOpenPoint(400, 180, 20, 'player');
  assert.ok(b.playCardAtIndex(0, p.x, p.y)); assert.ok(b.playCardAtIndex(0, p.x, p.y));
  assert.equal(r.events.filter((e) => e.title === '镜像正在成形').length, 1);
  b.elapsed = 5.1; b.updateTimedActions();
  const copies = b.entities.filter((e) => e.side === 'enemy' && e.cardId === 'rifle_squad');
  assert.equal(copies.length, 3);
  assert.ok(copies.every((e) => e.expiresAt === 35.1 && e.maxHp < r.RF.CARDS.rifle_squad.unit.hp));
});

test('nightmare gates warn before spawning and cannot stack repeatedly in the same lane', () => {
  const r = runtime(); const { battle: b } = r.create(8);
  const boss = { alive: true };
  b.startBossPowerLoop(b.config.boss, boss);
  b.elapsed = 8.5; b.updateTimedActions();
  const gates = () => b.entities.filter(e => e.alive && e.cardId === 'shadow_gate');
  assert.equal(gates().length, 0);
  assert.equal(b.hazardVisuals.length, b.routeCount);
  b.elapsed = 11; b.updateTimedActions();
  assert.equal(gates().length, b.routeCount);
  b.elapsed = 25.5; b.updateTimedActions(); b.elapsed = 28; b.updateTimedActions();
  assert.equal(gates().length, b.routeCount);
  assert.deepEqual(r.errors, []);
});

test('every card can resolve its effect, including delayed spells and summons', () => {
  const r = runtime();
  for (const card of Object.values(r.RF.CARDS)) {
    const { battle: b } = r.create();
    b.spawnCardUnits('player', r.RF.CARDS.rifle_squad, 0, 400, { y: 230 });
    b.spawnCardUnits('enemy', r.RF.CARDS.rifle_squad, 0, 550, { y: 230 });
    b.playCardEffect(card.enemyOnly ? 'enemy' : 'player', card.id, 0, 460, { y: 230, source: 'audit' });
    for (let i = 0; i < 90; i++) b.update(0.1);
    assert.ok(b.entities.every((e) => [e.x, e.y, e.hp].every(Number.isFinite)), card.id);
    assert.deepEqual(r.errors, [], card.id); b.destroy();
  }
});

test('effects remain bounded, including reduced-motion mode', () => {
  const r = runtime(); const { battle: b } = r.create();
  for (let i = 0; i < 100; i++) b.createBurst(300, 200, '#fff', 60);
  assert.equal(b.particles.length, 300);
  b.particles = []; r.RF.Storage.get().settings.reducedMotion = true; b.createBurst(300, 200, '#fff', 60);
  assert.ok(b.particles.length <= 3);
});

test('all ten campaign battles simulate to completion with finite state, bosses and no timed-action errors', { timeout: 120000 }, () => {
  const results = [];
  for (let level = 0; level < 10; level++) {
    const r = runtime(1729 + level); let outcome;
    const { battle: b } = r.create(r.RF.Experience.prepareConfig(r.RF.LEVELS[level], 'standard'), { onEnd: (value) => { outcome = value; } });
    let peak = 0;
    for (let tick = 0; tick < 270 * 20 && !b.ended; tick++) {
      if (tick % 10 === 0) playTurn(b, r.RF);
      b.update(0.05); peak = Math.max(peak, b.entities.length);
      if (tick % 200 === 0) {
        assert.ok(Number.isFinite(b.energy));
        assert.ok(b.entities.every((e) => [e.x, e.y, e.hp, e.maxHp].every(Number.isFinite)), `level ${level + 1} invalid entity`);
      }
    }
    r.flush(); assert.ok(b.ended && outcome, `level ${level + 1} did not finish`);
    assert.deepEqual(r.errors, []);
    results.push({ level: level + 1, win: outcome.victory, seconds: Math.round(outcome.elapsed), cards: outcome.stats.cardsPlayed, peakEntities: peak, core: Math.round(outcome.coreRatio * 100), boss: b.bossSpawned });
    b.destroy();
  }
  console.log('Campaign simulation:', JSON.stringify(results));
});
