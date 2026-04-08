import { describe, it, expect, vi } from 'vitest';

// Mock logger to avoid file system issues
vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

import { ResponseFormatter } from '../../utils/responseFormatter.js';

describe('ResponseFormatter', () => {
  const formatter = new ResponseFormatter();

  describe('success()', () => {
    it('returns correct structure', () => {
      const result = formatter.success({ id: 1 }, 'OK');
      expect(result.success).toBe(true);
      expect(result.message).toBe('OK');
      expect(result.data.id).toBe(1);
      expect(result.meta.timestamp).toBeDefined();
      expect(result.meta.version).toBe('1.0.0');
    });

    it('defaults', () => {
      const result = formatter.success();
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.message).toBe('Success');
    });
  });

  describe('error()', () => {
    it('returns correct structure and status code', () => {
      const { response, statusCode } = formatter.error('Bad', 'BAD_REQUEST', null, 400);
      expect(response.success).toBe(false);
      expect(response.error.message).toBe('Bad');
      expect(response.error.code).toBe('BAD_REQUEST');
      expect(statusCode).toBe(400);
    });

    it('defaults to 500', () => {
      const { statusCode } = formatter.error();
      expect(statusCode).toBe(500);
    });

    it('includes details when provided', () => {
      const { response } = formatter.error('Err', 'ERR', { extra: true });
      expect(response.error.details.extra).toBe(true);
    });
  });

  describe('notFound()', () => {
    it('returns 404', () => {
      const { statusCode } = formatter.notFound('Tenant', 5);
      expect(statusCode).toBe(404);
    });

    it('includes resource name and id in message', () => {
      const { response } = formatter.notFound('Tenant', 5);
      expect(response.error.message).toContain('Tenant');
      expect(response.error.message).toContain('5');
    });

    it('works without id', () => {
      const { response } = formatter.notFound('Property');
      expect(response.error.message).toBe('Property not found');
    });
  });

  describe('paginated()', () => {
    it('calculates pages correctly', () => {
      const result = formatter.paginated([1, 2, 3], { page: 1, limit: 10, total: 25 });
      expect(result.meta.pagination.pages).toBe(3);
      expect(result.meta.pagination.total).toBe(25);
    });

    it('defaults to page 1, limit 10', () => {
      const result = formatter.paginated([], {});
      expect(result.meta.pagination.page).toBe(1);
      expect(result.meta.pagination.limit).toBe(10);
    });
  });

  describe('list()', () => {
    it('auto-counts items', () => {
      const result = formatter.list([1, 2, 3]);
      expect(result.meta.count).toBe(3);
    });

    it('uses explicit count when provided', () => {
      const result = formatter.list([1, 2], 50);
      expect(result.meta.count).toBe(50);
    });
  });

  describe('created()', () => {
    it('returns 201', () => {
      const { statusCode } = formatter.created({ id: 1 });
      expect(statusCode).toBe(201);
    });

    it('wraps data in success response', () => {
      const { response } = formatter.created({ id: 1 });
      expect(response.success).toBe(true);
      expect(response.data.id).toBe(1);
    });
  });

  describe('Other status codes', () => {
    it('unauthorized returns 401', () => {
      const { statusCode } = formatter.unauthorized();
      expect(statusCode).toBe(401);
    });

    it('forbidden returns 403', () => {
      const { statusCode } = formatter.forbidden();
      expect(statusCode).toBe(403);
    });

    it('conflict returns 409', () => {
      const { statusCode } = formatter.conflict();
      expect(statusCode).toBe(409);
    });

    it('rateLimit returns 429', () => {
      const { statusCode } = formatter.rateLimit();
      expect(statusCode).toBe(429);
    });

    it('serviceUnavailable returns 503', () => {
      const { statusCode } = formatter.serviceUnavailable();
      expect(statusCode).toBe(503);
    });
  });

  describe('deleted()', () => {
    it('returns success with null data', () => {
      const result = formatter.deleted();
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('includes deleted_id in meta when provided', () => {
      const result = formatter.deleted('Deleted', 42);
      expect(result.meta.deleted_id).toBe(42);
    });
  });
});
