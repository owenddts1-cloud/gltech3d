import { headers } from "next/headers";
import { requirePro } from "@/lib/plan/server";

/**
 * O gate de plano. Um arquivo, 25 módulos.
 *
 * Route group `(pro)` NÃO altera URL: `/app/sales` continua `/app/sales`.
 * Nenhum link, `revalidatePath`, bookmark ou teste e2e muda — só a árvore de
 * layouts ganha um nível que roda `requirePro()` antes de qualquer página PRO
 * renderizar.
 *
 * POR QUE AQUI, e não nas alternativas:
 *  - no `middleware`: ele não conhece org nem plano, e resolver isso no edge
 *    significaria query de banco em todo request;
 *  - num helper dentro dos ~25 `requireCtx()`: 25 lugares para esquecer, e toda
 *    server action nova nasceria sem gate;
 *  - em `app/app/layout.tsx` lendo `x-pathname`: o Next não re-renderiza o
 *    layout pai em navegação client-side, só o segmento novo — o gate vazaria em
 *    toda navegação soft.
 *
 * LIMITE HONESTO: depois que este layout monta, navegar ENTRE rotas PRO na mesma
 * sessão não o re-executa (o segmento compartilhado já está montado). A janela
 * fecha em qualquer full load ou `router.refresh()`. A defesa complementar é
 * `requirePro()` nas server actions que escrevem.
 *
 * A tela de upgrade vive em `/app/settings/billing`, deliberadamente FORA deste
 * group — se estivesse dentro, o redirect cairia em laço.
 */
export default async function ProLayout({ children }: { children: React.ReactNode }) {
  // `x-pathname` é gravado pelo middleware. Serve só para a tela de upgrade
  // dizer QUAL módulo foi bloqueado; a decisão de acesso não depende dele.
  const pathname = (await headers()).get("x-pathname") ?? undefined;
  await requirePro(pathname);
  return <>{children}</>;
}
