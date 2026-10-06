/**
 * Per-screen interactive guides.
 *
 * A guide is pure content: it never reads app state. The registry
 * (`registry.ts`) maps route prefixes to guides and the provider decides when to
 * show them. Keeping content declarative lets the coverage test assert that
 * every navigation entry has its own guide.
 */

export type GuideNoticeKind = "demo" | "integration" | "info";

/** Section of the CRM the guide belongs to. Mirrors the sidebar groups. */
export type GuideGroup =
  | "inicio"
  | "producao"
  | "vendas"
  | "financeiro"
  | "clientes"
  | "suprimentos"
  | "ferramentas"
  | "conta";

export interface GuideStep {
  title: string;
  detail: string;
}

export interface GuideTab {
  name: string;
  detail: string;
}

export interface GuideNotice {
  kind: GuideNoticeKind;
  text: string;
}

export interface GuideAction {
  label: string;
  /** When omitted the action only closes the guide (the button lives on the page). */
  href?: string;
}

export interface GuideEntry {
  id: string;
  /**
   * Route prefixes this guide matches. A pathname matches a prefix when it is
   * equal to it or continues with `/`. The longest matching prefix wins.
   * The welcome guide has no paths: it is never resolved from a route.
   */
  paths: string[];
  group: GuideGroup;
  title: string;
  /** One sentence: the core idea of the screen. */
  idea: string;
  purpose: string[];
  steps: GuideStep[];
  tabs?: GuideTab[];
  /** Heading of the `tabs` list. Defaults to "Abas desta tela". */
  tabsTitle?: string;
  tip?: string;
  notice?: GuideNotice;
  primaryAction?: GuideAction;
  /**
   * `false` = the guide exists (button, guide center) but never opens by itself.
   * Used for screens that redirect or that already carry their own message.
   */
  autoOpen?: boolean;
  /** Link used by the guide center. Defaults to `paths[0]`. */
  href?: string;
}

export const GUIDE_GROUP_LABEL: Record<GuideGroup, string> = {
  inicio: "Início",
  producao: "Produção",
  vendas: "Vendas",
  financeiro: "Financeiro",
  clientes: "Clientes",
  suprimentos: "Suprimentos",
  ferramentas: "Ferramentas",
  conta: "Conta e configurações",
};

/** Display order of the groups (same order as the sidebar). */
export const GUIDE_GROUP_ORDER: GuideGroup[] = [
  "inicio",
  "producao",
  "vendas",
  "financeiro",
  "clientes",
  "suprimentos",
  "ferramentas",
  "conta",
];
