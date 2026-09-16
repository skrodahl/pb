import type { DayConfig, Tally } from '../sim/types';
import { minToTime } from './hud';

function card(root: HTMLElement, title: string, body: string, hint: string): void {
  root.innerHTML = '';
  const c = document.createElement('div');
  c.className = 'card';
  const t = document.createElement('div');
  t.className = 'card-title';
  t.textContent = title;
  const b = document.createElement('div');
  b.className = 'card-body';
  b.innerHTML = body;
  const h = document.createElement('div');
  h.className = 'card-hint';
  h.textContent = hint;
  c.append(t, b, h);
  root.appendChild(c);
}

export function showTitle(root: HTMLElement): void {
  card(
    root,
    'P B',
    `<div class="title-sub">a paperboy-inspired 3D delivery game</div>
     <div class="controls">
       <div>W / S &nbsp; pedal &middot; brake</div>
       <div>A / D &nbsp; lean left &middot; right</div>
       <div>SPACE (hold) &nbsp; aim &middot; release to throw</div>
     </div>
     <div class="title-sub">deliver to every subscriber before their window closes.</div>
     <div class="title-sub dim">rain is coming.</div>`,
    'PRESS ENTER TO START',
  );
}

export function showBriefing(root: HTMLElement, cfg: DayConfig): void {
  const start = cfg.time.start;
  const rows = cfg.houses
    .map((h) => {
      const t0 = minToTime(start + h.window[0]);
      const t1 = minToTime(start + h.window[1]);
      const sub = h.subscribes ? 'SUB' : 'NO SUB';
      const cls = h.subscribes ? 'sub' : 'nsub';
      return `<tr><td>${h.customer}</td><td>${t0}–${t1}</td><td class="${cls}">${sub}</td></tr>`;
    })
    .join('');
  card(
    root,
    'PB DAILY — ' + cfg.name.toUpperCase(),
    `Deliver every paper to its <b>subscriber</b> inside the window. Papers thrown at a
     house with <span class="nsub">NO SUB</span> cost you. Rain later today makes papers wet.
     <table class="sched">${rows}</table>`,
    'PRESS ENTER TO RIDE',
  );
}

export function showTally(root: HTMLElement, tally: Tally): void {
  const lines: [string, string | number][] = [
    ['Clean', tally.clean],
    ['Late', tally.late],
    ['Wrong house', tally.wrong],
    ['Missed', tally.missed],
    ['Papers lost', tally.lost],
    ['Hit by paper', tally.hits],
  ];
  card(
    root,
    'END OF DAY',
    `<table class="tally">${lines
      .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
      .join('')}</table>
     <div class="money"><span>earned</span><b>+$${tally.earned.toFixed(2)}</b></div>
     <div class="money"><span>fines</span><b>-$${tally.fined.toFixed(2)}</b></div>
     <div class="money net"><span>net</span><b>${tally.net >= 0 ? '+' : '-'}$${Math.abs(tally.net).toFixed(2)}</b></div>`,
    'PRESS ENTER TO RIDE AGAIN',
  );
}
