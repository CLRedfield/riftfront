const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
global.window = global;
global.Image = undefined;
global.RF = {};
RF.audio = { play() {}, setEnabled() {} };

['js/data.js', 'js/v140_data.js', 'js/engine.js', 'js/v140_engine.js'].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
});

const noop = () => {};
const context = new Proxy({}, {
  get: (target, key) => target[key] || noop,
  set: (target, key, value) => { target[key] = value; return true; }
});
const canvas = {
  width: 1280,
  height: 720,
  getContext: () => context,
  addEventListener: noop,
  removeEventListener: noop,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 })
};

function createEngine(level = RF.LEVELS[0]) {
  return new RF.BattleEngine(canvas, { ...level, ai: { ...level.ai, startDelay: 999 } }, {
    deck: RF.DEFAULT_DECK,
    onState: noop,
    onEvent: noop,
    onEnd: noop
  });
}

function createUnit(id, side, x, y, options = {}) {
  return {
    id,
    name: id,
    side,
    x,
    y,
    radius: options.radius || 12,
    mass: options.mass || 1,
    speed: options.speed ?? 78,
    range: options.range || 25,
    minRange: options.minRange || 0,
    role: options.role || 'melee',
    alive: true,
    isBuilding: false,
    flying: false,
    phaseMovement: false,
    lane: options.lane || 0,
    lockedTargetId: null,
    navPath: null,
    navPathIndex: 0,
    nextRepathAt: 0,
    lastNavGoal: null,
    moving: false,
    walkPhase: 0,
    unreachableTargets: {}
  };
}

function countOverlaps(units) {
  let pairs = 0;
  let minGap = Infinity;
  for (let i = 0; i < units.length; i += 1) {
    for (let j = i + 1; j < units.length; j += 1) {
      const gap = Math.hypot(units[i].x - units[j].x, units[i].y - units[j].y) - units[i].radius - units[j].radius;
      if (gap < 0) pairs += 1;
      minGap = Math.min(minGap, gap);
    }
  }
  return { pairs, minGap };
}

function testRoundedObstacleCollision() {
  const engine = createEngine();
  assert.strictEqual(engine.isPointBlocked(505, 119, 0), false, 'rounded visual corner should be walkable');
  assert.strictEqual(engine.isPointBlocked(540, 140, 0), true, 'solid body of rounded obstacle should remain blocked');
}

function testCrossLaneUsesOpenZone() {
  const engine = createEngine();
  const unit = createUnit('route-unit', 'player', 430, 205, { lane: 0 });
  const target = createUnit('route-target', 'enemy', 830, 515, { lane: 1, speed: 0 });
  unit.lockedTargetId = target.id;
  unit.navEngagementIndex = 0;
  engine.entities = [unit, target];
  engine.moveEntityToward(unit, target.x, target.y, 1 / 60, 1);
  assert.ok(unit.navPath?.length, 'cross-lane chase should produce a path');
  const centralCrossing = unit.navPath.filter((point) => point.x >= 500 && point.x <= 800 && point.y > 350);
  assert.strictEqual(centralCrossing.length, 0, 'unit should not cut from the upper bridge to the lower bridge inside the central zone');
}

function testUnreachableTargetRecovery() {
  const engine = createEngine();
  const unit = createUnit('blocked-unit', 'player', 430, 205, { lane: 0 });
  const target = createUnit('blocked-target', 'enemy', 640, 360, { speed: 0 });
  unit.lockedTargetId = target.id;
  unit.navEngagementIndex = 0;
  engine.entities = [unit, target];
  for (let tick = 0; tick < 240; tick += 1) {
    engine.elapsed = tick / 60;
    engine.moveEntityToward(unit, target.x, target.y, 1 / 60, 1);
  }
  assert.ok(unit.x > 560, 'failed search should still use a useful partial path');
  assert.strictEqual(unit.lockedTargetId, null, 'persistently unreachable target should be released');
}

function testSpawnOverlapEscapesMapObstacle() {
  const engine = createEngine();
  const unit = createUnit('escape-unit', 'player', 640, 360, { lane: 0 });
  const target = createUnit('escape-target', 'enemy', 430, 205, { lane: 0, speed: 0 });
  unit.lockedTargetId = target.id;
  unit.navEngagementIndex = 0;
  engine.entities = [unit, target];
  for (let tick = 0; tick < 300; tick += 1) {
    engine.elapsed = tick / 60;
    engine.moveEntityToward(unit, target.x, target.y, 1 / 60, 1);
  }
  assert.strictEqual(engine.isPointBlocked(unit.x, unit.y, unit.radius * 0.82), false, 'unit spawned inside terrain should move out of the blocker');
  assert.ok(Math.hypot(unit.x - target.x, unit.y - target.y) <= unit.range + target.radius, 'escaping unit should resume its original movement goal');
}

function testRetreatMovementDoesNotReuseAttackSlot() {
  const engine = createEngine();
  const unit = createUnit('retreat-unit', 'player', 520, 205, { lane: 0, minRange: 90, range: 130, role: 'ranged' });
  const target = createUnit('retreat-target', 'enemy', 500, 205, { lane: 0, speed: 0 });
  unit.lockedTargetId = target.id;
  engine.entities = [unit, target];
  const before = unit.x;
  engine.moveEntityToward(unit, unit.x - (target.x - unit.x), unit.y - (target.y - unit.y), 1 / 30, 1);
  assert.ok(unit.x > before, 'minimum-range retreat should move away instead of selecting an attack slot');
}

function testEngagementRingsReduceOverlap() {
  const engine = createEngine();
  const target = createUnit('ring-target', 'enemy', 900, 205, { radius: 14, mass: 2, speed: 0 });
  const units = [];
  for (let index = 0; index < 24; index += 1) {
    const unit = createUnit(`ring-${String(index).padStart(2, '0')}`, 'player', 370 - (index % 6) * 25, 155 + Math.floor(index / 6) * 25);
    unit.lockedTargetId = target.id;
    unit.navEngagementIndex = index;
    unit.navEngagementCount = 24;
    units.push(unit);
  }
  engine.entities = [...units, target];
  for (let tick = 0; tick < 720; tick += 1) {
    engine.elapsed = tick / 60;
    units.forEach((unit) => engine.moveEntityToward(unit, target.x, target.y, 1 / 60, 1));
  }
  const overlap = countOverlaps(units);
  assert.ok(overlap.pairs <= 6, `engagement rings left too many overlaps: ${overlap.pairs}`);
  assert.ok(overlap.minGap > -8, `engagement rings allowed excessive penetration: ${overlap.minGap.toFixed(2)}`);
}

function testEveryConfiguredRouteIsReachable() {
  let checked = 0;
  Object.values(RF.MAPS).forEach((map) => {
    map.routes.forEach((route, lane) => {
      const engine = createEngine({ ...RF.LEVELS[0], mapId: map.id });
      const start = route.points[0];
      const end = route.points[route.points.length - 1];
      const unit = createUnit(`route-${map.id}-${lane}`, 'player', start[0], start[1], { lane, speed: 82 });
      const target = createUnit(`target-${map.id}-${lane}`, 'enemy', end[0], end[1], { lane, radius: 14, speed: 0 });
      unit.lockedTargetId = target.id;
      unit.navEngagementIndex = 0;
      engine.entities = [unit, target];
      for (let tick = 0; tick < 1200; tick += 1) {
        engine.elapsed = tick / 60;
        engine.moveEntityToward(unit, target.x, target.y, 1 / 60, 1);
        if (Math.hypot(unit.x - target.x, unit.y - target.y) <= unit.range + target.radius) break;
      }
      const distance = Math.hypot(unit.x - target.x, unit.y - target.y);
      assert.ok(Number.isFinite(distance), `${map.id} lane ${lane} produced an invalid position`);
      assert.ok(distance <= unit.range + target.radius + 2, `${map.id} lane ${lane} could not reach its target (${distance.toFixed(1)}px)`);
      checked += 1;
    });
  });
  assert.ok(checked >= 30, 'route coverage unexpectedly missed configured lanes');
}

function testFullEntityUpdateSmoke() {
  const engine = createEngine();
  engine.spawnCardUnits('player', RF.CARDS.rifle_squad, 0, 360, { y: 205 });
  engine.spawnCardUnits('player', RF.CARDS.shield_squad, 0, 330, { y: 205 });
  engine.spawnCardUnits('enemy', RF.CARDS.shadow_hounds, 0, 900, { y: 205 });
  for (let tick = 0; tick < 600; tick += 1) {
    engine.elapsed = tick / 60;
    engine.updateEntities(1 / 60);
  }
  assert.ok(engine.entities.every((entity) => Number.isFinite(entity.x) && Number.isFinite(entity.y)), 'entity update produced an invalid position');
}

const tests = [
  testRoundedObstacleCollision,
  testCrossLaneUsesOpenZone,
  testUnreachableTargetRecovery,
  testSpawnOverlapEscapesMapObstacle,
  testRetreatMovementDoesNotReuseAttackSlot,
  testEngagementRingsReduceOverlap,
  testEveryConfiguredRouteIsReachable,
  testFullEntityUpdateSmoke
];

tests.forEach((test) => test());
console.log(`pathfinding smoke: ${tests.length}/${tests.length} passed`);
