import {
  CHARMS,
  GRID_SIZE,
  MAX_CHARMS,
  SEASON_COUNT,
  SEASON_NAMES,
  TILES,
  buyItem,
  canBuy,
  deckCards,
  discardCard,
  leaveShop,
  newRun,
  openShop,
  placeCard,
  previewPlacement,
  rerollShop,
  scoreBoard,
  seasonTarget,
  sellCharm,
  type RunState,
  type ShopItem,
  type TileKind,
} from '../engine';
import { loadBest, loadRun, saveBest, saveRun } from './storage';

interface UiState {
  run: RunState;
  selected: number | null;
  info: string | null;
  showDeck: boolean;
  showHelp: boolean;
  lastPlaced: number | null;
  best: number;
}

const fmt = (n: number) => n.toLocaleString('en-US');

function freshSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function seasonsCleared(run: RunState): number {
  if (run.phase === 'won') return SEASON_COUNT;
  if (run.phase === 'lost') return run.season;
  return run.phase === 'placing' ? run.season : run.season + 1;
}

export function mountApp(root: HTMLElement): void {
  const saved = loadRun();
  const ui: UiState = {
    run: saved ?? newRun(freshSeed()),
    selected: null,
    info: null,
    showDeck: false,
    showHelp: !saved,
    lastPlaced: null,
    best: loadBest(),
  };

  function commit(run: RunState): void {
    ui.run = run;
    saveRun(run);
    const cleared = seasonsCleared(run);
    if (cleared > ui.best) {
      ui.best = cleared;
      saveBest(cleared);
    }
  }

  function act(action: string, arg: number): void {
    const run = ui.run;
    switch (action) {
      case 'select':
        ui.selected = ui.selected === arg ? null : arg;
        ui.info = ui.selected === null ? null : tileInfo(run.hand[arg]);
        break;
      case 'place':
        if (ui.selected === null) {
          const tile = run.board[arg];
          ui.info = tile ? tileInfo(tile) : 'Pick a card from your hand, then tap an empty plot.';
          break;
        }
        if (run.board[arg] !== null) {
          ui.info = tileInfo(run.board[arg]!);
          break;
        }
        commit(placeCard(run, ui.selected, arg));
        ui.lastPlaced = arg;
        ui.selected = null;
        ui.info = null;
        break;
      case 'discard':
        if (ui.selected !== null && run.discardsLeft > 0) {
          commit(discardCard(run, ui.selected));
          ui.selected = null;
          ui.info = null;
        }
        break;
      case 'open-shop':
        commit(openShop(run));
        break;
      case 'buy':
        if (canBuy(run, arg)) commit(buyItem(run, arg));
        break;
      case 'reroll':
        if (run.gold >= run.rerollCost) commit(rerollShop(run));
        break;
      case 'sell-charm':
        if (run.phase === 'shop') commit(sellCharm(run, arg));
        else ui.info = charmInfo(run.charms[arg]);
        break;
      case 'leave-shop':
        commit(leaveShop(run));
        ui.lastPlaced = null;
        break;
      case 'new-run':
        commit(newRun(freshSeed()));
        ui.selected = null;
        ui.info = null;
        ui.lastPlaced = null;
        break;
      case 'deck':
        ui.showDeck = !ui.showDeck;
        break;
      case 'help':
        ui.showHelp = !ui.showHelp;
        break;
    }
    render();
  }

  root.addEventListener('click', (event) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el || el.hasAttribute('disabled')) return;
    act(el.dataset.action!, Number(el.dataset.arg ?? -1));
  });

  root.addEventListener('mouseover', (event) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-info]');
    const bar = root.querySelector('.info');
    if (el && bar) bar.textContent = el.dataset.info!;
  });

  function render(): void {
    root.innerHTML = view(ui);
    ui.lastPlaced = null;
  }

  render();
}

function tileInfo(kind: TileKind): string {
  const t = TILES[kind];
  return `${t.icon} ${t.name}: ${t.rule}`;
}

function charmInfo(id: string): string {
  const c = CHARMS[id as keyof typeof CHARMS];
  return `${c.icon} ${c.name}: ${c.rule}`;
}

function view(ui: UiState): string {
  const { run } = ui;
  const score = scoreBoard(run.board, run.charms);
  const target = seasonTarget(run.season);
  const progress = Math.min(100, (score.total / target) * 100);
  const selectedKind = ui.selected !== null ? run.hand[ui.selected] : null;

  const cells = run.board
    .map((tile, i) => {
      if (tile) {
        const y = score.cells[i];
        const badges = [
          y.coins ? `<span class="pill coins">${y.coins}</span>` : '',
          y.joy ? `<span class="pill joy">${y.joy}</span>` : '',
        ].join('');
        const pop = ui.lastPlaced === i ? ' pop' : '';
        return `<button class="cell filled tile-${tile}${pop}" data-action="place" data-arg="${i}" data-info="${attr(tileInfo(tile))}" aria-label="${TILES[tile].name}">
          <span class="icon">${TILES[tile].icon}</span><span class="badges">${badges}</span></button>`;
      }
      let preview = '';
      if (selectedKind && run.phase === 'placing') {
        const gain = previewPlacement(run.board, run.charms, selectedKind, i);
        preview = `<span class="preview ${gain > 0 ? 'up' : 'flat'}">${gain > 0 ? '+' : ''}${fmt(gain)}</span>`;
      }
      return `<button class="cell empty${selectedKind ? ' armed' : ''}" data-action="place" data-arg="${i}" aria-label="Empty plot">${preview}</button>`;
    })
    .join('');

  const hand = run.hand
    .map((kind, i) => {
      const t = TILES[kind];
      return `<button class="card rarity-${t.rarity}${ui.selected === i ? ' selected' : ''}" data-action="select" data-arg="${i}" data-info="${attr(tileInfo(kind))}" ${run.phase !== 'placing' ? 'disabled' : ''}>
        <span class="card-icon">${t.icon}</span><span class="card-name">${t.name}</span><span class="card-rule">${t.rule}</span></button>`;
    })
    .join('');

  const charms = Array.from({ length: MAX_CHARMS }, (_, i) => {
    const id = run.charms[i];
    if (!id) return `<div class="charm empty" title="Empty charm slot"></div>`;
    const c = CHARMS[id];
    const selling = run.phase === 'shop';
    return `<button class="charm${selling ? ' sellable' : ''}" data-action="sell-charm" data-arg="${i}" data-info="${attr(`${c.icon} ${c.name}: ${c.rule}${selling ? ` Tap to sell for ${Math.floor(c.cost / 2)} gold.` : ''}`)}">${c.icon}</button>`;
  }).join('');

  return `
  <main class="game">
    <header class="hud">
      <div class="title-row">
        <h1>Little Hamlet</h1>
        <div class="hud-buttons">
          <button class="ghost" data-action="deck">Deck ${deckCards(run).length}</button>
          <button class="ghost" data-action="help" aria-label="How to play">?</button>
        </div>
      </div>
      <div class="season-row">
        <div><div class="label">${SEASON_NAMES[run.season]}</div><div class="value">Season ${run.season + 1}/${SEASON_COUNT}</div></div>
        <div><div class="label">Goal</div><div class="value">${fmt(target)}</div></div>
        <div><div class="label">Gold</div><div class="value gold">${run.gold}</div></div>
      </div>
      <div class="score-row" data-info="Your village scores coins × joy at the end of each season.">
        <span class="pill coins big">${fmt(score.coins)}</span><span class="times">×</span><span class="pill joy big">${fmt(score.joy)}</span>
        <span class="equals">=</span><span class="total ${score.total >= target ? 'met' : ''}">${fmt(score.total)}</span>
      </div>
      <div class="progress"><div class="bar ${score.total >= target ? 'met' : ''}" style="width:${progress}%"></div></div>
    </header>

    <section class="charms" aria-label="Charms">${charms}</section>

    <section class="board" style="--size:${GRID_SIZE}" aria-label="Village">${cells}</section>

    <div class="info" aria-live="polite">${ui.info ?? (selectedKind ? '' : 'Pick a card, then tap a plot. Numbers show how much your score would change.')}</div>

    <section class="turn-row">
      <span>Builds left: <b>${run.placementsLeft}</b></span>
      <button class="secondary" data-action="discard" ${ui.selected === null || run.discardsLeft === 0 || run.phase !== 'placing' ? 'disabled' : ''}>Swap card (${run.discardsLeft})</button>
    </section>

    <section class="hand" aria-label="Hand">${hand}</section>
  </main>
  ${overlay(ui)}`;
}

function overlay(ui: UiState): string {
  const { run } = ui;
  if (ui.showHelp) return modal(helpView(), 'help', 'Let’s build');
  if (ui.showDeck) return modal(deckView(run), 'deck', 'Close');
  const r = run.lastResult;
  if (run.phase === 'result' && r) {
    return modal(
      `<h2>${SEASON_NAMES[r.season]} complete!</h2>
       ${resultLine(r.score.coins, r.score.joy, r.score.total, r.target)}
       <p class="reward">+${r.goldEarned} gold</p>`,
      'open-shop',
      'Visit the market',
      true,
    );
  }
  if (run.phase === 'lost' && r) {
    return modal(
      `<h2>The village fell short</h2>
       ${resultLine(r.score.coins, r.score.joy, r.score.total, r.target)}
       <p>You cleared ${r.season} of ${SEASON_COUNT} seasons. Best: ${ui.best}.</p>`,
      'new-run',
      'Start a new village',
      true,
    );
  }
  if (run.phase === 'won' && r) {
    return modal(
      `<h2>🎉 Your hamlet thrived all year!</h2>
       ${resultLine(r.score.coins, r.score.joy, r.score.total, r.target)}
       <p>All ${SEASON_COUNT} seasons cleared.</p>`,
      'new-run',
      'Build another village',
      true,
    );
  }
  if (run.phase === 'shop') return shopView(run);
  return '';
}

function resultLine(coins: number, joy: number, total: number, target: number): string {
  return `<div class="result">
    <span class="pill coins big">${fmt(coins)}</span><span class="times">×</span><span class="pill joy big">${fmt(joy)}</span>
    <span class="equals">=</span><span class="total ${total >= target ? 'met' : 'missed'}">${fmt(total)}</span>
  </div><p class="muted">Goal was ${fmt(target)}</p>`;
}

function shopItemView(run: RunState, item: ShopItem, i: number): string {
  const label =
    item.type === 'card'
      ? `<span class="card-icon">${TILES[item.kind].icon}</span><span class="card-name">${TILES[item.kind].name}</span><span class="card-rule">${TILES[item.kind].rule}</span>`
      : `<span class="card-icon">${CHARMS[item.id].icon}</span><span class="card-name">${CHARMS[item.id].name}</span><span class="card-rule">Charm. ${CHARMS[item.id].rule}</span>`;
  const rarity = item.type === 'card' ? TILES[item.kind].rarity : 'charm';
  const status = item.sold ? 'Sold' : `${item.cost} gold`;
  return `<button class="card shop-item rarity-${rarity}${item.sold ? ' sold' : ''}" data-action="buy" data-arg="${i}" ${canBuy(run, i) ? '' : 'disabled'}>
    ${label}<span class="price">${status}</span></button>`;
}

function shopView(run: RunState): string {
  const items = run.shop.map((item, i) => shopItemView(run, item, i)).join('');
  return `<div class="overlay docked"><div class="modal shop">
    <h2>Market day</h2>
    <p class="muted">Cards join your deck. Charms change the rules (max ${MAX_CHARMS}). You have <b class="gold">${run.gold}</b> gold.</p>
    <div class="shop-grid">${items}</div>
    <div class="shop-actions">
      <button class="secondary" data-action="reroll" ${run.gold < run.rerollCost ? 'disabled' : ''}>New stock (${run.rerollCost} gold)</button>
      <button class="primary" data-action="leave-shop">Start ${SEASON_NAMES[run.season + 1]}</button>
    </div>
  </div></div>`;
}

function deckView(run: RunState): string {
  const counts = new Map<TileKind, number>();
  for (const k of deckCards(run)) counts.set(k, (counts.get(k) ?? 0) + 1);
  const rows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `<li><span>${TILES[k].icon} ${TILES[k].name}</span><b>×${n}</b><small>${TILES[k].rule}</small></li>`)
    .join('');
  return `<h2>Your deck</h2><ul class="deck-list">${rows}</ul>`;
}

function helpView(): string {
  return `<h2>Little Hamlet</h2>
  <p>Grow a tiny village through one year. Each season you place <b>3 tiles</b> from your hand.</p>
  <p>At the end of the season the whole village scores <span class="pill coins">coins</span> × <span class="pill joy">joy</span>. Beat the season’s goal to keep going.</p>
  <p>Tiles help their neighbours. Pick a card and every empty plot shows how much it would add.</p>
  <p>Spend gold at the market on new cards and charms. Survive all 8 seasons to win.</p>`;
}

function modal(body: string, action: string, button: string, docked = false): string {
  return `<div class="overlay${docked ? ' docked' : ''}"><div class="modal">${body}<button class="primary" data-action="${action}">${button}</button></div></div>`;
}

function attr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
