// Deterministic strategy probe; reports balance evidence, not a guarantee of player win rates.
const { runtime, playTurn } = require('../tests/helpers.cjs');
const difficulty = process.argv[2] || 'standard';
const selected = (process.argv[3] || '1,2,3').split(',').map(Number);
for (const id of selected) {
  const r = runtime(1728 + id); let outcome;
  const config = r.RF.Experience.prepareConfig(r.RF.LEVELS[id - 1], difficulty);
  const { battle: b } = r.create(config, { onEnd: (value) => { outcome = value; } });
  for (let tick = 0; tick < 5500 && !b.ended; tick++) {
    if (tick % 10 === 0) playTurn(b, r.RF);
    b.update(0.05);
  }
  r.flush();
  console.log(JSON.stringify({ level: id, difficulty, won: outcome?.victory, duration: Math.round(b.elapsed), ownCore: Math.round(b.forts.playerCore.hp), enemyCore: Math.round(b.forts.enemyCore.hp), ownPosts: b.forts.playerOutposts.map((f) => Math.round(f.hp)), enemyPosts: b.forts.enemyOutposts.map((f) => Math.round(f.hp)), cards: b.battleStats.cardsPlayed, damage: Math.round(b.battleStats.damageDealt), survivors: b.entities.filter((e) => e.alive).map((e) => ({ id: e.cardId, side: e.side, x: Math.round(e.x), y: Math.round(e.y), hp: Math.round(e.hp) })), errors: r.errors }));
  b.destroy();
}
