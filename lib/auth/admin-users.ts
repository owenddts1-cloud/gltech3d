/**
 * Busca de usuário no Auth por e-mail, via service role.
 *
 * Vivia privado em `app/actions/pro/activateAccount.ts`. Foi extraído quando o
 * auto-cadastro e a aprovação de pedidos PRO passaram a precisar da mesma
 * resposta — e errar isso tem consequência cara: se a busca devolver `null` para
 * um e-mail que existe, a aprovação cria uma SEGUNDA organização e o comprador
 * entra num tenant vazio achando que perdeu os dados.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Teto do SDK por página. */
const PER_PAGE = 1000;
/** Para não varrer indefinidamente se a API devolver algo inesperado. */
const MAX_PAGES = 50;

/**
 * Devolve o id do usuário com este e-mail, ou `null`.
 *
 * O SDK do Supabase não expõe busca por e-mail — `listUsers` paginado é o único
 * caminho. A versão anterior lia só a página 1: acima de 1000 usuários ela
 * passaria a responder "não existe" para contas reais, em silêncio e sem erro.
 * O laço abaixo existe por isso.
 */
export async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error || !data) return null;

    const found = data.users.find((u) => (u.email ?? "").trim().toLowerCase() === target);
    if (found) return found.id;

    // Página incompleta significa que era a última.
    if (data.users.length < PER_PAGE) return null;
  }

  return null;
}

/**
 * E-mails de um conjunto de usuários, por id. Ids sem conta ficam fora do mapa.
 *
 * O SDK não tem busca em lote por id; `getUserById` em paralelo, limitado a
 * lotes de `CONCURRENCY`, é o que não varre a base inteira de usuários (que é o
 * que `listUsers` faria). Quem chama passa no máximo uma página de ids.
 */
const CONCURRENCY = 10;

export async function emailsByUserIds(
  admin: SupabaseClient,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  const out = new Map<string, string>();
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (id) => {
        const { data, error } = await admin.auth.admin.getUserById(id);
        return { id, email: error ? null : (data.user?.email ?? null) };
      }),
    );
    for (const r of results) if (r.email) out.set(r.id, r.email);
  }
  return out;
}
