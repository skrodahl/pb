import type { DayConfig, SimEvent } from './types';

export class WeatherSim {
  raining = false;
  wind: [number, number];

  constructor(private cfg: DayConfig['weather']) {
    this.wind = [...cfg.windBefore];
  }

  step(clockMin: number, addEvent: (e: SimEvent) => void): void {
    if (!this.raining && clockMin >= this.cfg.rainAfter) {
      this.raining = true;
      this.wind = [...this.cfg.windRain];
      addEvent({ type: 'rain_start' });
    }
  }
}
