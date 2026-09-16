import { actionsFromKeys } from '../src/input/input';

test('mapping', () => {
  expect(actionsFromKeys(new Set(['KeyW', 'KeyD'])).steer).toBe(1);
  expect(actionsFromKeys(new Set(['KeyA', 'KeyS'])).steer).toBe(-1);
  expect(actionsFromKeys(new Set(['Space'])).throwHeld).toBe(true);
  expect(actionsFromKeys(new Set(['ArrowUp'])).throttle).toBe(true);
  expect(actionsFromKeys(new Set()).brake).toBe(false);
  expect(actionsFromKeys(new Set(['ArrowLeft'])).steer).toBe(-1);
  expect(actionsFromKeys(new Set(['ArrowRight', 'ArrowDown'])).brake).toBe(true);
});
