import { describe, it, expect } from 'vitest';
import { FALLBACK_FILAMENTS } from '@/lib/filament-catalog/fallback-filaments';

describe('FALLBACK_FILAMENTS', () => {
  it('provides comprehensive demonstration filaments', () => {
    expect(FALLBACK_FILAMENTS.length).toBeGreaterThanOrEqual(6);
  });

  it('contains valid PublicFilament structure with non-empty fields', () => {
    FALLBACK_FILAMENTS.forEach((item) => {
      expect(item.id).toBeTruthy();
      expect(item.slug).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.materialName).toBeTruthy();
      expect(item.priceCents).toBeGreaterThan(0);
      expect(item.diameterMm).toBe(1.75);
      expect(item.orderable).toBe(true);
      expect(item.colorHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});
