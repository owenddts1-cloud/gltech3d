import { describe, it, expect } from 'vitest';
import { isPublicPath } from '@/lib/auth/public-paths';

describe('isPublicPath', () => {
  it('allows root and product routes', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/product/xyz-123')).toBe(true);
  });

  it('allows dedicated /produtos route and subpaths', () => {
    expect(isPublicPath('/produtos')).toBe(true);
    expect(isPublicPath('/produtos/')).toBe(true);
    expect(isPublicPath('/produtos/categoria-nicho')).toBe(true);
  });

  it('allows password reset both with slug and query param root', () => {
    expect(isPublicPath('/esqueci-senha')).toBe(true);
    expect(isPublicPath('/redefinir-senha')).toBe(true);
    expect(isPublicPath('/redefinir-senha/some-token-slug')).toBe(true);
  });

  it('blocks private app routes', () => {
    expect(isPublicPath('/app')).toBe(false);
    expect(isPublicPath('/app/dashboard')).toBe(false);
    expect(isPublicPath('/admin')).toBe(false);
  });
});
