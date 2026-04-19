import { describe, it, expect } from 'vitest';
import { resolveMode } from '../src/server/worker/mode';

describe('WORKER_MODE resolver', () => {
  it('defaults to mock', () => expect(resolveMode({})).toBe('mock'));
  it('accepts live', () => expect(resolveMode({ WORKER_MODE: 'live' })).toBe('live'));
  it('accepts dryrun', () => expect(resolveMode({ WORKER_MODE: 'dryrun' })).toBe('dryrun'));
  it('throws on junk', () => expect(() => resolveMode({ WORKER_MODE: 'xyz' })).toThrow());
});
