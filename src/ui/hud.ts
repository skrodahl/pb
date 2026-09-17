export interface Hud {
  setClock(totalMin: number): void;
  setScore(score: number): void;
  setPapers(held: number): void;
  setNext(label: string | null): void;
  setEnabled(on: boolean): void;
}

export function minToTime(totalMin: number): string {
  const m = Math.floor(totalMin);
  const hh = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function createHud(root: HTMLElement): Hud {
  const wrap = document.createElement('div');
  wrap.className = 'hud';
  wrap.innerHTML = `
    <div class="hud-tl">
      <div class="hud-line"><span class="hud-label">TIME</span> <span data-k="clock">07:00</span></div>
      <div class="hud-line"><span class="hud-label">SCORE</span> <span data-k="score">0</span></div>
      <div class="hud-line"><span class="hud-label">PAPERS</span> <span data-k="papers">10</span></div>
    </div>
    <div class="hud-tr" data-k="next"></div>
  `;
  root.appendChild(wrap);
  const q = (k: string) => wrap.querySelector(`[data-k="${k}"]`) as HTMLElement;
  return {
    setClock(totalMin: number) {
      q('clock').textContent = minToTime(totalMin);
    },
    setScore(score: number) {
      q('score').textContent = String(score);
    },
    setPapers(held: number) {
      q('papers').textContent = String(held);
    },
    setNext(label: string | null) {
      q('next').textContent = label ?? '';
    },
    setEnabled(on: boolean) {
      wrap.style.display = on ? 'block' : 'none';
    },
  };
}
