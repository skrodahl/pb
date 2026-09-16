import { actionsFromKeys, KeyboardInput } from '../src/input/input';

test('mapping', () => {
  expect(actionsFromKeys(new Set(['KeyW', 'KeyD'])).steer).toBe(1);
  expect(actionsFromKeys(new Set(['KeyA', 'KeyS'])).steer).toBe(-1);
  expect(actionsFromKeys(new Set(['Space'])).throwHeld).toBe(true);
  expect(actionsFromKeys(new Set(['ArrowUp'])).throttle).toBe(true);
  expect(actionsFromKeys(new Set()).brake).toBe(false);
  expect(actionsFromKeys(new Set(['ArrowLeft'])).steer).toBe(-1);
  expect(actionsFromKeys(new Set(['ArrowRight', 'ArrowDown'])).brake).toBe(true);
});

test('consumePressed fires once per press and re-arms on re-press', () => {
  const handlers = new Map<string, EventListener>();
  const fakeWindow = {
    addEventListener: (t: string, h: EventListener) => void handlers.set(t, h),
    removeEventListener: (t: string, h: EventListener) => void handlers.get(t) === h && handlers.delete(t),
  } as unknown as Window;
  const kb = new KeyboardInput();
  kb.attach(fakeWindow);
  const press = () => handlers.get('keydown')!({ code: 'Enter', preventDefault: () => {} } as any);
  const release = () => handlers.get('keyup')!({ code: 'Enter', preventDefault: () => {} } as any);

  expect(kb.consumePressed('Enter')).toBe(false);
  press();
  expect(kb.consumePressed('Enter')).toBe(true);
  expect(kb.consumePressed('Enter')).toBe(false);
  release();
  press();
  expect(kb.consumePressed('Enter')).toBe(true);
});
