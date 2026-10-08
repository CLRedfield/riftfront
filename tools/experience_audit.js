/* Browser integration tests. Production code is loaded unchanged into an isolated memory profile. */
(function () {
  const runButton = document.getElementById('run');
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  const frame = document.getElementById('game');
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  runButton.addEventListener('click', async () => {
    runButton.disabled = true; results.innerHTML = ''; status.textContent = '测试运行中…';
    let passed = 0, failed = 0;
    const check = async (name, fn) => {
      const row = document.createElement('li'); results.appendChild(row);
      try { await fn(); row.className = 'pass'; row.textContent = `通过 · ${name}`; passed++; }
      catch (error) { row.className = 'fail'; row.textContent = `失败 · ${name}：${error.message}`; failed++; }
    };
    try {
      const source = await (await fetch('../index.html', { cache: 'no-store' })).text();
      const setup = `<base href="${new URL('../', location.href).href}"><script>
        const memory = new Map();
        Object.defineProperty(window, 'localStorage', { value: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) } });
        window.auditErrors = [];
        window.addEventListener('error', event => window.auditErrors.push(event.message));
        window.addEventListener('unhandledrejection', event => window.auditErrors.push(String(event.reason)));
      <\/script>`;
      const loaded = new Promise((resolve) => { frame.onload = resolve; });
      frame.srcdoc = source.replace('<head>', `<head>${setup}`);
      await loaded;
      const w = frame.contentWindow, d = w.document, RF = w.RF, app = w.RiftfrontApp;
      RF.audio.setEnabled(false); RF.Storage.patch((save) => { save.settings.sound = false; });
      const click = (selector) => { const button = d.querySelector(selector); assert(button, `找不到 ${selector}`); button.click(); };

      await check('主菜单加载完整，无旧版标题或 undefined', () => {
        assert(d.querySelector('.command-home h1')?.textContent === '裂界战线', '新版主菜单未加载');
        assert(!d.body.textContent.includes('undefined'), '出现 undefined');
        assert(RF.Storage.get().stats.battles === 0, '测试存档未隔离');
      });
      await check('十关选关、条件文案与难度设置', () => {
        app.renderCampaign(); assert(d.querySelectorAll('.mission-row').length === 10, '关卡数量不正确');
        assert(!d.body.textContent.includes('undefined'), '环境标签缺失');
        click('[data-difficulty="relaxed"]'); assert(app.save.settings.difficulty === 'relaxed', '难度未保存');
        click('[data-difficulty="standard"]');
      });
      await check('训练进入战前准备；计时停止，背景不可操作', () => {
        app.beginBattle(RF.LEVELS[0], { mode: 'training', levelId: 1 });
        assert(app.battle.paused && app.root.inert, '准备状态未暂停');
        app.battle.update(5); assert(app.battle.elapsed === 0, '战前时间推进');
        click('[data-modal-action="command-resume"]');
        assert(!app.battle.paused && !app.root.inert, '开始后仍被阻塞');
      });
      await check('点击选牌、无效落点与有效部署', () => {
        click('[data-card-index="0"]'); assert(app.battle.selectedIndex === 0, '卡牌未选择');
        assert(!app.battle.playSelectedAt(1100, 205), '允许在敌区部署');
        const energy = app.battle.energy;
        assert(app.battle.playSelectedAt(390, 205), '合法落点未部署');
        assert(app.battle.energy === energy - 2 && app.battle.hand.length === 4, '扣费/手牌错误');
        assert(d.querySelector('.command-coach').textContent.includes('2 / 3'), '引导未推进');
      });
      await check('暂停时出牌、归档与计时完全停止；取消重开后可继续', () => {
        app.showPause(); const elapsed = app.battle.elapsed, size = app.battle.hand.length;
        assert(!app.battle.playCardAtIndex(0, 400, 250) && !app.battle.archiveCard(0), '暂停仍能操作');
        app.battle.update(10); assert(app.battle.elapsed === elapsed && app.battle.hand.length === size, '暂停状态发生变化');
        click('[data-modal-action="command-restart"]'); click('[data-modal-action="confirm-no"]');
        assert(d.querySelector('.command-pause'), '取消后没有返回暂停菜单');
        click('[data-modal-action="command-resume"]'); assert(!app.battle.paused, '不能继续');
      });
      await check('重开销毁旧引擎，训练结算不写入战役和统计', async () => {
        const old = app.battle; app.showPause(); click('[data-modal-action="command-restart"]'); click('[data-modal-action="confirm-yes"]');
        assert(old.destroyed && app.battle !== old && app.battle.elapsed === 0, '重开未重置');
        app.resumeBattle(); app.battle.finishBattle(true, '训练回归验证'); await sleep(650);
        assert(d.querySelector('.command-result'), '没有训练结算');
        assert(app.save.stats.battles === 0 && app.save.campaign.completed.length === 0, '训练污染进度');
        click('[data-modal-action="result-primary"]'); assert(app.currentScreen === 'campaign', '不能返回战役');
      });
      await check('战役胜利保存星级，继续按钮进入下一关剧情', async () => {
        app.beginBattle(RF.LEVELS[0], { mode: 'campaign', levelId: 1 }); app.resumeBattle();
        app.battle.finishBattle(true, '流程验证'); await sleep(650);
        assert(app.save.campaign.completed.includes(1), '未记录完成');
        click('[data-modal-action="result-primary"]'); click('[data-modal-action="dialogue-skip"]');
        assert(app.dialogueState?.meta.title === RF.LEVELS[1].title, '未继续第二关');
        app.renderHome();
      });
      await check('远征胜利在领奖前持久化；重载恢复后碎片只结算一次', async () => {
        app.startNewRogue(RF.FACTIONS[0].id); const run = app.save.rogue, option = run.options[0];
        const shards = run.shards;
        app.beginBattle(app.buildRogueConfig(run, option), { mode: 'rogue', depth: 0, optionId: option.id, option });
        app.resumeBattle(); app.battle.finishBattle(true, '远征验证'); await sleep(650);
        assert(run.pendingVictory, '胜利未持久化');
        const code = RF.Storage.exportSave(); app.destroyBattle(); RF.Storage.importSave(code); app.currentResult = null; app.battleContext = null;
        app.renderRogue();
        assert(app.save.rogue.pendingLoot?.choices.length === 3, '未恢复三选一');
        const rewardShards = app.save.rogue.shards;
        assert(rewardShards > shards, '没有碎片奖励');
        app.renderRogue(); assert(app.save.rogue.shards === rewardShards, '重复发放碎片');
      });
      await check('战利品选择与重掷跨保存恢复；领取后只前进一层', () => {
        const ids = app.rogueRewardChoices.map((item) => item.id).join('|');
        const code = RF.Storage.exportSave(); RF.Storage.importSave(code); app.rogueRewardChoices = []; app.renderRogue();
        assert(app.rogueRewardChoices.map((item) => item.id).join('|') === ids, '恢复时重掷了奖励');
        const count = app.save.rogue.rewardRerolls;
        app.rerollRogueLoot(); assert(app.save.rogue.rewardRerolls === count - 1, '重掷次数不正确');
        assert(app.save.rogue.pendingLoot.choices[0].id === app.rogueRewardChoices[0].id, '新奖励未保存');
        const rewardId = app.rogueRewardChoices[0].id;
        app.selectRogueLoot(rewardId); app.selectRogueLoot(rewardId);
        assert(app.save.rogue.depth === 1 && !app.save.rogue.pendingLoot, '重复领取或未推进');
      });
      await check('第二层奖励进入营地，刷新可恢复并完成营地选择', async () => {
        const run = app.save.rogue, option = run.options[0];
        app.beginBattle(app.buildRogueConfig(run, option), { mode: 'rogue', depth: 1, optionId: option.id, option });
        app.resumeBattle(); app.battle.finishBattle(true, '营地验证'); await sleep(650); app.processRogueVictory();
        app.selectRogueLoot(app.rogueRewardChoices[0].id);
        assert(app.save.rogue.depth === 2 && app.save.rogue.pendingCamp === 2, '未出现营地');
        const code = RF.Storage.exportSave(); RF.Storage.importSave(code); app.renderRogue();
        assert(d.querySelector('[data-modal-action="camp-scout"]'), '未恢复营地');
        click('[data-modal-action="camp-scout"]'); assert(!app.save.rogue.pendingCamp, '营地未完成');
      });
      await check('商店锻造、精简与余额不足保护', () => {
        app.save.rogue.shards = 200; app.openRogueShop(); click('[data-modal-action="shop-upgrade"]');
        const option = d.querySelector('[data-modal-action="shop-upgrade-card"]'), id = option?.dataset.cardId;
        assert(option, '没有可锻造卡牌'); option.click();
        assert(app.save.rogue.shards === 120, '锻造扣费异常');
        assert(Object.values(app.save.rogue.cardUpgrades).some((rank) => rank >= 1), '锻造未生效');
        const length = app.save.rogue.deck.arsenal.length; app.openRogueShop(); click('[data-modal-action="shop-remove"]'); click('[data-modal-action="shop-remove-card"]');
        assert(app.save.rogue.deck.arsenal.length === length - 1 && app.save.rogue.shards === 65, '精简未生效');
        app.save.rogue.shards = 0; app.openRogueShop(); click('[data-modal-action="shop-relic"]'); assert(app.save.rogue.shards === 0, '余额变负'); app.closeModal();
      });
      await check('八层远征奖励、营地和最终通关闭环，徽记只发放一次', async () => {
        const beforeWins = app.save.stats.rogueWins;
        while (app.save.rogue.active) {
          const run = app.save.rogue, depth = run.depth, option = run.options[0];
          app.beginBattle(app.buildRogueConfig(run, option), { mode: 'rogue', depth, optionId: option.id, option });
          app.resumeBattle(); app.battle.finishBattle(true, '八层流程验证'); await sleep(650);
          click('[data-modal-action="result-primary"]');
          if (app.save.rogue.active) {
            assert(app.rogueRewardChoices.length === 3, `第${depth + 1}层奖励缺失`);
            app.selectRogueLoot(app.rogueRewardChoices[0].id);
            if (app.save.rogue.pendingCamp) click('[data-modal-action="camp-scout"]');
            assert(app.save.rogue.depth === depth + 1, '层数未推进');
          }
        }
        assert(app.save.rogue.completed && app.save.rogue.history.filter(item => item.victory).length === 8, '未记录完整八层胜利');
        assert(d.querySelector('.rogue-complete-modal'), '缺少通关画面');
        app.processRogueVictory(); app.renderRogue();
        assert(app.save.stats.rogueWins === beforeWins + 1, '通关徽记重复发放');
      });
      await check('四个阵营均可开局；远征失败刷新后不可复活或重复结算', async () => {
        app.renderRogue(); click('[data-difficulty="relaxed"]');
        assert(app.currentScreen === 'rogue' && app.save.settings.difficulty === 'relaxed', '远征难度无法切换');
        click('[data-difficulty="standard"]');
        for (const faction of RF.FACTIONS) {
          app.startNewRogue(faction.id);
          assert(app.save.rogue.factionId === faction.id && app.save.rogue.deck.arsenal.length === 12, '阵营初始牌库错误');
          assert(app.save.rogue.options.length === 3, '缺少三条远征路线');
        }
        const run = app.save.rogue, option = run.options[0];
        app.beginBattle(app.buildRogueConfig(run, option), { mode: 'rogue', depth: 0, optionId: option.id, option });
        app.resumeBattle(); app.battle.finishBattle(false, '失败恢复验证'); await sleep(650);
        assert(run.pendingDefeat, '失败结算未持久化');
        const code = RF.Storage.exportSave(); app.destroyBattle(); RF.Storage.importSave(code); app.battleContext = null;
        app.renderRogue(); app.processRogueDefeat();
        assert(!app.save.rogue.active && !app.save.rogue.completed && app.save.rogue.failedAt === 1, '失败后远征仍然有效');
        assert(app.save.rogue.history.filter(item => !item.victory).length === 1, '失败重复结算');
      });
      await check('套牌搜索、阵营过滤、移除、撤销与保存', () => {
        app.deckDraft = RF.Storage.cloneDeck(app.save.deck); app.renderDeckBuilder();
        app.deckSearch = '不存在的卡名'; app.filterDeckLibrary(); assert(d.querySelector('.empty-library'), '搜索未过滤');
        app.deckSearch = ''; app.deckFactionFilter = 'shadow'; app.filterDeckLibrary();
        assert(d.querySelectorAll('.card-library-grid .card-tile').length > 0, '阵营筛选无卡牌');
        app.removeDeckCard('arsenal', 0); assert(app.deckDraft.arsenal.length === 29, '移除未生效');
        app.handleAction('undo-deck'); assert(app.deckDraft.arsenal.length === 30, '撤销未恢复');
        app.saveDeck(); assert(app.validateDeck(app.save.deck).valid, '保存无效套牌');
      });
      await check('设置输入不触发战斗快捷键，保存音量并可返回暂停菜单', () => {
        app.beginBattle(RF.LEVELS[0], { mode: 'training', levelId: 1 }); app.resumeBattle(); app.showPause();
        click('[data-modal-action="command-settings"]');
        const input = d.getElementById('sound-volume'); input.value = 30; input.dispatchEvent(new w.Event('input', { bubbles: true }));
        assert(RF.audio.volume === 0.3 && app.save.settings.volume === 0.3, '音量未保存');
        click('[data-modal-action="close"]'); assert(d.querySelector('.command-pause'), '设置关闭未返回暂停');
      });
      await check('离开已结束战斗后，延迟结算不会污染主菜单', async () => {
        app.resumeBattle(); app.battle.finishBattle(false, '回调隔离测试'); app.renderHome(); await sleep(650);
        assert(app.currentScreen === 'home' && !d.querySelector('.command-result'), '延迟回调污染界面');
      });
      await check('全流程没有 JavaScript 异常', () => { assert(w.auditErrors.length === 0, w.auditErrors.join(' / ')); });
      app.destroyBattle();
    } catch (error) { failed++; const li = document.createElement('li'); li.className = 'fail'; li.textContent = `初始化失败：${error.stack}`; results.appendChild(li); }
    status.textContent = `${passed} 项通过，${failed} 项失败`;
    document.title = `流程验证：${passed} 通过 / ${failed} 失败`;
    runButton.disabled = false;
  });
})();
