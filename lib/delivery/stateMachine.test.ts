import { describe, expect, it } from 'vitest';
import { DeliveryError } from './errors.js';
import { transitionFulfillment } from './stateMachine.js';

describe('delivery fulfillment state machine', () => {
  it('supports the accepted delivery path', () => {
    const pickedUp = transitionFulfillment('accepted', 'pick_up');
    const inTransit = transitionFulfillment(pickedUp, 'start_transit');
    expect(transitionFulfillment(inTransit, 'deliver')).toBe('delivered');
  });

  it.each([
    ['accepted', 'fail', 'failed'],
    ['picked_up', 'unable_to_deliver', 'unable_to_deliver'],
    ['in_transit', 'fail', 'failed'],
  ] as const)('supports %s -> %s', (from, action, to) => {
    expect(transitionFulfillment(from, action)).toBe(to);
  });

  it.each([
    ['assigned', 'pick_up'],
    ['accepted', 'deliver'],
    ['delivered', 'fail'],
    ['cancelled', 'pick_up'],
  ] as const)('rejects invalid/terminal transition %s -> %s', (from, action) => {
    expect(() => transitionFulfillment(from, action)).toThrowError(DeliveryError);
  });
});
