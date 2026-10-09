import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/db.js', () => ({ prisma: {} }));

describe('YIRS Revenue API', () => {
  beforeAll(() => { process.env.TON_EXCHANGE_RATE_NGN = '5000'; });
  it('exposes a health endpoint', async () => {
    const { app } = await import('../src/app.js');
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('yirs-revenue-system-api');
  });
});
