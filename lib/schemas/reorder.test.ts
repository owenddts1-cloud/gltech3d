import { describe, expect, it } from 'vitest';
import { reorderProductsSchema } from './landing-edit';

/**
 * Contrato da reordenação da vitrine.
 *
 * Mudou de `{ orderedIds }` para `{ writes: [{ id, sortOrder }] }`: a versão
 * anterior mandava a lista inteira e o servidor renumerava tudo a cada arraste —
 * 18 UPDATEs por gesto, e uma falha no meio deixava a vitrine com metade da
 * ordem nova. Com índice fracionário, o arraste comum manda UMA linha.
 */

const UUID_A = '6e614f14-ae3a-4b86-9ea0-128d3a7950bf';
const UUID_B = 'a1b2c3d4-e5f6-4a5b-8c7d-9e8f7a6b5c4d';

describe('reorderProductsSchema', () => {
  it('aceita a escrita única do arraste comum', () => {
    const res = reorderProductsSchema.safeParse({ writes: [{ id: UUID_A, sortOrder: 1500 }] });
    expect(res.success).toBe(true);
  });

  it('aceita posição fracionária — é o ponto do índice fracionário', () => {
    // 1500.5 entre 1000 e 2000 sem tocar nos vizinhos. Se o schema exigisse
    // inteiro, cada arraste voltaria a precisar renumerar a lista.
    const res = reorderProductsSchema.safeParse({ writes: [{ id: UUID_A, sortOrder: 1500.5 }] });
    expect(res.success).toBe(true);
  });

  it('aceita a lista maior da renumeração', () => {
    const res = reorderProductsSchema.safeParse({
      writes: [
        { id: UUID_A, sortOrder: 1000 },
        { id: UUID_B, sortOrder: 2000 },
      ],
    });
    expect(res.success).toBe(true);
  });

  it('aceita posição negativa (mover para antes da primeira peça)', () => {
    // midpoint(null, 1000) devolve 0 e, num segundo movimento, valor negativo.
    const res = reorderProductsSchema.safeParse({ writes: [{ id: UUID_A, sortOrder: -1000 }] });
    expect(res.success).toBe(true);
  });

  it('rejeita array vazio', () => {
    expect(reorderProductsSchema.safeParse({ writes: [] }).success).toBe(false);
  });

  it('rejeita id que não é UUID', () => {
    expect(
      reorderProductsSchema.safeParse({ writes: [{ id: 'not-a-uuid', sortOrder: 1 }] }).success,
    ).toBe(false);
  });

  it('rejeita NaN e Infinity — corromperiam a coluna numeric', () => {
    // `reorder()` renumera em vez de devolver NaN, mas o schema é a fronteira e
    // não pode confiar no cliente.
    for (const sortOrder of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(
        reorderProductsSchema.safeParse({ writes: [{ id: UUID_A, sortOrder }] }).success,
        `deveria recusar ${sortOrder}`,
      ).toBe(false);
    }
  });

  it('rejeita sortOrder ausente ou não numérico', () => {
    expect(reorderProductsSchema.safeParse({ writes: [{ id: UUID_A }] }).success).toBe(false);
    expect(
      reorderProductsSchema.safeParse({ writes: [{ id: UUID_A, sortOrder: 'abc' }] }).success,
    ).toBe(false);
  });

  it('rejeita o contrato antigo', () => {
    // Se um caller esquecido mandar `orderedIds`, tem de falhar alto em vez de
    // gravar nada e reportar sucesso.
    expect(reorderProductsSchema.safeParse({ orderedIds: [UUID_A] }).success).toBe(false);
  });
});
