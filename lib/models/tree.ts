/**
 * Utilitários puros da árvore de pastas. Sem I/O — testáveis, e é aqui que mora
 * a regra anti-ciclo (mover uma pasta para dentro de si mesma ou de um
 * descendente corromperia a árvore).
 */

export interface FolderNodeLite {
  id: string;
  parentId: string | null;
}

/**
 * `true` se `candidateParentId` é o próprio nó ou um descendente de `folderId`.
 * Usar antes de mover: se retornar true, o move é inválido (criaria ciclo).
 */
export function wouldCreateCycle(
  folders: FolderNodeLite[],
  folderId: string,
  candidateParentId: string | null,
): boolean {
  if (candidateParentId === null) return false; // mover para a raiz é sempre válido
  if (candidateParentId === folderId) return true; // dentro de si mesmo

  const byId = new Map(folders.map((f) => [f.id, f]));
  // Sobe a partir do novo pai; se cruzar o próprio folderId, é descendente dele.
  let cursor: string | null = candidateParentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === folderId) return true;
    if (seen.has(cursor)) break; // proteção contra dado já corrompido
    seen.add(cursor);
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return false;
}

/** IDs de todos os descendentes de `folderId` (não inclui ele mesmo). */
export function descendantIds(folders: FolderNodeLite[], folderId: string): string[] {
  const childrenOf = new Map<string | null, string[]>();
  for (const f of folders) {
    const list = childrenOf.get(f.parentId) ?? [];
    list.push(f.id);
    childrenOf.set(f.parentId, list);
  }
  const out: string[] = [];
  const stack = [...(childrenOf.get(folderId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return out;
}
