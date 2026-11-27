import { describe, expect, it } from 'vitest';
import { effectiveAvailability } from './availability.js';

const now = new Date('2026-09-11T12:00:00.000Z');
const base = {
  relationshipStatus: 'active' as const,
  mode: 'on_demand' as const,
  presence: 'available' as const,
  now,
  insideScheduledWindow: false,
  assignments: [],
};

describe('effective driver availability', () => {
  it('reports on-demand drivers as available when idle', () => {
    expect(effectiveAvailability(base)).toBe('available');
  });

  it('reports scheduled drivers offline outside delivery windows', () => {
    expect(effectiveAvailability({ ...base, mode: 'scheduled' })).toBe('offline');
  });

  it('reports accepted unplanned on-demand work as busy', () => {
    expect(effectiveAvailability({
      ...base,
      assignments: [{ fulfillmentStatus: 'accepted', plannedStartAt: null, plannedEndAt: null }],
    })).toBe('busy');
  });

  it('reports planned work busy only inside its UTC interval', () => {
    const assignment = {
      fulfillmentStatus: 'accepted' as const,
      plannedStartAt: new Date('2026-09-11T11:00:00.000Z'),
      plannedEndAt: new Date('2026-09-11T13:00:00.000Z'),
    };
    expect(effectiveAvailability({ ...base, assignments: [assignment] })).toBe('busy');
    expect(effectiveAvailability({ ...base, now: new Date('2026-09-11T13:00:00.000Z'), assignments: [assignment] })).toBe('available');
  });

  it('offline presence wins over work and schedule', () => {
    expect(effectiveAvailability({ ...base, presence: 'offline', insideScheduledWindow: true })).toBe('offline');
  });
});
