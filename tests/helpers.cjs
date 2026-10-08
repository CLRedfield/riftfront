const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function runtime(seed = 17) {
  let rng = seed >>> 0;
  const math = Object.create(Math);
  math.random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
  const data = new Map(), timers = new Map(), errors = [], events = [];
  let timerId = 0;
  const ctx = vm.createContext({
    console: { log() {}, debug() {}, warn() {}, error(...args) { errors.push(args.join(' ')); } },
    Math: math, performance: { now: () => 0 },
    setTimeout: (fn) => { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    localStorage: { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value) },
    btoa: (text) => Buffer.from(text, 'binary').toString('base64'), atob: (text) => Buffer.from(text, 'base64').toString('binary'),
    document: { addEventListener() {} }, Image: class { constructor() { this.complete = false; } }
  });
  ctx.window = ctx;
  const read = (file) => vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), ctx, { filename: file });
  ['data.js', 'v140_data.js', 'storage.js', 'ui.js', 'engine.js', 'v140_engine.js'].forEach(read);
  ctx.RF.audio = { play() {} };
  read('experience.js');
  const RF = ctx.RF;
  const create = (level = 0, opts = {}) => {
    const listeners = new Map();
    const canvas = { getContext: () => ({}), addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name), getBoundingClientRect: () => ({ left: 10, top: 20, width: 640, height: 400 }) };
    const config = typeof level === 'object' ? level : RF.LEVELS[level];
    const battle = new RF.BattleEngine(canvas, config, { deck: RF.DEFAULT_DECK, onEvent: (event) => events.push(event), ...opts });
    return { battle, listeners };
  };
  return { RF, create, errors, events, timers, ctx, flush: () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } } };
}

function playTurn(b, RF) {
  const friendly = b.entities.filter((e) => e.alive && e.side === 'player');
  const enemies = b.entities.filter((e) => e.alive && e.side === 'enemy');
  const focusLane = 0;
  for (let i = 0; i < b.hand.length; i++) {
    const item = b.hand[i], card = RF.CARDS[item.cardId];
    if (b.getEffectiveCost(item) > b.energy) continue;
    if (card.type === 'spell') {
      const pool = card.target === 'friendly' ? friendly.filter((e) => e.hp < e.maxHp * 0.8) : enemies;
      if (pool.length < 2 && b.energy < 9) continue;
      const target = pool[0] || b.forts.enemyOutposts[0];
      if (b.playCardAtIndex(i, Math.min(card.target === 'friendly' ? 780 : 1180, target.x), target.y)) return;
    } else {
      if (card.unit?.role === 'healer' && !friendly.length) continue;
      const danger = enemies.find((e) => e.x < 350);
      const lane = danger ? danger.lane : focusLane;
      for (const x of [690, 610, 440, 380, 330, 215]) {
        for (const offset of [-30, 30, 0, -65, 65]) {
          const y = b.routePointAtX(lane, x).y + offset;
          if (b.getPlacementPreview(i, x, y).ok && b.playCardAtIndex(i, x, y)) return;
        }
      }
    }
  }
  if (b.hand.length >= 8 && b.archiveCharges > 0) {
    const index = b.hand.findIndex((item) => RF.CARDS[item.cardId].type !== 'unit');
    if (index >= 0) b.archiveCard(index);
  }
}


module.exports = { runtime, playTurn };
