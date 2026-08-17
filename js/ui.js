(function () {
  'use strict';

  const RF = window.RF = window.RF || {};

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const typeNames = { unit: '小队', building: '建筑', spell: '战术' };
  const rarityNames = { common: '标准', rare: '稀有', epic: '史诗', legendary: '传奇' };
  const factionNames = { federation: '钢铁联邦', swarm: '孢潮母群', prism: '棱镜盟约', neutral: '中立宝藏' };
  const biomeNames = { wasteland: '荒原', ice: '永冬', jungle: '丛林', magma: '熔狱', steel: '蜂巢', mirror: '镜界', core: '中央核心' };
  const biomeIcons = { wasteland: '◇', ice: '❄', jungle: '✤', magma: '♨', steel: '⌬', mirror: '◐', core: '✣' };

  function cardTile(card, options = {}) {
    const count = Number(options.count || 0);
    const disabled = Boolean(options.disabled);
    const compact = Boolean(options.compact);
    const selected = Boolean(options.selected);
    const action = options.action ? `data-${options.action}="${escapeHtml(card.id)}"` : '';
    const title = `${card.name}｜${card.cost}费｜${typeNames[card.type] || card.type}\n${card.desc || ''}`;
    const artSrc = RF.THUMBNAIL_ART?.[card.id] || card.art || RF.CARD_ART?.[card.id] || '';
    const art = artSrc ? `style="background-image:linear-gradient(180deg,rgba(4,10,16,.05),rgba(4,10,16,.48)),url('${escapeHtml(artSrc)}')"` : '';
    const faction = factionNames[card.faction] || (card.treasure ? '远征宝藏' : '通用');
    return `
      <button class="card-tile rarity-${escapeHtml(card.rarity || 'common')} ${artSrc ? 'has-generated-art' : ''} ${card.treasure ? 'is-treasure' : ''} ${compact ? 'is-compact' : ''} ${selected ? 'is-selected' : ''}" ${action} ${disabled ? 'disabled' : ''} title="${escapeHtml(title)}">
        <span class="card-cost">${escapeHtml(card.cost)}</span>
        <span class="card-art ${artSrc ? 'has-image' : ''}" ${art}><span>${artSrc ? '' : escapeHtml(card.icon)}</span></span>
        <span class="card-name">${escapeHtml(card.name)}</span>
        <span class="card-meta">${escapeHtml(faction)} · ${escapeHtml(typeNames[card.type] || card.type)} · ${escapeHtml(rarityNames[card.rarity] || '特殊')}</span>
        ${compact ? '' : `<span class="card-desc">${escapeHtml(card.desc || '')}</span>`}
        ${count > 0 ? `<span class="card-count">×${count}</span>` : ''}
      </button>`;
  }

  function handCard(item, selected, playable) {
    const card = item.card;
    const artSrc = RF.THUMBNAIL_ART?.[card.id] || card.art || RF.CARD_ART?.[card.id] || '';
    const art = artSrc ? `style="background-image:linear-gradient(180deg,rgba(4,10,16,.02),rgba(4,10,16,.28)),url('${escapeHtml(artSrc)}')"` : '';
    return `
      <button class="hand-card rarity-${escapeHtml(card.rarity || 'common')} ${artSrc ? 'has-generated-art' : ''} ${card.treasure ? 'is-treasure' : ''} ${selected ? 'is-selected' : ''} ${playable ? '' : 'is-unaffordable'}"
        data-card-index="${item.index}" title="拖到战场部署；左键选择；右键归档｜${escapeHtml(card.desc || '')}">
        <span class="hand-hotkey">${item.index === 9 ? '0' : item.index + 1}</span>
        <span class="hand-cost ${item.effectiveCost !== card.cost ? 'is-discounted' : ''}">${item.effectiveCost}</span>
        <span class="hand-art ${artSrc ? 'has-image' : ''}" ${art}>${artSrc ? '' : `<b>${escapeHtml(card.icon)}</b>`}</span>
        <span class="hand-name">${escapeHtml(card.name)}</span>
        <span class="hand-type">${escapeHtml(typeNames[card.type] || card.type)}</span>
      </button>`;
  }

  function appHeader(active, save, options = {}) {
    const completed = save.campaign.completed.length;
    const homeButton = active === 'home' ? '' : '<button class="icon-button" data-action="go-home" title="返回主菜单">⌂</button>';
    return `
      <header class="app-header ${options.transparent ? 'is-transparent' : ''}">
        <div class="header-left">
          ${homeButton}
          <button class="brand-button" data-action="go-home" aria-label="返回主菜单">
            <span class="brand-mark">RF</span>
            <span><strong>裂界战线</strong><small>RIFTFRONT PROTOCOL</small></span>
          </button>
        </div>
        <nav class="header-nav" aria-label="主导航">
          <button class="nav-button ${active === 'campaign' ? 'is-active' : ''}" data-action="go-campaign">剧情战役</button>
          <button class="nav-button ${active === 'rogue' ? 'is-active' : ''}" data-action="go-rogue">裂界远征</button>
          <button class="nav-button ${active === 'deck' ? 'is-active' : ''}" data-action="go-deck">战术套牌</button>
          <button class="nav-button ${active === 'guide' ? 'is-active' : ''}" data-action="go-guide">作战手册</button>
        </nav>
        <div class="header-right">
          <span class="progress-chip"><b>${completed}</b> / ${RF.LEVELS.length} 关</span>
          <button class="icon-button" data-action="open-settings" title="设置">⚙</button>
        </div>
      </header>`;
  }

  function relicCard(relic, owned = false, action = '') {
    return `
      <button class="relic-card rarity-${escapeHtml(relic.rarity)} ${owned ? 'is-owned' : ''}" ${action ? `data-${action}="${escapeHtml(relic.id)}"` : ''} ${owned ? 'disabled' : ''}>
        <span class="relic-icon">${escapeHtml(relic.icon)}</span>
        <span class="relic-copy"><strong>${escapeHtml(relic.name)}</strong><small>${escapeHtml(rarityNames[relic.rarity] || relic.rarity)}</small><p>${escapeHtml(relic.desc)}</p></span>
      </button>`;
  }

  function stars(value) {
    return `<span class="stars" aria-label="${value}星">${[0, 1, 2].map((index) => `<span class="${index < value ? 'is-lit' : ''}">★</span>`).join('')}</span>`;
  }

  function difficulty(value) {
    return `<span class="difficulty-dots" title="难度 ${value}/10">${Array.from({ length: 10 }, (_, index) => `<i class="${index < value ? 'is-filled' : ''}"></i>`).join('')}</span>`;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.round(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  RF.UI = {
    escapeHtml,
    cardTile,
    handCard,
    appHeader,
    relicCard,
    stars,
    difficulty,
    formatDuration,
    typeNames,
    rarityNames,
    factionNames,
    biomeNames,
    biomeIcons
  };
})();
