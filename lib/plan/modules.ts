/**
 * Que rotas do CRM exigem plano PRO.
 *
 * ALLOWLIST, NAO BLOCKLIST — e esta e a decisao central do arquivo. Uma lista de
 * "estas rotas sao PRO" falha ABERTA: a rota criada daqui a um ano nasce
 * liberada e ninguem lembra de atualizar a lista. Uma lista de "estas rotas sao
 * livres" falha FECHADA: a rota nova nasce travada, e quem a criar descobre na
 * primeira vez que abrir. `tests/unit/pro-route-coverage.test.ts` mantem isso
 * honesto ao longo do tempo.
 */

export interface ProModule {
  /** Rotulo para a copy (preview da landing, tela de upgrade). */
  readonly label: string;
  /** Prefixo da rota, para casar com o pathname. */
  readonly routePrefix: string;
}

/**
 * Rotas que NUNCA travam. Tudo o mais sob /app exige PRO.
 *
 * `/app/settings` fica livre INTEIRO de proposito: se travasse, o usuario sem
 * plano nao alcancaria a propria tela de upgrade (que mora em
 * /app/settings/billing) nem trocaria a senha — e o gate redirecionaria para uma
 * rota travada, em laco.
 */
export const FREE_ROUTE_PREFIXES = [
  "/app/dashboard",
  "/app/calculator",
  "/app/settings",
] as const;

/**
 * Catalogo dos modulos pagos, para a COPY. Nao e a fonte da autorizacao — quem
 * decide acesso e `requiresProAccess`, que opera por allowlist. Esta lista
 * existe para a landing e a tela de upgrade mostrarem o que esta travado sem
 * importar `CRM_NAV` (que arrastaria ~28 icones Phosphor para o bundle publico
 * e acoplaria pagina de marketing ao shell do CRM).
 */
export const PRO_MODULES: readonly ProModule[] = [
  { label: "Vendas e funil", routePrefix: "/app/sales" },
  { label: "Produtos com custo real", routePrefix: "/app/products" },
  { label: "Projetos", routePrefix: "/app/projects" },
  { label: "Ordens de serviço", routePrefix: "/app/service-orders" },
  { label: "Impressoras e filamentos", routePrefix: "/app/printers" },
  { label: "Modelagem 3D e fatiador", routePrefix: "/app/models" },
  { label: "Dinheiro a receber e a pagar", routePrefix: "/app/control" },
  { label: "Relatórios", routePrefix: "/app/reports" },
  { label: "Inbox de WhatsApp e Instagram", routePrefix: "/app/inbox" },
  { label: "Conexões de canal", routePrefix: "/app/connections" },
  { label: "Contatos", routePrefix: "/app/contacts" },
  { label: "Equipe", routePrefix: "/app/team" },
  { label: "Inventário", routePrefix: "/app/inventory" },
  { label: "Fornecedores", routePrefix: "/app/suppliers" },
  { label: "Consumíveis", routePrefix: "/app/consumables" },
  { label: "Calendário", routePrefix: "/app/calendar" },
  { label: "Agentes de IA", routePrefix: "/app/ai" },
  { label: "Assistente IA", routePrefix: "/app/assistant" },
  { label: "Vitrine pública editável", routePrefix: "/app/landing-edit" },
  { label: "Funil de leads", routePrefix: "/app/pipelines" },
  { label: "Kanban", routePrefix: "/app/kanban" },
  { label: "Integrações", routePrefix: "/app/integrations" },
  { label: "LGPD", routePrefix: "/app/lgpd" },
  { label: "Auditoria", routePrefix: "/app/audit" },
  { label: "Automações (n8n)", routePrefix: "/automations" },
  { label: "Criação de conteúdo", routePrefix: "/content-studio" },
] as const;

/** `/app/sales` casa `/app/sales` e `/app/sales/shopee`, mas nao `/app/salesforce`. */
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Esta rota exige plano PRO?
 *
 * Responde `true` para qualquer caminho sob /app, /automations ou
 * /content-studio que nao esteja na allowlist. Caminho fora dessas areas (uma
 * rota publica, por exemplo) nao e assunto deste gate e responde `false`.
 */
export function requiresProAccess(pathname: string): boolean {
  const isAppSurface =
    matchesPrefix(pathname, "/app") ||
    matchesPrefix(pathname, "/automations") ||
    matchesPrefix(pathname, "/content-studio");
  if (!isAppSurface) return false;

  return !FREE_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

/**
 * O modulo a que um caminho pertence, para a tela de upgrade dizer "voce tentou
 * abrir Vendas" em vez de imprimir o parametro cru da URL.
 *
 * Devolve `null` quando nao reconhece — e o chamador entao nao mostra nada, em
 * vez de ecoar texto de origem externa na tela.
 */
export function proModuleForPath(pathname: string): ProModule | null {
  // Prefixo mais longo primeiro: /app/models/fatiar deve casar Modelagem antes
  // de qualquer prefixo mais curto que tambem sirva.
  const sorted = [...PRO_MODULES].sort((a, b) => b.routePrefix.length - a.routePrefix.length);
  return sorted.find((m) => matchesPrefix(pathname, m.routePrefix)) ?? null;
}
