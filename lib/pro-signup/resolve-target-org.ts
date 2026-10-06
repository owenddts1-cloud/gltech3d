/**
 * A quem o pagamento aprovado deve dar PRO: a uma org que já existe, ou a uma
 * nova?
 *
 * Antes desta função a aprovação SEMPRE criava tenant. Quem fez o trial de 7
 * dias e depois pagou ganharia uma SEGUNDA organização — vazia — enquanto os
 * dados dele ficariam na primeira, expirada. O sintoma para o cliente é "paguei
 * e perdi tudo".
 *
 * Função pura de propósito: é a lógica mais fácil de errar da entrega, e assim
 * dá para testá-la sem banco.
 */

export interface Membership {
  organizationId: string;
  organizationName: string;
}

export interface ResolveTargetInput {
  /** `organization_id` gravado no pedido (pedidos feitos de dentro do CRM). */
  requestOrgId: string | null;
  /** Usuário com este e-mail, se existir. */
  existingUserId: string | null;
  /** Memberships ATIVAS desse usuário. */
  memberships: readonly Membership[];
  /** Org escolhida pelo admin ao desempatar um caso ambíguo. */
  chosenOrgId?: string | null;
}

export type ResolveTargetResult =
  /** Dar PRO a uma org existente. */
  | { mode: "upgrade"; organizationId: string; userId: string | null }
  /** Criar tenant; `userId` não-nulo significa que a conta já existe. */
  | { mode: "create"; userId: string | null }
  /** Mais de uma candidata: o admin precisa escolher. NÃO adivinhar. */
  | { mode: "ambiguous"; candidates: readonly Membership[]; userId: string };

export function resolveTargetOrg(input: ResolveTargetInput): ResolveTargetResult {
  // 1. O pedido já diz a qual org pertence (nasceu dentro do CRM). É a fonte
  //    mais confiável — veio da sessão de quem pediu.
  if (input.requestOrgId) {
    return { mode: "upgrade", organizationId: input.requestOrgId, userId: input.existingUserId };
  }

  // 2. Não há usuário com este e-mail: comprador novo.
  if (!input.existingUserId) {
    return { mode: "create", userId: null };
  }

  const active = input.memberships;

  // 2c. Conta existe mas não pertence a org nenhuma.
  if (active.length === 0) {
    return { mode: "create", userId: input.existingUserId };
  }

  // 2a. Uma só: sem ambiguidade.
  if (active.length === 1) {
    return { mode: "upgrade", organizationId: active[0]!.organizationId, userId: input.existingUserId };
  }

  // O admin desempatou — mas a escolha tem de estar entre as candidatas, senão
  // o corpo da requisição estaria escolhendo a org, que é justamente o que a
  // doutrina de multi-tenancy proíbe.
  if (input.chosenOrgId && active.some((m) => m.organizationId === input.chosenOrgId)) {
    return { mode: "upgrade", organizationId: input.chosenOrgId, userId: input.existingUserId };
  }

  // 2b. Várias: não adivinhar. Escolher errado dá PRO para a org errada e deixa
  //     o cliente sem acesso onde ele trabalha.
  return { mode: "ambiguous", candidates: active, userId: input.existingUserId };
}
