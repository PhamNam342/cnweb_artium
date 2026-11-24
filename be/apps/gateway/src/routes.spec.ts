import { matchRoute } from './routes';

describe('gateway matchRoute', () => {
  it('định tuyến đúng service theo prefix', () => {
    expect(matchRoute('/api/auth/login')?.service).toBe('identity');
    expect(matchRoute('/api/sellers/abc')?.service).toBe('identity');
    expect(matchRoute('/api/webhooks/payos')?.service).toBe('commerce');
    expect(matchRoute('/api/crm/contacts')?.service).toBe('crm');
    expect(matchRoute('/api/events')?.service).toBe('social');
  });

  it('không khớp prefix một phần', () => {
    expect(matchRoute('/api/authx')).toBeUndefined();
    expect(matchRoute('/api/unknown')).toBeUndefined();
  });
});
