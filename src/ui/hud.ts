export interface Hud {
  setClock(totalMin: number): void;
  setNet(net: number): void;
  setPapers(held: number): void;
  setNext(label: string | null): void;
  setCharge(frac: number): void;
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
      <div class="hud-line"><span class="hud-label">MONEY</span> <span data-k="money">$0</span></div>
      <div class="hud-line"><span class="hud-label">PAPERS</span> <span data-k="papers">16</span></div>
    </div>
    <div class="hud-tr" data-k="next"></div>
    <div class="charge"><div class="charge-fill" data-k="charge"></div></div>
  `;
  root.appendChild(wrap);
  const q = (k: string) => wrap.querySelector(`[data-k="${k}"]`) as HTMLElement;
  return {
    setClock(totalMin: number) {
      q('clock').textContent = minToTime(totalMin);
    },
    setNet(net: number) {
      q('money').textContent = `${net >= 0 ? '+' : '-'}$${Math.abs(net).toFixed(0)}`;
    },
    setPapers(held: number) {
      q('papers').textContent = String(held);
    },
    setNext(label: string | null) {
      q('next').textContent = label ? `NEXT  ${label}` : '';
    },
    setCharge(frac: number) {
      const fill = q('charge');
      fill.style.width = `${Math.round(frac * 100)}%`;
      fill.style.opacity = frac > 0 ? '1' : '0';
    },
    setEnabled(on: boolean) {
      wrap.style.display = on ? 'block' : 'none';
    },
  };
}
