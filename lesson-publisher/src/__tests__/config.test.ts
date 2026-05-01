import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('parses valid environment variables', async () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/lp_test';
    process.env.AHASLIDES_CORE_URL = 'https://api.ahaslides.com';
    process.env.AHASLIDES_OAUTH_CLIENT_ID = 'lesson-publisher';
    process.env.AHASLIDES_OAUTH_CLIENT_SECRET = 'secret123';
    process.env.LEARNER_JWT_SECRET = 'a-secret-that-is-at-least-32-characters-long';

    // Dynamic import to pick up the env
    const { loadConfig } = await import('../config.js');
    const config = loadConfig();

    expect(config.PORT).toBe(3001); // default
    expect(['development', 'test', 'production']).toContain(config.NODE_ENV);
    expect(config.DATABASE_URL).toBe('postgres://localhost:5432/lp_test');
    expect(config.AHASLIDES_CORE_URL).toBe('https://api.ahaslides.com');
  });

  it('uses custom port when provided', async () => {
    process.env.PORT = '4000';
    process.env.DATABASE_URL = 'postgres://localhost:5432/lp_test';
    process.env.AHASLIDES_CORE_URL = 'https://api.ahaslides.com';
    process.env.AHASLIDES_OAUTH_CLIENT_ID = 'lp';
    process.env.AHASLIDES_OAUTH_CLIENT_SECRET = 'secret';
    process.env.LEARNER_JWT_SECRET = 'a-secret-that-is-at-least-32-characters-long';

    const { loadConfig } = await import('../config.js');
    const config = loadConfig();

    expect(config.PORT).toBe(4000);
  });
});
