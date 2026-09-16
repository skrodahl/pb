export class FixedLoop {
  private acc = 0;
  constructor(
    private readonly step: number,
    private readonly maxFrame: number,
  ) {}
  frame(dt: number, fn: (sdt: number) => void): void {
    this.acc += Math.min(dt, this.maxFrame);
    while (this.acc >= this.step - 1e-9) {
      fn(this.step);
      this.acc -= this.step;
    }
  }
}
