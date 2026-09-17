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
       <div>A / D &nbsp; steer</div>
       <div>SPACE (tap) &nbsp; sideways throw at the next house</div>
     </div>
     <div class="title-sub">line up with the house, tap the throw, bank the points.</div>
     <div class="title-sub dim">stop mailboxes are your bonus. rain is coming.</div>`,
    'PRESS ENTER TO START',
  );
}

export function showBriefing(root: HTMLElement, cfg: DayConfig): void {
  const start = cfg.time.start;
  const subs = cfg.houses.filter((h) => h.role === 'sub');
  const stopped = cfg.houses.filter((h) => h.role === 'stopped');
  const row = (h: (typeof subs)[number], cls: string, tag: string) => {
    const t0 = minToTime(start + h.window[0]);
    const t1 = minToTime(start + h.window[1]);
    return `<tr><td>${h.customer} <span class="dim">${h.pos[0] < 0 ? 'LEFT' : 'RIGHT'}</span></td><td>${t0}–${t1}</td><td class="${cls}">${tag}</td></tr>`;
  };
  const rows = [
    ...subs.map((h) => row(h, 'sub', 'SUB')),
    ...stopped.map((h) => `<tr><td>${h.customer} <span class="dim">${h.pos[0] < 0 ? 'LEFT' : 'RIGHT'}</span></td><td>—</td><td class="nsub">STOPPED</td></tr>`),
  ].join('');
  // route strip: the street top-to-bottom, colored by role
  const strip = cfg.houses
    .map(
      (h) =>
        `<div class="route-house ${h.role}" title="${h.customer}"></div>`,
    )
    .join('');
  card(
    root,
    'PB DAILY — ' + cfg.name.toUpperCase(),
    `Deliver every <b>subscriber</b> paper inside its window: line up with the house, tap the
     throw, the paper flies sideways. Throwing early (perfectly parallel) pays more.
     Smashing a <span class="nsub">STOPPED</span> mailbox's window pays 200. Watch the road:
     crossing cars, skaters, RC cars — and don't stop pedaling.
     Paper stacks on the curbs restock your rack — a full rack leaves them in place,
     so grab them once you've thrown a few.
     <div class="route-strip">${strip}</div>
     <table class="sched">${rows}</table>`,
    'PRESS ENTER TO RIDE',
  );
}

export function showTally(root: HTMLElement, tally: Tally): void {
  const lines: [string, string | number][] = [
    ['Clean', tally.clean],
    ['Late', tally.late],
    ['Smashed', tally.smashed],
    ['Missed', tally.missed],
    ['Papers lost', tally.lost],
  ];
  const rank =
    tally.score >= 2000 ? 'S' : tally.score >= 1400 ? 'A' : tally.score >= 800 ? 'B' : 'C';
  card(
    root,
    'END OF DAY',
    `<table class="tally">${lines
      .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
      .join('')}</table>
     <div class="money"><span>score</span><b>${tally.score}</b></div>
     <div class="rank">${rank}</div>`,
    'PRESS ENTER TO RIDE AGAIN',
  );
}
