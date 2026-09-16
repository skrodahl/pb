import type { InputActions } from '../sim/types';

// Pure, gamepad-swappable mapping: a later GamepadInput satisfies the same
// readActions() interface, so the simulation never knows the device.
export function actionsFromKeys(keys: Set<string>): InputActions {
  return {
    throttle: keys.has('KeyW') || keys.has('ArrowUp'),
    brake: keys.has('KeyS') || keys.has('ArrowDown'),
    steer: ((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)) as -1 | 0 | 1,
    throwHeld: keys.has('Space'),
  };
}

export class KeyboardInput {
  private keys = new Set<string>();
  private consumed = new Set<string>();
  private target: Window | null = null;

  attach(target: Window): void {
    this.target = target;
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.onBlur);
    this.target = null;
  }

  private onDown = (e: KeyboardEvent): void => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    this.keys.add(e.code);
  };
  private onUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };
  private onBlur = (): void => {
    this.keys.clear();
  };

  readActions(): InputActions {
    return actionsFromKeys(this.keys);
  }

  // was this key held down at least once since attach? (used for Enter transitions)
  consumePressed(code: string): boolean {
    if (this.keys.has(code) && !this.consumed.has(code)) {
      this.consumed.add(code);
      return true;
    }
    return false;
  }
}
