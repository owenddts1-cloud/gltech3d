import { describe, expect, it } from 'vitest';
import { reorderProductsSchema } from './landing-edit';

describe('reorderProductsSchema', () => {
  it('valida array de UUIDs válidos', () => {
    const valid = {
      orderedIds: [
        '6e614f14-ae3a-4b86-9ea0-128d3a7950bf',
        'a1b2c3d4-e5f6-4a5b-8c7d-9e8f7a6b5c4d',
      ],
    };
    const res = reorderProductsSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it('rejeita array vazio', () => {
    const empty = { orderedIds: [] };
    const res = reorderProductsSchema.safeParse(empty);
    expect(res.success).toBe(false);
  });

  it('rejeita strings que não são UUID', () => {
    const invalid = { orderedIds: ['not-a-uuid'] };
    const res = reorderProductsSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });
});
