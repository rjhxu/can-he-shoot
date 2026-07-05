import { afterEach, describe, expect, it } from 'vitest';
import { checkRateLimit, resetRateLimitStore } from '@/lib/rateLimit';

describe('checkRateLimit', () => {
  afterEach(() => {
    resetRateLimitStore();
  });

  it('allows requests under the limit', () => {
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit('1.2.3.4').allowed).toBe(true);
    }
  });

  it('blocks requests over the limit', () => {
    for (let i = 0; i < 20; i++) {
      checkRateLimit('1.2.3.4');
    }
    const blocked = checkRateLimit('1.2.3.4');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('tracks IPs independently', () => {
    for (let i = 0; i < 20; i++) {
      checkRateLimit('1.2.3.4');
    }
    expect(checkRateLimit('5.6.7.8').allowed).toBe(true);
  });
});
