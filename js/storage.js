(function () {
  'use strict';

  const RF = window.RF = window.RF || {};
  const KEY = 'riftfront_pve_demo_save_v14';

  const cloneDeck = (deck) => {
    const result = {};
    (RF.GROUPS || []).forEach((group) => {
      const list = Array.isArray(deck?.[group.id]) ? deck[group.id] : (Array.isArray(RF.DEFAULT_DECK?.[group.id]) ? RF.DEFAULT_DECK[group.id] : []);
      result[group.id] = [...list];
    });
    return result;
  };

  const fresh = () => ({
    version: 14,
    campaign: {
      completed: [],
      stars: {},
      bestTimes: {},
      seenIntros: [],
      campaignComplete: false
    },
    deck: cloneDeck(RF.DEFAULT_DECK),
    rogue: null,
    settings: {
      sound: true,
      reducedMotion: false,
      battleSpeed: 1,
      difficulty: 'standard',
      volume: 0.65
    },
    stats: {
      battles: 0,
      victories: 0,
      cardsPlayed: 0,
      unitsDeployed: 0,
      rogueWins: 0
    }
  });

  const sanitizeDeck = (deck) => {
    const result = cloneDeck(RF.DEFAULT_DECK);
    if (!deck || typeof deck !== 'object') return result;
    (RF.GROUPS || []).forEach((group) => {
      const limit = group.id === 'arsenal' ? 30 : 10;
      const list = Array.isArray(deck[group.id]) ? deck[group.id] : [];
      const counts = {};
      const valid = list.filter((id) => {
        const card = RF.CARDS[id];
        if (!card || card.enemyOnly || card.treasure) return false;
        counts[id] = (counts[id] || 0) + 1;
        return counts[id] <= (card.rarity === 'legendary' ? 1 : 2);
      }).slice(0, limit);
      if (valid.length === limit) result[group.id] = valid;
    });
    return result;
  };

  const finite = (value, fallback, min = 0, max = 100000000) => Number.isFinite(Number(value))
    ? Math.min(max, Math.max(min, Number(value))) : fallback;
  const ids = (value, valid) => Array.isArray(value) ? value.filter((id) => typeof id === 'string' && valid(id)) : [];
  const sanitizeRogue = (raw) => {
    if (!raw || typeof raw !== 'object' || !RF.FACTIONS.some((faction) => faction.id === raw.factionId)) return null;
    const cards = ids(raw.deck?.arsenal, (id) => RF.CARDS[id] && !RF.CARDS[id].enemyOnly).slice(0, 200);
    if (!cards.length) return null;
    const run = { ...raw, deck: { arsenal: cards } };
    run.depth = Math.floor(finite(raw.depth, 0, 0, 7));
    run.maxDepth = 8;
    run.active = Boolean(raw.active);
    run.completed = Boolean(raw.completed);
    run.relics = [...new Set(ids(raw.relics, (id) => RF.ROGUE_RELICS.some((item) => item.id === id)))];
    run.treasureCards = [...new Set(ids(raw.treasureCards, (id) => RF.CARDS[id]?.treasure))];
    run.chosenBundleIds = ids(raw.chosenBundleIds, (id) => RF.ROGUE_BUNDLES.some((item) => item.id === id));
    run.chosenBundles = run.chosenBundleIds.map((id) => RF.ROGUE_BUNDLES.find((item) => item.id === id).name);
    run.curses = ids(raw.curses, (id) => ['thin_reserves', 'fragile_shell', 'slow_manifest', 'dulled_edges'].includes(id));
    run.history = Array.isArray(raw.history) ? raw.history.filter((item) => item && typeof item === 'object').slice(-20) : [];
    run.campSeen = Array.isArray(raw.campSeen) ? raw.campSeen.filter((depth) => [2, 4, 6].includes(depth)) : [];
    run.options = Array.isArray(raw.options) ? raw.options.filter((item) => item && typeof item.id === 'string' && RF.ROGUE_BIOMES.some((b) => b.id === item.biomeId) && RF.CARDS[item.bossCardId] && item.bossPower && item.modifier).slice(0, 3) : [];
    ['shards', 'rewardRerolls', 'eliteWins', 'shopPurchases', 'lastShardReward'].forEach((key) => { run[key] = Math.floor(finite(raw[key], 0)); });
    run.cardUpgrades = {};
    Object.entries(raw.cardUpgrades || {}).forEach(([id, rank]) => { if (cards.includes(id)) run.cardUpgrades[id] = Math.floor(finite(rank, 0, 0, 2)); });
    if (!raw.pendingLoot || raw.pendingLoot.depth !== run.depth || !Array.isArray(raw.pendingLoot.choices)) delete run.pendingLoot;
    if (!raw.pendingVictory?.result?.victory || typeof raw.pendingVictory?.context?.optionId !== 'string' || !raw.pendingVictory.context.option?.bossPower) delete run.pendingVictory;
    if (!raw.pendingDefeat || typeof raw.pendingDefeat.optionId !== 'string') delete run.pendingDefeat;
    if (![2, 4, 6].includes(raw.pendingCamp) || raw.pendingCamp !== run.depth) delete run.pendingCamp;
    return run;
  };

  const sanitize = (raw) => {
    const base = fresh();
    if (!raw || typeof raw !== 'object') return base;

    const completed = Array.isArray(raw.campaign?.completed)
      ? raw.campaign.completed.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= RF.LEVELS.length)
      : [];

    base.campaign.completed = [...new Set(completed)];
    base.campaign.completed.forEach((id) => {
      base.campaign.stars[id] = Math.floor(finite(raw.campaign?.stars?.[id], 1, 1, 3));
      const time = finite(raw.campaign?.bestTimes?.[id], 0, 0, 3600);
      if (time > 0) base.campaign.bestTimes[id] = time;
    });
    base.campaign.seenIntros = Array.isArray(raw.campaign?.seenIntros) ? raw.campaign.seenIntros.filter((value) => typeof value === 'string' || Number.isInteger(value)).slice(0, 50) : [];
    base.campaign.campaignComplete = base.campaign.completed.includes(RF.LEVELS.length);
    base.deck = sanitizeDeck(raw.deck);
    base.rogue = sanitizeRogue(raw.rogue);
    if (typeof raw.settings?.sound === 'boolean') base.settings.sound = raw.settings.sound;
    if (typeof raw.settings?.reducedMotion === 'boolean') base.settings.reducedMotion = raw.settings.reducedMotion;
    base.settings.battleSpeed = [1, 1.5, 2].includes(raw.settings?.battleSpeed) ? raw.settings.battleSpeed : 1;
    base.settings.difficulty = ['relaxed', 'standard', 'veteran'].includes(raw.settings?.difficulty) ? raw.settings.difficulty : 'standard';
    base.settings.volume = finite(raw.settings?.volume, 0.65, 0, 1);
    Object.keys(base.stats).forEach((key) => { base.stats[key] = Math.floor(finite(raw.stats?.[key], 0)); });
    return base;
  };

  let state = fresh();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? sanitize(JSON.parse(raw)) : fresh();
    } catch (error) {
      console.warn('[Riftfront] Failed to load save; using a fresh profile.', error);
      state = fresh();
    }
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn('[Riftfront] Failed to save profile.', error);
      return false;
    }
  }

  function get() { return state; }
  function patch(mutator) { if (typeof mutator === 'function') mutator(state); save(); return state; }
  function reset() { state = fresh(); save(); return state; }
  function exportSave() { return btoa(unescape(encodeURIComponent(JSON.stringify(state)))); }
  function importSave(encoded) {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(encoded.trim()))));
    if (!parsed || typeof parsed !== 'object' || !parsed.campaign || !parsed.deck || ![13, 14, 17].includes(parsed.version)) throw new Error('Invalid Riftfront save.');
    state = sanitize(parsed);
    save();
    return state;
  }

  RF.Storage = { load, save, get, patch, reset, exportSave, importSave, sanitizeDeck, cloneDeck };
})();
