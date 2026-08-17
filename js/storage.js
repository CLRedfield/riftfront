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
      battleSpeed: 1
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
      const valid = list.filter((id) => RF.CARDS[id] && !RF.CARDS[id].enemyOnly).slice(0, limit);
      if (valid.length === limit) result[group.id] = valid;
    });
    return result;
  };

  const sanitize = (raw) => {
    const base = fresh();
    if (!raw || typeof raw !== 'object') return base;

    const completed = Array.isArray(raw.campaign?.completed)
      ? raw.campaign.completed.map(Number).filter((n) => n >= 1 && n <= RF.LEVELS.length)
      : [];

    base.campaign.completed = [...new Set(completed)];
    base.campaign.stars = { ...(raw.campaign?.stars || {}) };
    base.campaign.bestTimes = { ...(raw.campaign?.bestTimes || {}) };
    base.campaign.seenIntros = Array.isArray(raw.campaign?.seenIntros) ? raw.campaign.seenIntros : [];
    base.campaign.campaignComplete = Boolean(raw.campaign?.campaignComplete);
    base.deck = sanitizeDeck(raw.deck);
    base.rogue = raw.rogue && typeof raw.rogue === 'object' ? raw.rogue : null;
    base.settings = { ...base.settings, ...(raw.settings || {}) };
    base.stats = { ...base.stats, ...(raw.stats || {}) };
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
    state = sanitize(parsed);
    save();
    return state;
  }

  RF.Storage = { load, save, get, patch, reset, exportSave, importSave, sanitizeDeck, cloneDeck };
})();
