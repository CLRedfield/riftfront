(function () {
  'use strict';

  const RF = window.RF;
  if (!RF?.BattleEngine) return;

  const proto = RF.BattleEngine.prototype;
  const FIELD = { left: 80, right: 1200, top: 104, bottom: 616 };
  const SIDE_PLAYER = 'player';
  const SIDE_ENEMY = 'enemy';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(Number(a.x || 0) - Number(b.x || 0), Number(a.y || 0) - Number(b.y || 0));
  const randomBetween = (a, b) => a + Math.random() * (b - a);

  function allForts(engine) {
    return [engine.forts.playerCore, engine.forts.enemyCore, ...engine.forts.playerOutposts, ...engine.forts.enemyOutposts];
  }

  function getTargetById(engine, id) {
    if (!id) return null;
    return engine.entities.find((entity) => entity.id === id) || allForts(engine).find((fort) => fort.id === id) || null;
  }

  function defaultTargetMode(entity) {
    if (entity.targetMode) return entity.targetMode;
    if (entity.role === 'healer') return 'friendly';
    if (entity.flying || entity.projectile || entity.role === 'ranged' || entity.role === 'siege' || entity.role === 'boss') return 'all';
    return 'ground';
  }

  function targetClass(target) {
    if (!target) return 'none';
    if (target.kind || target.isBuilding) return 'building';
    if (target.flying) return 'air';
    return 'ground';
  }

  function targetAllowed(entity, target, engine = null) {
    if (!target || target.alive === false || target.side === entity.side) return false;
    if (target.stealthUntil && engine && target.stealthUntil > engine.elapsed) {
      const distance = dist(entity, target);
      const reveal = Math.max(72, Number(entity.range || 25) + 34);
      if (distance > reveal) return false;
    }
    const mode = defaultTargetMode(entity);
    const cls = targetClass(target);
    const canAir = Boolean(entity.canTargetAir || entity.flying || entity.projectile || entity.role === 'ranged' || entity.role === 'siege' || entity.role === 'boss');
    if (mode === 'buildings') return cls === 'building';
    if (mode === 'ground') return cls === 'ground' || cls === 'building';
    if (mode === 'air') return cls === 'air';
    if (mode === 'troops') return cls === 'ground' || (cls === 'air' && canAir);
    if (cls === 'air' && !canAir) return false;
    return cls === 'ground' || cls === 'air' || cls === 'building';
  }

  function targetScore(entity, target, distance) {
    const direction = entity.side === SIDE_PLAYER ? 1 : -1;
    let score = distance;
    const cls = targetClass(target);
    const sameLane = Number.isInteger(target.lane) && target.lane === entity.lane;
    const forward = ((Number(target.x || 0) - entity.x) * direction) >= -6;
    if (sameLane) score -= 28;
    if (forward) score -= 12;
    if (cls === 'building' && defaultTargetMode(entity) !== 'buildings') score += 20;
    if (target.tauntRadius && distance <= target.tauntRadius + entity.radius) score -= 1200;
    score -= Number(target.aggroPriority || 0) * (target.isBuilding || target.kind ? 1.0 : 0.55);
    if (entity.targetPriority === 'ranged' && (target.role === 'ranged' || target.role === 'siege' || target.role === 'healer')) score -= 52;
    if (entity.targetPriority === 'heavy' && target.heavy) score -= 52;
    if (entity.targetPriority === 'lowestHp') score += (target.hp / Math.max(1, target.maxHp)) * 70;
    if (entity.targetPriority === 'highestHp') score -= (target.hp / Math.max(1, target.maxHp)) * 55;
    if (target.isBoss) score -= 20;
    return score;
  }

  function applyFirstLockShield(engine, entity) {
    if (entity.receivedFirstLockShield || entity.side !== SIDE_PLAYER) return;
    const ratio = Number(entity.firstLockShield || engine.mods.firstLockShield || 0);
    if (ratio <= 0) return;
    entity.receivedFirstLockShield = true;
    entity.shield = Math.min((entity.shield || 0) + entity.maxHp * ratio, entity.maxHp * 0.55);
    engine.createBurst(entity.x, entity.y, '#65f6e5', 8);
  }

  const oldSpawnUnits = proto.spawnCardUnits;
  proto.spawnCardUnits = function spawnCardUnitsV140(side, card, lane, x, options = {}) {
    const before = this.entities.length;
    oldSpawnUnits.call(this, side, card, lane, x, options);
    const stats = card.unit || {};
    const sightMul = side === SIDE_PLAYER ? 1 + Number(this.mods.sightRangeMul || 0) : 1;
    const leashMul = side === SIDE_PLAYER ? 1 + Number(this.mods.leashRangeMul || 0) : 1;
    const massMul = side === SIDE_PLAYER ? 1 + Number(this.mods.massMul || 0) : 1;
    this.entities.slice(before).forEach((entity) => {
      const defaultSight = entity.role === 'siege' ? 390 : entity.role === 'ranged' || entity.role === 'healer' ? 285 : entity.flying ? 305 : 235;
      entity.targetMode = stats.targetMode || defaultTargetMode(entity);
      entity.targetPriority = stats.targetPriority || 'nearest';
      entity.sightRange = Number(stats.sightRange || defaultSight) * sightMul;
      entity.leashRange = Number(stats.leashRange || Math.max(entity.sightRange * 1.55, entity.range + 210)) * leashMul;
      entity.pursuitRange = Math.max(entity.pursuitRange || 0, entity.leashRange);
      entity.mass = Number(stats.mass || (entity.heavy ? 3.0 : Math.max(0.55, entity.radius / 14))) * massMul;
      entity.pullResist = clamp(Number(stats.pullResist || 0) + (side === SIDE_PLAYER ? Number(this.mods.pullResist || 0) : 0), 0, 0.8);
      entity.tauntRadius = Number(stats.tauntRadius || 0);
      entity.pullStrength = Number(stats.pullStrength || 0);
      entity.slowOnHit = Number(stats.slowOnHit || 0);
      entity.slowDuration = Number(stats.slowDuration || 0);
      entity.spawnOnDeathCard = stats.spawnOnDeathCard || null;
      entity.canTargetAir = Boolean(stats.canTargetAir || entity.flying || entity.projectile);
      entity.phaseMovement = Boolean(stats.phaseMovement);
      entity.backlineHunter = Boolean(stats.backlineHunter);
      entity.stealthUntil = stats.stealthDuration ? this.elapsed + Number(stats.stealthDuration) : 0;
      entity.firstAggroHaste = Number(stats.firstAggroHaste || (side === SIDE_PLAYER ? this.mods.firstAggroHaste || 0 : 0));
      entity.firstAggroHasteUsed = false;
      entity.markedUntil = 0;
      entity.markDamageTaken = 0;
      entity.firstLockShield = side === SIDE_PLAYER ? Number(this.mods.firstLockShield || 0) : 0;
      entity.buildingTargetDamageBonus = entity.targetMode === 'buildings' && side === SIDE_PLAYER ? Number(this.mods.buildingTargetDmg || 0) : 0;
      entity.lockedTargetId = null;
      entity.lockedAt = 0;
      entity.navPath = null;
      entity.navPathIndex = 0;
      entity.nextRepathAt = 0;
      entity.lastNavGoal = null;
      entity.navFailCount = 0;
      entity.navStuckCount = 0;
      entity.navProgressAnchor = { x: entity.x, y: entity.y, at: this.elapsed };
      entity.unreachableTargets = {};
      entity.navSlotTargetId = null;
      entity.navSlotAngle = null;
      entity.navSlotOrdinal = null;
      const rank = Number(this.mods.cardUpgrades?.[card.id] || 0);
      if (rank > 0) {
        const mul = 1 + 0.16 * rank;
        entity.maxHp *= mul; entity.hp *= mul; entity.damage *= mul; entity.heal *= mul; entity.shield *= mul;
        entity.speed *= 1 + 0.04 * rank;
        entity.cooldown *= Math.max(0.78, 1 - 0.055 * rank);
      }
    });
  };

  const oldSpawnBuilding = proto.spawnCardBuilding;
  proto.spawnCardBuilding = function spawnCardBuildingV140(side, card, lane, x, options = {}) {
    const before = this.entities.length;
    oldSpawnBuilding.call(this, side, card, lane, x, options);
    const stats = card.building || {};
    this.entities.slice(before).forEach((entity) => {
      entity.targetMode = stats.targetMode || 'all';
      entity.targetPriority = stats.targetPriority || 'nearest';
      entity.canTargetAir = Boolean(stats.canTargetAir || entity.projectile);
      entity.aggroPriority = Number(stats.aggroPriority || 0) * (side === SIDE_PLAYER ? 1 + Number(this.mods.buildingAggroMul || 0) : 1);
      entity.sightRange = Number(stats.sightRange || Math.max(180, entity.range + 42));
      entity.leashRange = Number(stats.leashRange || entity.sightRange + 90);
      entity.mass = Number(stats.mass || 8);
      entity.tauntRadius = Number(stats.tauntRadius || 0);
      entity.pullStrength = Number(stats.pullStrength || 0);
      entity.pullResist = 0.8;
      entity.lockedTargetId = null;
      entity.firstLockShield = 0;
      const rank = Number(this.mods.cardUpgrades?.[card.id] || 0);
      if (rank > 0) {
        const mul = 1 + 0.18 * rank;
        entity.maxHp *= mul; entity.hp *= mul; entity.damage *= 1 + 0.15 * rank; entity.shield *= mul;
        entity.cooldown *= Math.max(0.78, 1 - 0.05 * rank);
      }
    });
  };

  function targetTemporarilyUnreachable(engine, entity, target) {
    if (!target?.id || !entity.unreachableTargets) return false;
    const until = Number(entity.unreachableTargets[target.id] || 0);
    if (until <= engine.elapsed) {
      if (until) delete entity.unreachableTargets[target.id];
      return false;
    }
    return true;
  }

  function canAdoptTargetLane(engine, entity, target, lane) {
    if (!Number.isInteger(lane) || lane === entity.lane) return true;
    const left = Number(engine.map.deploy?.player?.maxX || 470);
    const right = Number(engine.map.deploy?.enemy?.minX || 810);
    if (entity.x <= left + 16 || entity.x >= right - 16) return true;
    const width = Number(engine.routes[entity.lane]?.width || 108);
    return engine.distanceToRoute(entity.lane, target.x, target.y, left - 24, right + 24) <= width * 0.58;
  }

  proto.findCombatTarget = function findCombatTargetV140(entity) {
    const mode = defaultTargetMode(entity);
    const sight = Number(entity.sightRange || (entity.isBuilding ? entity.range + 42 : Math.max(235, entity.range + 135)));
    const leash = Number(entity.leashRange || sight * 1.55);
    const locked = getTargetById(this, entity.lockedTargetId);
    if (locked && targetAllowed(entity, locked, this) && !targetTemporarilyUnreachable(this, entity, locked)) {
      const d = dist(entity, locked);
      if (d <= leash + Number(locked.radius || 0)) return locked;
    }
    entity.lockedTargetId = null;

    const candidates = [];
    this.entities.forEach((other) => {
      if (!targetAllowed(entity, other, this)) return;
      if (targetTemporarilyUnreachable(this, entity, other)) return;
      const d = dist(entity, other);
      if (d > sight + Number(other.radius || 0)) return;
      candidates.push({ target: other, distance: d, score: targetScore(entity, other, d) });
    });

    const enemyForts = entity.side === SIDE_PLAYER
      ? [this.forts.enemyCore, ...this.forts.enemyOutposts]
      : [this.forts.playerCore, ...this.forts.playerOutposts];
    enemyForts.filter((fort) => fort.alive && targetAllowed(entity, fort, this)).forEach((fort) => {
      if (targetTemporarilyUnreachable(this, entity, fort)) return;
      const d = dist(entity, fort);
      if (d <= sight + fort.radius) candidates.push({ target: fort, distance: d, score: targetScore(entity, fort, d) + (mode === 'buildings' ? -12 : 24) });
    });

    if (candidates.length) {
      candidates.sort((a, b) => a.score - b.score);
      const target = candidates[0].target;
      entity.lockedTargetId = target.id;
      entity.lockedAt = this.elapsed;
      if (Number.isInteger(target.lane) && target.lane !== entity.lane && canAdoptTargetLane(this, entity, target, target.lane)) {
        entity.lane = target.lane;
        entity.waypointIndex = this.initialWaypointIndex(entity.lane, entity.x, entity.side);
        entity.navPath = null;
      } else if ((target.kind || target.isBuilding) && this.routeCount) {
        const lane = this.nearestRoute(target.x, target.y);
        if (lane !== entity.lane && canAdoptTargetLane(this, entity, target, lane)) {
          entity.lane = lane;
          entity.waypointIndex = this.initialWaypointIndex(lane, entity.x, entity.side);
          entity.navPath = null;
        }
      }
      applyFirstLockShield(this, entity);
      if (!entity.firstAggroHasteUsed && Number(entity.firstAggroHaste || 0) > 0) {
        entity.firstAggroHasteUsed = true;
        entity.rallyUntil = Math.max(Number(entity.rallyUntil || 0), this.elapsed + Number(entity.firstAggroHaste));
        this.createBurst(entity.x, entity.y, '#c68aff', 7);
      }
      return target;
    }

    if (mode === 'air') return null;
    const forts = entity.side === SIDE_PLAYER ? this.forts.enemyOutposts : this.forts.playerOutposts;
    const core = entity.side === SIDE_PLAYER ? this.forts.enemyCore : this.forts.playerCore;
    const routeChoices = [];
    forts.forEach((fort, lane) => {
      if (!fort.alive || !targetAllowed(entity, fort, this)) return;
      const point = this.routePointAtX(lane, clamp(entity.x, 250, 1030));
      const cost = Math.hypot(point.x - entity.x, point.y - entity.y) + Math.abs(fort.x - entity.x) + Math.abs(fort.y - point.y) * 0.22;
      routeChoices.push({ target: fort, lane, cost });
    });
    if (core.alive && targetAllowed(entity, core, this)) {
      for (let lane = 0; lane < this.routeCount; lane += 1) {
        const point = this.routePointAtX(lane, clamp(entity.x, 250, 1030));
        const cost = Math.hypot(point.x - entity.x, point.y - entity.y) + Math.abs(core.x - entity.x) + 36;
        routeChoices.push({ target: core, lane, cost });
      }
    }
    routeChoices.sort((a, b) => a.cost - b.cost);
    const best = routeChoices[0];
    if (best) {
      if (entity.lane !== best.lane) {
        entity.lane = best.lane;
        entity.waypointIndex = this.initialWaypointIndex(best.lane, entity.x, entity.side);
        entity.navPath = null;
      }
      return best.target;
    }
    return null;
  };

  const NAV_CELL = 32;
  const NAV_CLEARANCE = 0.82;
  const SPATIAL_CELL = 72;

  function stableHash(value) {
    const text = String(value || 'unit');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function navigationRadius(entity, scale = 1) {
    return Math.max(4, Number(entity.radius || 12) * NAV_CLEARANCE * scale);
  }

  function routePenalty(engine, entity, x, y) {
    if (!engine.routeCount || !Number.isInteger(entity.lane)) return 0;
    const left = Number(engine.map.deploy?.player?.maxX || 470);
    const right = Number(engine.map.deploy?.enemy?.minX || 810);
    if (x <= left - 20 || x >= right + 20) return 0;
    const lane = clamp(entity.lane, 0, engine.routeCount - 1);
    const width = Number(engine.routes[lane]?.width || 108);
    const distance = engine.distanceToRoute(lane, x, y, left - 30, right + 30);
    const freeDistance = width * 0.46;
    if (distance <= freeDistance) return 0;
    return Math.min(7, (distance - freeDistance) / Math.max(18, width * 0.24));
  }

  function buildSpatialIndex(engine) {
    const buckets = new Map();
    const engagementGroups = new Map();
    engine.entities.forEach((other) => {
      if (!other.alive || other.isBuilding) return;
      const gx = Math.floor(other.x / SPATIAL_CELL);
      const gy = Math.floor(other.y / SPATIAL_CELL);
      const key = `${gx}:${gy}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(other);
      if (other.lockedTargetId) {
        if (!engagementGroups.has(other.lockedTargetId)) engagementGroups.set(other.lockedTargetId, []);
        engagementGroups.get(other.lockedTargetId).push(other);
      } else {
        other.navEngagementIndex = null;
        other.navEngagementCount = 0;
      }
    });
    engagementGroups.forEach((group) => {
      group.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      group.forEach((other, index) => {
        other.navEngagementIndex = index;
        other.navEngagementCount = group.length;
      });
    });
    engine.navSpatialIndex = buckets;
    engine.navBlockers = [
      ...engine.entities.filter((other) => other.alive && other.isBuilding),
      ...allForts(engine).filter((fort) => fort.alive)
    ];
  }

  function nearbyMovers(engine, entity, range) {
    if (!engine.navSpatialIndex) return engine.entities;
    const minX = Math.floor((entity.x - range) / SPATIAL_CELL);
    const maxX = Math.floor((entity.x + range) / SPATIAL_CELL);
    const minY = Math.floor((entity.y - range) / SPATIAL_CELL);
    const maxY = Math.floor((entity.y + range) / SPATIAL_CELL);
    const nearby = [];
    for (let gx = minX; gx <= maxX; gx += 1) {
      for (let gy = minY; gy <= maxY; gy += 1) {
        const bucket = engine.navSpatialIndex.get(`${gx}:${gy}`);
        if (bucket) nearby.push(...bucket);
      }
    }
    return nearby;
  }

  function makeNavQuery(engine, entity, targetId, defaultRadius = navigationRadius(entity)) {
    const blockers = (engine.navBlockers || [
      ...engine.entities.filter((other) => other.alive && other.isBuilding && other.id !== entity.id),
      ...allForts(engine).filter((fort) => fort.alive)
    ]).filter((blocker) => blocker.id !== entity.id);
    const startsInsideMapBlocker = !entity.flying && engine.isPointBlocked(entity.x, entity.y, defaultRadius);
    let mapEscapePoint = null;
    if (startsInsideMapBlocker) {
      const ringStep = Math.max(14, defaultRadius * 0.9);
      for (let ring = 1; ring <= 12 && !mapEscapePoint; ring += 1) {
        const distance = ring * ringStep;
        for (let sample = 0; sample < 24; sample += 1) {
          const angle = sample / 24 * Math.PI * 2;
          const x = entity.x + Math.cos(angle) * distance;
          const y = entity.y + Math.sin(angle) * distance;
          if (!engine.isPointBlocked(x, y, defaultRadius)) {
            mapEscapePoint = { x, y };
            break;
          }
        }
      }
    }

    const blocked = (x, y, radius = defaultRadius) => {
      if (entity.phaseMovement || entity.flying) return false;
      if (engine.isPointBlocked(x, y, radius)) {
        if (!startsInsideMapBlocker || !mapEscapePoint) return true;
        const currentEscapeDistance = Math.hypot(entity.x - mapEscapePoint.x, entity.y - mapEscapePoint.y);
        const nextEscapeDistance = Math.hypot(x - mapEscapePoint.x, y - mapEscapePoint.y);
        if (nextEscapeDistance >= currentEscapeDistance - 0.05) return true;
      }

      for (const blocker of blockers) {
        const blockerRadius = Number(blocker.radius || 0);
        const nextDistance = Math.hypot(x - blocker.x, y - blocker.y);
        const limit = radius + blockerRadius + 2;
        if (nextDistance >= limit) continue;
        const currentDistance = Math.hypot(entity.x - blocker.x, entity.y - blocker.y);
        if (!(currentDistance < limit && nextDistance > currentDistance + 0.05)) return true;
      }
      return false;
    };

    const lineBlocked = (x1, y1, x2, y2, radius = defaultRadius, respectRoute = false) => {
      const distance = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.ceil(distance / 18));
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        if (blocked(px, py, radius)) return true;
        if (respectRoute && routePenalty(engine, entity, px, py) > 1.25) return true;
      }
      return false;
    };

    return { blocked, lineBlocked, defaultRadius };
  }

  function dynamicBlocked(engine, entity, x, y, radius, targetId) {
    return makeNavQuery(engine, entity, targetId, radius).blocked(x, y, radius);
  }

  class MinHeap {
    constructor() { this.a = []; }
    push(node) {
      const a = this.a; a.push(node); let i = a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= node.f) break; a[i] = a[p]; i = p; }
      a[i] = node;
    }
    pop() {
      const a = this.a; if (!a.length) return null; const root = a[0]; const last = a.pop();
      if (a.length) {
        let i = 0;
        while (true) {
          let l = i * 2 + 1, r = l + 1, c = i;
          if (l < a.length && a[l].f < (c === i ? last.f : a[c].f)) c = l;
          if (r < a.length && a[r].f < (c === i ? last.f : a[c].f)) c = r;
          if (c === i) break;
          a[i] = a[c]; i = c;
        }
        a[i] = last;
      }
      return root;
    }
    get length() { return this.a.length; }
  }

  function navigationGoals(engine, entity, goalX, goalY, targetId, query) {
    const target = getTargetById(engine, targetId);
    if (!target) {
      entity.navSlotTargetId = null;
      entity.navSlotAngle = null;
      entity.navSlotOrdinal = null;
      return [{ x: goalX, y: goalY, preference: 0 }];
    }

    const maxRange = Math.max(8, Number(entity.range || 25) + Number(target.radius || 12));
    const minRange = Math.max(0, Number(entity.minRange || 0));
    const ranged = minRange > 0 || Number(entity.range || 0) >= 70 || entity.role === 'ranged' || entity.role === 'siege' || entity.role === 'healer';
    const baseDistance = ranged
      ? clamp(maxRange - 10, minRange + 12, Math.max(minRange + 12, maxRange - 3))
      : Math.max(Number(target.radius || 12) + navigationRadius(entity) + 2, maxRange - 4);

    const spacing = Math.max(12, Number(entity.radius || 12) * 2 + 5);
    const capacity = Math.max(6, Math.floor(Math.PI * 2 * baseDistance / spacing));
    const engagementIndex = Math.max(0, Number.isInteger(entity.navEngagementIndex) ? entity.navEngagementIndex : stableHash(`${entity.id}:${target.id}`) % capacity);
    const ring = Math.floor(engagementIndex / capacity);
    const slot = engagementIndex % capacity;
    const step = Math.PI * 2 / capacity;
    const slotStep = slot === 0 ? 0 : Math.ceil(slot / 2) * step * (slot % 2 ? 1 : -1);
    const desiredDistance = baseDistance + ring * spacing * 0.92;

    if (entity.navSlotTargetId !== target.id || entity.navSlotOrdinal !== engagementIndex || !Number.isFinite(entity.navSlotAngle)) {
      const approach = entity.side === SIDE_PLAYER ? Math.PI : 0;
      entity.navSlotTargetId = target.id;
      entity.navSlotOrdinal = engagementIndex;
      entity.navSlotAngle = approach + slotStep;
    }

    const offsets = [0, 0.34, -0.34, 0.68, -0.68, 1.02, -1.02, 1.4, -1.4, Math.PI];
    const goals = [];
    offsets.forEach((offset, index) => {
      const angle = entity.navSlotAngle + offset;
      const x = clamp(target.x + Math.cos(angle) * desiredDistance, FIELD.left + query.defaultRadius + 2, FIELD.right - query.defaultRadius - 2);
      const y = clamp(target.y + Math.sin(angle) * desiredDistance, FIELD.top + query.defaultRadius + 2, FIELD.bottom - query.defaultRadius - 2);
      if (query.blocked(x, y)) return;
      if (ranged && query.lineBlocked(x, y, target.x, target.y, Math.min(5, query.defaultRadius * 0.4), false)) return;
      goals.push({ x, y, preference: index * 0.18 });
    });
    return goals.length ? goals : [{ x: goalX, y: goalY, preference: 3 }];
  }

  function smoothPath(entity, points, query) {
    if (points.length < 2) return points;
    const smoothed = [];
    let anchor = { x: entity.x, y: entity.y };
    let index = 0;
    while (index < points.length) {
      let selected = index;
      for (let candidate = points.length - 1; candidate >= index; candidate -= 1) {
        if (!query.lineBlocked(anchor.x, anchor.y, points[candidate].x, points[candidate].y, query.defaultRadius, true)) {
          selected = candidate;
          break;
        }
      }
      smoothed.push(points[selected]);
      anchor = points[selected];
      index = selected + 1;
    }
    return smoothed;
  }

  function navPath(engine, entity, goals, targetId, query) {
    const step = NAV_CELL;
    const cols = Math.floor((FIELD.right - FIELD.left) / step) + 1;
    const rows = Math.floor((FIELD.bottom - FIELD.top) / step) + 1;
    const toGrid = (x, y) => ({
      gx: clamp(Math.round((x - FIELD.left) / step), 0, cols - 1),
      gy: clamp(Math.round((y - FIELD.top) / step), 0, rows - 1)
    });
    const toWorld = (gx, gy) => ({ x: FIELD.left + gx * step, y: FIELD.top + gy * step });
    const start = toGrid(entity.x, entity.y);
    const key = (gx, gy) => gy * cols + gx;
    const startKey = key(start.gx, start.gy);
    const gridGoals = new Map();
    const heuristicGoals = goals.map((goal) => ({ ...toGrid(goal.x, goal.y), preference: Number(goal.preference || 0) }));
    goals.forEach((goal) => {
      const center = toGrid(goal.x, goal.y);
      for (let ring = 0; ring <= 2; ring += 1) {
        for (let ox = -ring; ox <= ring; ox += 1) {
          for (let oy = -ring; oy <= ring; oy += 1) {
            if (ring > 0 && Math.max(Math.abs(ox), Math.abs(oy)) !== ring) continue;
            const gx = center.gx + ox;
            const gy = center.gy + oy;
            if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) continue;
            const world = toWorld(gx, gy);
            if (Math.hypot(world.x - goal.x, world.y - goal.y) > step * 1.05) continue;
            if (key(gx, gy) !== startKey && query.blocked(world.x, world.y)) continue;
            const score = Number(goal.preference || 0) + Math.hypot(world.x - goal.x, world.y - goal.y) / step;
            const existing = gridGoals.get(key(gx, gy));
            if (!existing || score < existing.score) gridGoals.set(key(gx, gy), { ...goal, gx, gy, score });
          }
        }
      }
    });

    const heuristic = (gx, gy) => {
      let best = Infinity;
      heuristicGoals.forEach((goal) => {
        best = Math.min(best, Math.hypot(gx - goal.gx, gy - goal.gy) + Number(goal.preference || 0));
      });
      return best;
    };

    if (!heuristicGoals.length) return { points: [], reached: false, remainingDistance: Infinity, expanded: 0 };
    const heap = new MinHeap();
    const gScore = new Map([[startKey, 0]]);
    const came = new Map();
    const closed = new Set();
    heap.push({ gx: start.gx, gy: start.gy, g: 0, f: heuristic(start.gx, start.gy), k: startKey });
    const directions = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
    let found = null;
    let best = { gx: start.gx, gy: start.gy, k: startKey, h: heuristic(start.gx, start.gy) };
    let expanded = 0;
    while (heap.length && expanded < 1400) {
      const cur = heap.pop();
      if (cur.g !== gScore.get(cur.k) || closed.has(cur.k)) continue;
      closed.add(cur.k);
      expanded += 1;
      const h = heuristic(cur.gx, cur.gy);
      if (h < best.h) best = { ...cur, h };
      if (gridGoals.has(cur.k)) { found = cur; break; }
      for (const [dx,dy,cost] of directions) {
        const gx = cur.gx + dx, gy = cur.gy + dy;
        if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) continue;
        const world = toWorld(gx, gy);
        if (query.blocked(world.x, world.y)) continue;
        if (dx && dy) {
          const w1 = toWorld(cur.gx + dx, cur.gy), w2 = toWorld(cur.gx, cur.gy + dy);
          if (query.blocked(w1.x, w1.y, query.defaultRadius * 0.88) || query.blocked(w2.x, w2.y, query.defaultRadius * 0.88)) continue;
        }
        const nk = key(gx, gy);
        if (closed.has(nk)) continue;
        const ng = cur.g + cost + routePenalty(engine, entity, world.x, world.y) * 0.72;
        if (ng >= (gScore.get(nk) ?? Infinity)) continue;
        gScore.set(nk, ng);
        came.set(nk, cur.k);
        heap.push({ gx, gy, g: ng, k: nk, f: ng + heuristic(gx, gy) });
      }
    }
    const endpointNode = found || best;
    if (!endpointNode || endpointNode.k === startKey) return { points: [], reached: false, remainingDistance: best.h * step, expanded };
    const path = [];
    let currentKey = endpointNode.k;
    let safety = 0;
    while (currentKey !== startKey && safety < 1000) {
      const gy = Math.floor(currentKey / cols), gx = currentKey - gy * cols;
      path.push(toWorld(gx, gy));
      currentKey = came.get(currentKey);
      if (currentKey == null) break;
      safety += 1;
    }
    path.reverse();
    if (found) {
      const exactGoal = gridGoals.get(found.k);
      const last = path[path.length - 1] || { x: entity.x, y: entity.y };
      if (!query.lineBlocked(last.x, last.y, exactGoal.x, exactGoal.y, query.defaultRadius, true)) path.push({ x: exactGoal.x, y: exactGoal.y });
    }
    return { points: smoothPath(entity, path, query), reached: Boolean(found), remainingDistance: found ? 0 : best.h * step, expanded };
  }

  function directStep(engine, entity, targetX, targetY, dt, speedMul, targetId, query = null) {
    const dx = targetX - entity.x, dy = targetY - entity.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.5) return false;
    let vx = dx / distance, vy = dy / distance;
    let separationX = 0, separationY = 0;
    const myMass = Math.max(0.2, Number(entity.mass || 1));
    const neighbors = nearbyMovers(engine, entity, Math.max(84, entity.radius * 4));
    neighbors.forEach((other) => {
      if (!other.alive || other.id === entity.id || other.isBuilding || Boolean(other.flying) !== Boolean(entity.flying)) return;
      const ox = entity.x - other.x, oy = entity.y - other.y;
      const d = Math.hypot(ox, oy);
      const desired = entity.radius + other.radius + (other.side === entity.side ? 5 : 2);
      if (d > desired * 1.65) return;
      const otherMass = Math.max(0.2, Number(other.mass || 1));
      const pressure = (desired * 1.65 - d) / (desired * 1.65);
      const weight = other.side === entity.side ? clamp(otherMass / myMass, 0.35, 2.2) : 1.35;
      const angle = d > 0.01 ? Math.atan2(oy, ox) : (stableHash(`${entity.id}:${other.id}`) % 628) / 100;
      separationX += Math.cos(angle) * pressure * weight;
      separationY += Math.sin(angle) * pressure * weight;
    });
    vx += separationX * 0.92; vy += separationY * 0.92;
    const len = Math.hypot(vx, vy) || 1; vx /= len; vy /= len;
    const step = Math.min(distance, Math.max(0, Number(entity.speed || 0) * speedMul * dt));
    const base = Math.atan2(vy, vx);
    const avoidSign = Number(entity.navAvoidSign || (stableHash(entity.id) % 2 ? 1 : -1));
    entity.navAvoidSign = avoidSign;
    const offsets = [0,0.28*avoidSign,-0.28*avoidSign,0.56*avoidSign,-0.56*avoidSign,0.92*avoidSign,-0.92*avoidSign,1.3*avoidSign,-1.3*avoidSign];
    let best = null;
    for (const offset of offsets) {
      const angle = base + offset;
      const nx = clamp(entity.x + Math.cos(angle) * step, FIELD.left + entity.radius + 2, FIELD.right - entity.radius - 2);
      const ny = clamp(entity.y + Math.sin(angle) * step, FIELD.top + entity.radius + 2, FIELD.bottom - entity.radius - 2);
      if (!entity.flying && (query || makeNavQuery(engine, entity, targetId)).blocked(nx, ny)) continue;
      let crowdPenalty = 0;
      neighbors.forEach((other) => {
        if (!other.alive || other.id === entity.id || other.isBuilding || Boolean(other.flying) !== Boolean(entity.flying)) return;
        const nextDistance = Math.hypot(nx - other.x, ny - other.y);
        const softLimit = (entity.radius + other.radius) * (other.side === entity.side ? 0.9 : 0.78);
        if (nextDistance < softLimit) crowdPenalty += (softLimit - nextDistance) * (other.side === entity.side ? 1.7 : 1.15);
      });
      const score = Math.hypot(targetX - nx, targetY - ny) + Math.abs(offset) * 3.2 + crowdPenalty;
      if (!best || score < best.score) best = { x:nx,y:ny,angle,score };
    }
    if (!best) return false;
    entity.x = best.x; entity.y = best.y; entity.facing = best.angle; entity.moving = true;
    entity.walkPhase = Number(entity.walkPhase || 0) + dt * (4 + entity.speed * 0.06);
    return true;
  }

  function markTargetUnreachable(engine, entity, targetId) {
    if (!targetId) return;
    if (!entity.unreachableTargets) entity.unreachableTargets = {};
    entity.unreachableTargets[targetId] = engine.elapsed + 1.6;
    if (entity.lockedTargetId === targetId) entity.lockedTargetId = null;
    entity.navSlotTargetId = null;
    entity.navSlotAngle = null;
    entity.navSlotOrdinal = null;
    entity.navPath = null;
    entity.navPathIndex = 0;
    entity.navFailCount = 0;
  }

  function updateNavigationProgress(engine, entity, targetId) {
    const anchor = entity.navProgressAnchor;
    if (!anchor) {
      entity.navProgressAnchor = { x: entity.x, y: entity.y, at: engine.elapsed };
      return;
    }
    if (Math.hypot(entity.x - anchor.x, entity.y - anchor.y) >= 8) {
      entity.navProgressAnchor = { x: entity.x, y: entity.y, at: engine.elapsed };
      entity.navStuckCount = 0;
      return;
    }
    if (engine.elapsed - anchor.at < 0.72) return;
    entity.navProgressAnchor = { x: entity.x, y: entity.y, at: engine.elapsed };
    entity.navStuckCount = Number(entity.navStuckCount || 0) + 1;
    entity.nextRepathAt = 0;
    entity.navAvoidSign = -Number(entity.navAvoidSign || 1);
    if (targetId && entity.navLastPlanReached === false && entity.navStuckCount >= 2) markTargetUnreachable(engine, entity, targetId);
  }

  proto.moveEntityToward = function moveEntityTowardV140(entity, targetX, targetY, dt, speedMul) {
    const lockedTarget = getTargetById(this, entity.lockedTargetId);
    const movingToLockedTarget = lockedTarget && Math.hypot(targetX - lockedTarget.x, targetY - lockedTarget.y) <= 4;
    const targetId = entity.navMoveTargetId || (movingToLockedTarget ? entity.lockedTargetId : null);
    const query = makeNavQuery(this, entity, targetId);
    const goals = navigationGoals(this, entity, targetX, targetY, targetId, query);
    const primaryGoal = goals[0] || { x: targetX, y: targetY };
    if (entity.flying) {
      directStep(this, entity, primaryGoal.x, primaryGoal.y, dt, speedMul, targetId, query);
      updateNavigationProgress(this, entity, targetId);
      return;
    }
    const directBlocked = entity.phaseMovement ? false : query.lineBlocked(entity.x, entity.y, primaryGoal.x, primaryGoal.y, query.defaultRadius, true);
    const goalMoved = !entity.lastNavGoal || Math.hypot(entity.lastNavGoal.x - primaryGoal.x, entity.lastNavGoal.y - primaryGoal.y) > 34 || entity.lastNavGoal.targetId !== targetId;
    if (!directBlocked) {
      entity.navPath = null; entity.navPathIndex = 0; entity.navLastPlanReached = true; entity.navFailCount = 0;
      entity.lastNavGoal = { x:primaryGoal.x,y:primaryGoal.y,targetId };
      directStep(this, entity, primaryGoal.x, primaryGoal.y, dt, speedMul, targetId, query);
      updateNavigationProgress(this, entity, targetId);
      return;
    }
    if (!entity.navPath || goalMoved || this.elapsed >= Number(entity.nextRepathAt || 0)) {
      if (goalMoved) entity.navBestRemaining = Infinity;
      const result = navPath(this, entity, goals, targetId, query);
      entity.navPath = result.points;
      entity.navPathIndex = 0;
      entity.navLastPlanReached = result.reached;
      entity.nextRepathAt = this.elapsed + (result.reached ? 0.78 + Math.random() * 0.28 : 0.34 + Math.random() * 0.16);
      entity.lastNavGoal = { x:primaryGoal.x,y:primaryGoal.y,targetId };
      if (result.reached) {
        entity.navFailCount = 0;
        entity.navBestRemaining = 0;
      } else {
        const improved = result.remainingDistance + 14 < Number(entity.navBestRemaining ?? Infinity);
        entity.navFailCount = improved ? 0 : Number(entity.navFailCount || 0) + 1;
        entity.navBestRemaining = Math.min(Number(entity.navBestRemaining ?? Infinity), result.remainingDistance);
        if ((!result.points.length && entity.navFailCount >= 2) || entity.navFailCount >= 3) {
          markTargetUnreachable(this, entity, targetId);
          return;
        }
      }
    }
    const path = entity.navPath || [];
    const arrival = Math.min(24, Math.max(12, entity.radius * 0.72 + 7));
    while (entity.navPathIndex < path.length - 1 && Math.hypot(path[entity.navPathIndex].x - entity.x, path[entity.navPathIndex].y - entity.y) < arrival) entity.navPathIndex += 1;
    const waypoint = path[entity.navPathIndex];
    if (waypoint) directStep(this, entity, waypoint.x, waypoint.y, dt, speedMul, targetId, query);
    updateNavigationProgress(this, entity, targetId);
  };

  proto.updateEntities = function updateEntitiesV140(dt) {
    buildSpatialIndex(this);
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
        this.killEntity(entity, null, { expired: true }); return;
      }
      if (entity.spawnCard && entity.spawnEvery && this.elapsed >= (entity.nextSpawnAt || 0)) {
        entity.nextSpawnAt = this.elapsed + entity.spawnEvery;
        const spawnX = entity.x + (entity.side === SIDE_PLAYER ? 30 : -30);
        this.playCardEffect(entity.side, entity.spawnCard, entity.lane, spawnX, { source:'spawner', y:entity.y + randomBetween(-26,26) });
      }
      if (this.mods.passiveHeal && entity.side === SIDE_PLAYER) this.healTarget(entity, entity.maxHp * Number(this.mods.passiveHeal) * dt, false);
      if (entity.poisonUntil > this.elapsed) this.applyDamage(entity, Number(entity.poisonDps || 0) * dt, null, { silent:true, ignoreShield:false });
      const hazardMod = this.getHazardModifier(entity, dt);
      if (!entity.alive || entity.freezeUntil > this.elapsed) return;
      const rallyActive = entity.rallyUntil > this.elapsed;
      const slowActive = entity.slowUntil > this.elapsed;
      const speedMul = (1 + Number(entity.moveSpeedBonus || 0) + (rallyActive ? 0.25 : 0)) * (1 - (slowActive ? 0.38 : 0)) * (1 - Number(entity.auraSlow || 0)) * hazardMod.speedMul;
      const attackSpeedMul = (1 + Number(entity.auraAttackBonus || 0)) * (rallyActive ? 1.25 : 1) * hazardMod.attackMul;
      entity.cooldownRemaining -= dt * Math.max(0.1, attackSpeedMul);

      if (entity.role === 'healer') {
        const target = this.findHealTarget(entity);
        if (target) {
          const distance = this.distanceToTarget(entity, target);
          if (entity.cooldownRemaining <= 0 && distance <= entity.range + target.radius && (entity.flying || !this.isLineBlocked(entity.x, entity.y, target.x, target.y, 4))) {
            this.healTarget(target, entity.heal, true, entity); entity.cooldownRemaining = entity.cooldown; entity.facing = Math.atan2(target.y - entity.y, target.x - entity.x);
          } else if (!entity.isBuilding) {
            entity.navMoveTargetId = target.id;
            this.moveEntityToward(entity, target.x, target.y, dt, speedMul);
            entity.navMoveTargetId = null;
          }
        } else if (!entity.isBuilding) this.advanceEntity(entity, dt, speedMul);
        return;
      }

      if (entity.isBuilding && !entity.damage) return;
      const target = this.findCombatTarget(entity);
      if (!target) { if (!entity.isBuilding) this.advanceEntity(entity, dt, speedMul); return; }
      const distance = this.distanceToTarget(entity, target);
      const maxRange = Number(entity.range || 25) + Number(target.radius || 12);
      const minRange = Number(entity.minRange || 0);
      const clearShot = entity.flying || !this.isLineBlocked(entity.x, entity.y, target.x, target.y, Math.min(7, entity.radius * 0.35));
      if (distance <= maxRange && distance >= minRange && clearShot) {
        if (entity.cooldownRemaining <= 0) { this.performAttack(entity, target); entity.cooldownRemaining = entity.cooldown; }
      } else if (!entity.isBuilding) {
        if (distance < minRange) {
          this.moveEntityToward(entity, entity.x - (target.x - entity.x), entity.y - (target.y - entity.y), dt, speedMul * 0.68);
        } else if (!target.kind && distance <= Number(entity.leashRange || entity.pursuitRange || 360)) {
          this.moveEntityToward(entity, target.x, target.y, dt, speedMul);
        } else {
          this.advanceEntity(entity, dt, speedMul);
        }
      }
    });
    this.entities = this.entities.filter((entity) => entity.alive || this.elapsed - Number(entity.diedAt || 0) < 0.5);
  };

  const oldPerformAttack = proto.performAttack;
  proto.performAttack = function performAttackV140(attacker, target) {
    const beforeAlive = target?.alive !== false;
    if (attacker.buildingTargetDamageBonus && (target?.kind || target?.isBuilding)) {
      const original = attacker.damage;
      attacker.damage *= 1 + attacker.buildingTargetDamageBonus;
      oldPerformAttack.call(this, attacker, target);
      attacker.damage = original;
    } else oldPerformAttack.call(this, attacker, target);
    if (!beforeAlive || !target || target.alive === false) return;
    if (attacker.slowOnHit) {
      target.slowUntil = Math.max(Number(target.slowUntil || 0), this.elapsed + Number(attacker.slowDuration || 3.5));
      target.auraSlow = Math.max(Number(target.auraSlow || 0), Number(attacker.slowOnHit || 0));
    }
    if (attacker.pullStrength && !target.kind && !target.isBuilding && !target.flying) {
      const resistance = clamp(Number(target.pullResist || 0) + (target.heavy ? 0.28 : 0), 0, 0.82);
      const amount = Number(attacker.pullStrength) * (1 - resistance);
      const dx = attacker.x - target.x, dy = attacker.y - target.y, d = Math.hypot(dx,dy) || 1;
      const nx = clamp(target.x + dx / d * amount, FIELD.left + target.radius, FIELD.right - target.radius);
      const ny = clamp(target.y + dy / d * amount, FIELD.top + target.radius, FIELD.bottom - target.radius);
      if (!dynamicBlocked(this, target, nx, ny, target.radius * 0.7, attacker.id)) { target.x = nx; target.y = ny; target.navPath = null; }
      this.createBurst(target.x, target.y, '#68f7e3', 5);
    }
  };



  const oldEffectiveCost = proto.getEffectiveCost;
  proto.getEffectiveCost = function getEffectiveCostV140(handItem) {
    let cost = oldEffectiveCost.call(this, handItem);
    if (Number(this.mods.cardUpgrades?.[handItem.cardId] || 0) >= 2) cost -= 1;
    return Math.max(0, cost);
  };

  const oldApplyDamage = proto.applyDamage;
  proto.applyDamage = function applyDamageV140(target, amount, source, options = {}) {
    let adjusted = amount;
    if (target && target.markedUntil > this.elapsed) {
      adjusted *= 1 + Number(target.markDamageTaken || 0) + (source?.side === SIDE_PLAYER ? Number(this.mods.markDamageBonus || 0) : 0);
    }
    return oldApplyDamage.call(this, target, adjusted, source, options);
  };

  const oldKill = proto.killEntity;
  proto.killEntity = function killEntityV140(entity, source, options = {}) {
    const spawnCard = !options.expired ? entity.spawnOnDeathCard : null;
    const side = entity.side, lane = entity.lane, x = entity.x, y = entity.y;
    oldKill.call(this, entity, source, options);
    if (spawnCard && !options.noEcho) {
      this.schedule(0.08, () => {
        this.playCardEffect(side, spawnCard, lane, x + (side === SIDE_PLAYER ? 10 : -10), { source:'deathEcho', y });
      });
    }
  };

  const oldCastSpell = proto.castSpell;
  proto.castSpell = function castSpellV140(side, card, lane, x, y = null) {
    const spell = card.spell || {};
    const targetY = Number(y ?? this.routePointAtX(lane, x).y);
    if (spell.effect === 'undertowPull') {
      const enemySide = side === SIDE_PLAYER ? SIDE_ENEMY : SIDE_PLAYER;
      const radius = Number(spell.radius || 165);
      this.entities.filter((entity) => entity.alive && entity.side === enemySide && !entity.isBuilding && !entity.flying && Math.hypot(entity.x-x,entity.y-targetY) <= radius + entity.radius).forEach((entity) => {
        const d = Math.hypot(x-entity.x,targetY-entity.y) || 1;
        const pull = Number(spell.pull || 90) * (1 - clamp(Number(entity.pullResist || 0) + (entity.heavy ? 0.28 : 0),0,0.82));
        const nx = clamp(entity.x + (x-entity.x)/d*pull,FIELD.left+entity.radius,FIELD.right-entity.radius);
        const ny = clamp(entity.y + (targetY-entity.y)/d*pull,FIELD.top+entity.radius,FIELD.bottom-entity.radius);
        if (!dynamicBlocked(this,entity,nx,ny,entity.radius*0.7,null)) { entity.x=nx;entity.y=ny;entity.navPath=null; }
        entity.slowUntil = Math.max(entity.slowUntil,this.elapsed+Number(spell.slow||4));
      });
      this.createBurst(x,targetY,'#5cebd9',30); RF.audio.play('freeze'); return;
    }
    if (spell.effect === 'echoCall') {
      (spell.cards || []).forEach((cardId,index) => this.playCardEffect(side,cardId,lane,x+(side===SIDE_PLAYER?-index*22:index*22),{source:'echoCall',y:targetY+(index?24:-24)}));
      this.createBurst(x,targetY,'#72f8e6',26); return;
    }
    if (spell.effect === 'curseAnchor') {
      if (side === SIDE_PLAYER) this.energy = Math.max(0,this.energy-Number(spell.energyLoss||2)); else this.enemyEnergy=Math.max(0,this.enemyEnergy-Number(spell.energyLoss||2));
      this.entities.filter((entity)=>entity.alive&&entity.side===side&&!entity.isBuilding).forEach((entity)=>{entity.slowUntil=Math.max(entity.slowUntil,this.elapsed+Number(spell.slow||3.2));});
      this.createBurst(x,targetY,'#4ecfc2',22); this.emitEvent('warning',{title:'沉重锚印',text:'费用流失，己方行军短暂减速。',hazard:'undertow'}); return;
    }
    if (spell.effect === 'drownedCrown') {
      if (RF.CARDS.tide_anchor_shrine) this.playCardEffect(side,'tide_anchor_shrine',lane,x,{source:'treasure',y:targetY});
      const radius=Number(spell.radius||155), shield=Number(spell.shield||110);
      this.entities.filter((entity)=>entity.alive&&entity.side===side&&Math.hypot(entity.x-x,entity.y-targetY)<=radius+entity.radius).forEach((entity)=>{entity.shield=Math.min((entity.shield||0)+shield,entity.maxHp*0.6);});
      this.createBurst(x,targetY,'#ffe18c',34); return;
    }
    if (spell.effect === 'eclipseVeil') {
      const radius=Number(spell.radius||158), duration=Number(spell.duration||6.2);
      this.entities.filter((entity)=>entity.alive&&entity.side===side&&Math.hypot(entity.x-x,entity.y-targetY)<=radius+entity.radius).forEach((entity)=>{
        entity.stealthUntil=Math.max(Number(entity.stealthUntil||0),this.elapsed+duration);
        entity.rallyUntil=Math.max(Number(entity.rallyUntil||0),this.elapsed+duration);
        entity.lockedTargetId=null; entity.navPath=null;
      });
      this.entities.filter((entity)=>entity.alive&&entity.side!==side).forEach((enemy)=>{
        const locked=getTargetById(this,enemy.lockedTargetId); if(locked?.side===side&&locked.stealthUntil>this.elapsed) enemy.lockedTargetId=null;
      });
      this.createBurst(x,targetY,'#b56cff',28); return;
    }
    if (spell.effect === 'soulMark') {
      const radius=Number(spell.radius||142), duration=Number(spell.duration||8), enemySide=side===SIDE_PLAYER?SIDE_ENEMY:SIDE_PLAYER;
      this.entities.filter((entity)=>entity.alive&&entity.side===enemySide&&Math.hypot(entity.x-x,entity.y-targetY)<=radius+entity.radius).forEach((entity)=>{
        entity.markedUntil=Math.max(Number(entity.markedUntil||0),this.elapsed+duration); entity.markDamageTaken=Math.max(Number(entity.markDamageTaken||0),Number(spell.damageTaken||.25));
      });
      this.createBurst(x,targetY,'#d77cff',26); return;
    }
    if (spell.effect === 'blackSun') {
      const duration=Number(spell.duration||7.2), enemySide=side===SIDE_PLAYER?SIDE_ENEMY:SIDE_PLAYER;
      this.entities.filter((entity)=>entity.alive&&entity.side===side).forEach((entity)=>{entity.stealthUntil=Math.max(Number(entity.stealthUntil||0),this.elapsed+duration);entity.rallyUntil=Math.max(Number(entity.rallyUntil||0),this.elapsed+duration);entity.lockedTargetId=null;});
      this.entities.filter((entity)=>entity.alive&&entity.side===enemySide).forEach((entity)=>{entity.markedUntil=Math.max(Number(entity.markedUntil||0),this.elapsed+duration);entity.markDamageTaken=Math.max(Number(entity.markDamageTaken||0),.25);});
      this.createBurst(640,360,'#d98aff',52); return;
    }
    if (spell.effect === 'bridgeCompass') {
      if (side===SIDE_PLAYER) { for(let i=0;i<Number(spell.draw||2);i+=1) this.drawNextPlayerCard(); }
      this.entities.filter((entity)=>entity.alive&&entity.side===side&&!entity.isBuilding).forEach((entity)=>{entity.lockedTargetId=null;entity.navPath=null;entity.rallyUntil=Math.max(Number(entity.rallyUntil||0),this.elapsed+Number(spell.duration||5.6));});
      this.createBurst(x,targetY,'#8ceaff',30); return;
    }
    if (spell.effect === 'soulVault') {
      (spell.cards||[]).forEach((cardId,index)=>this.playCardEffect(side,cardId,lane,x+(side===SIDE_PLAYER?-index*22:index*22),{source:'treasure',y:targetY+(index?24:-24)}));
      this.createBurst(x,targetY,'#c57aff',36); return;
    }
    oldCastSpell.call(this, side, card, lane, x, targetY);
  };

  const oldTriggerHazard = proto.triggerHazard;
  proto.triggerHazard = function triggerHazardV140(hazard) {
    const warning = Number(hazard.warning || 2.8);
    if (hazard.type === 'undertow') {
      const lane = Math.floor(Math.random()*Math.max(1,this.routeCount));
      const x=randomBetween(540,740), y=this.routePointAtX(lane,x).y;
      this.hazardVisuals.push({id:`undertow-${this.uid++}`,type:'gravityWell',lane,x,y,radius:Number(hazard.radius||190),warningUntil:this.elapsed+warning,activeUntil:this.elapsed+warning+Number(hazard.duration||6.5)});
      this.emitEvent('warning',{title:'逆流潮眼',text:`${this.routeName(lane)}附近将形成牵引潮眼。`,lane,hazard:'undertow'}); RF.audio.play('warning'); return;
    }
    if (hazard.type === 'anchorDrop') {
      const lane=Math.floor(Math.random()*Math.max(1,this.routeCount)); const x=randomBetween(590,720), y=this.routePointAtX(lane,x).y;
      this.hazardVisuals.push({id:`anchor-${this.uid++}`,type:'orbitalTarget',lane,x,y,radius:72,warningUntil:this.elapsed+warning,activeUntil:this.elapsed+warning+0.45});
      this.emitEvent('warning',{title:'深锚投送',text:'一座嘲讽祭坛即将落在桥梁交汇处。',lane,hazard:'undertow'});
      this.schedule(warning,()=>{this.playCardEffect(SIDE_ENEMY,'tide_anchor_shrine',lane,x,{source:'hazard',y});this.createBurst(x,y,'#55e3d2',24);}); RF.audio.play('warning'); return;
    }
    if (hazard.type === 'echoFleet') {
      this.emitEvent('warning',{title:'亡舰回航',text:'幽潮增援将在两条随机通路同时出现。',hazard:'undertow'});
      this.schedule(warning,()=>{
        const lanes=[...Array(this.routeCount).keys()].sort(()=>Math.random()-0.5).slice(0,Math.min(2,this.routeCount));
        lanes.forEach((lane,index)=>{const x=randomBetween(930,1080), y=this.routePointAtX(lane,x).y+randomBetween(-28,28);this.playCardEffect(SIDE_ENEMY,index?'tide_harpooners':'tide_deckhands',lane,x,{source:'echoFleet',y});});
      }); RF.audio.play('warning'); return;
    }
    if (hazard.type === 'tidalSweep') {
      this.emitEvent('warning',{title:'横潮冲击',text:'巨浪将把我方地面单位向核心方向推移。',hazard:'undertow'});
      this.schedule(warning,()=>{
        this.entities.filter((entity)=>entity.alive&&!entity.isBuilding&&!entity.flying).forEach((entity)=>{
          const shift=entity.side===SIDE_PLAYER?-88:-38; const nx=clamp(entity.x+shift,FIELD.left+entity.radius,FIELD.right-entity.radius);
          if (!dynamicBlocked(this,entity,nx,entity.y,entity.radius*0.7,null)) entity.x=nx;
          entity.slowUntil=Math.max(entity.slowUntil,this.elapsed+2.8); entity.navPath=null;
        });
        this.createBurst(640,360,'#4de5d4',42); RF.audio.play('boom');
      }); RF.audio.play('warning'); return;
    }
    if (hazard.type === 'shadowMist') {
      const lane=Math.floor(Math.random()*Math.max(1,this.routeCount)); const duration=Number(hazard.duration||7.5);
      this.emitEvent('warning',{title:'影渊迷雾',text:`${this.routeName(lane)}即将进入日蚀迷雾，敌军会短暂脱离远程索敌。`,lane,hazard:'shadow'});
      this.schedule(warning,()=>{
        this.entities.filter((entity)=>entity.alive&&entity.side===SIDE_ENEMY&&entity.lane===lane).forEach((entity)=>{entity.stealthUntil=Math.max(Number(entity.stealthUntil||0),this.elapsed+duration);entity.rallyUntil=Math.max(Number(entity.rallyUntil||0),this.elapsed+duration*.65);});
        this.entities.filter((entity)=>entity.alive&&entity.side===SIDE_PLAYER).forEach((entity)=>{const locked=getTargetById(this,entity.lockedTargetId);if(locked?.side===SIDE_ENEMY&&locked.lane===lane)entity.lockedTargetId=null;});
        this.createBurst(640,this.routePointAtX(lane,640).y,'#b05cff',34);
      }); RF.audio.play('warning'); return;
    }
    oldTriggerHazard.call(this,hazard);
  };

  const oldBossLoop = proto.startBossPowerLoop;
  proto.startBossPowerLoop = function startBossPowerLoopV140(boss,bossEntity) {
    const power=boss.power;
    if (!['undertowAdmiral','echoAdmiral','crownlessTide','aggroHijack','soulDrain','riftSwap','eclipseVeil','nightmareGate','eclipseDominion'].includes(power)) { oldBossLoop.call(this,boss,bossEntity); return; }
    const interval=Number(boss.powerEvery||16.8);
    let cycle=0;
    const trigger=()=>{
      if (this.ended||!bossEntity?.alive) return;
      cycle+=1;
      if (power==='undertowAdmiral') {
        if (cycle%2) this.triggerHazard({type:'undertow',warning:2.5,duration:6.2,radius:200});
        else this.triggerHazard({type:'anchorDrop',warning:2.4,duration:0.4});
        this.playCardEffect(SIDE_ENEMY,'tide_harpooners',bossEntity.lane,clamp(bossEntity.x-45,760,1100),{source:'bossPower',y:bossEntity.y+randomBetween(-48,48)});
      } else if (power==='echoAdmiral') {
        this.triggerHazard({type:'echoFleet',warning:2.3,duration:0.4});
        this.healTarget(bossEntity,bossEntity.maxHp*0.045,true);
      } else if (power==='crownlessTide') {
        const phase=cycle%3;
        if (phase===1) this.triggerHazard({type:'anchorDrop',warning:2.2,duration:0.4});
        else if (phase===2) this.triggerHazard({type:'tidalSweep',warning:2.3,duration:0.4});
        else this.triggerHazard({type:'deckDevour',warning:2.4,duration:0.5,count:Number(boss.devourCount||1)});
        bossEntity.shield=Math.min((bossEntity.shield||0)+bossEntity.maxHp*0.05,bossEntity.maxHp*0.45);
      } else if (power==='aggroHijack') {
        const lane=this.resolveBossLane('stronger'); const x=randomBetween(570,710), y=this.routePointAtX(lane,x).y;
        this.playCardEffect(SIDE_ENEMY,'shadow_pylon',lane,x,{source:'bossPower',y});
        this.entities.filter((entity)=>entity.alive&&entity.side===SIDE_PLAYER&&!entity.isBuilding&&Math.hypot(entity.x-x,entity.y-y)<270).forEach((entity)=>{entity.lockedTargetId=null;entity.navPath=null;});
        this.emitEvent('warning',{title:boss.powerName||'诱导劫持',text:'高优先级方尖碑落入中央，附近单位将重新索敌。',hazard:'shadow'});
      } else if (power==='soulDrain') {
        let drained=0; this.entities.filter((entity)=>entity.alive&&entity.side===SIDE_PLAYER&&!entity.isBuilding).forEach((entity)=>{const amount=Math.min(entity.hp*.08,38);drained+=this.applyDamage(entity,amount,bossEntity,{silent:true});});
        this.healTarget(bossEntity,drained*.55,true); this.createBurst(bossEntity.x,bossEntity.y,'#cd72ff',38);
        this.emitEvent('warning',{title:boss.powerName||'灵魂什一税',text:'Boss抽取全场友军生命并治疗自身。',hazard:'shadow'});
      } else if (power==='riftSwap') {
        const candidates=this.entities.filter((entity)=>entity.alive&&entity.side===SIDE_PLAYER&&!entity.isBuilding).sort((a,b)=>(b.maxHp+b.damage*4)-(a.maxHp+a.damage*4));
        const target=candidates[0]; if(target&&this.routeCount>1){const newLane=(target.lane+1+Math.floor(Math.random()*(this.routeCount-1)))%this.routeCount;const nx=clamp(target.x,180,760),ny=this.routePointAtX(newLane,nx).y;target.lane=newLane;target.x=nx;target.y=ny;target.lockedTargetId=null;target.navPath=null;this.createBurst(nx,ny,'#bf6fff',28);this.emitEvent('warning',{title:boss.powerName||'王桥易位',text:`${target.name}被折跃到${this.routeName(newLane)}。`,hazard:'shadow'});}
      } else if (power==='eclipseVeil') {
        const duration=Number(boss.powerDuration||7);this.entities.filter((entity)=>entity.alive&&entity.side===SIDE_ENEMY).forEach((entity)=>{entity.stealthUntil=Math.max(Number(entity.stealthUntil||0),this.elapsed+duration);entity.rallyUntil=Math.max(Number(entity.rallyUntil||0),this.elapsed+duration*.7);});
        this.entities.filter((entity)=>entity.alive&&entity.side===SIDE_PLAYER).forEach((entity)=>{entity.lockedTargetId=null;});this.createBurst(bossEntity.x,bossEntity.y,'#d27cff',42);this.emitEvent('warning',{title:boss.powerName||'黑日幕墙',text:'敌军进入隐匿并清除我方现有锁定。',hazard:'shadow'});
      } else if (power==='nightmareGate') {
        for(let lane=0;lane<this.routeCount;lane+=1){const x=randomBetween(900,1040),y=this.routePointAtX(lane,x).y;this.playCardEffect(SIDE_ENEMY,'shadow_gate',lane,x,{source:'bossPower',y});}
        this.emitEvent('warning',{title:boss.powerName||'万门齐开',text:'所有通路同时生成噩梦裂隙门。',hazard:'shadow'});
      } else if (power==='eclipseDominion') {
        const phase=cycle%4;
        if(phase===1){const lane=this.resolveBossLane('stronger');const x=randomBetween(570,710),y=this.routePointAtX(lane,x).y;this.playCardEffect(SIDE_ENEMY,'shadow_pylon',lane,x,{source:'bossPower',y});}
        else if(phase===2){const duration=Number(boss.powerDuration||7.2);this.entities.filter((entity)=>entity.alive&&entity.side===SIDE_ENEMY).forEach((entity)=>{entity.stealthUntil=Math.max(Number(entity.stealthUntil||0),this.elapsed+duration);});}
        else if(phase===3){const candidates=this.entities.filter((entity)=>entity.alive&&entity.side===SIDE_PLAYER&&!entity.isBuilding).sort((a,b)=>b.maxHp-a.maxHp);const target=candidates[0];if(target&&this.routeCount>1){target.lane=(target.lane+1)%this.routeCount;target.y=this.routePointAtX(target.lane,target.x).y;target.lockedTargetId=null;target.navPath=null;}}
        else {let drained=0;this.entities.filter((entity)=>entity.alive&&entity.side===SIDE_PLAYER&&!entity.isBuilding).forEach((entity)=>{drained+=this.applyDamage(entity,Math.min(entity.hp*.07,34),bossEntity,{silent:true});});this.healTarget(bossEntity,drained*.5,true);}
        this.createBurst(bossEntity.x,bossEntity.y,'#d178ff',46);this.emitEvent('warning',{title:boss.powerName||'唯一目标',text:'王桥协议正在轮换诱导、隐匿、折跃与吸血。',hazard:'shadow'});
      }
      this.schedule(interval,trigger);
    };
    this.schedule(Math.max(5.5,interval*0.5),trigger);
  };

  const upgradedSpellCastV140 = proto.castSpell;
  proto.castSpell = function castSpellUpgradeV140(side, card, lane, x, y = null) {
    const rank = side === SIDE_PLAYER ? Number(this.mods.cardUpgrades?.[card?.id] || 0) : 0;
    const previous = Number(this.mods.spellPower || 0);
    if (rank > 0) this.mods.spellPower = previous + rank * 0.16;
    try { return upgradedSpellCastV140.call(this, side, card, lane, x, y); }
    finally { this.mods.spellPower = previous; }
  };
})();
