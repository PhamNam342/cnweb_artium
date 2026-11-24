/**
 * Bảng định tuyến gateway. Khớp với docs/database/schema-entities.md (mục "Định tuyến qua gateway").
 * Path giữ nguyên khi chuyển tiếp (service cũng dùng prefix /api).
 */
export interface ServiceRoute {
  service: string;
  envKey: string;
  defaultUrl: string;
  prefixes: string[];
}

export const ROUTES: ServiceRoute[] = [
  {
    service: 'identity',
    envKey: 'IDENTITY_URL',
    defaultUrl: 'http://localhost:3001',
    prefixes: ['/api/auth', '/api/users', '/api/sellers'],
  },
  {
    service: 'catalog',
    envKey: 'CATALOG_URL',
    defaultUrl: 'http://localhost:3002',
    prefixes: ['/api/artworks', '/api/folders', '/api/tags'],
  },
  {
    service: 'commerce',
    envKey: 'COMMERCE_URL',
    defaultUrl: 'http://localhost:3003',
    prefixes: [
      '/api/cart',
      '/api/orders',
      '/api/payments',
      '/api/promotions',
      '/api/invoices',
      '/api/payouts',
      '/api/webhooks/payos',
    ],
  },
  {
    service: 'social',
    envKey: 'SOCIAL_URL',
    defaultUrl: 'http://localhost:3004',
    prefixes: [
      '/api/follows',
      '/api/reactions',
      '/api/comments',
      '/api/moments',
      '/api/moodboards',
      '/api/reviews',
      '/api/events',
      '/api/conversations',
      '/api/notifications',
    ],
  },
  {
    service: 'crm',
    envKey: 'CRM_URL',
    defaultUrl: 'http://localhost:3005',
    prefixes: ['/api/crm'],
  },
];

/** Tìm route theo path; khớp đúng prefix hoặc prefix + '/...' (tránh /api/authx khớp /api/auth). */
export function matchRoute(path: string): ServiceRoute | undefined {
  return ROUTES.find((r) =>
    r.prefixes.some(
      (p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`),
    ),
  );
}
