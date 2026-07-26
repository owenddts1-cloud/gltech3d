import "@/components/documents/document.css";

/**
 * Layout das folhas imprimíveis.
 *
 * Existe como route group irmão de `app/app/` porque no App Router não há como
 * escapar de um layout pai: `app/app/layout.tsx` monta o AppShell com sidebar e
 * topbar, que não podem aparecer no papel. Aqui não há shell, provider nem
 * navegação — só a folha.
 *
 * O `app/layout.tsx` (fontes + script de tema + Toaster) continua envolvendo esta
 * árvore, e tudo bem: a folha declara a própria paleta em `.doc-sheet` e não
 * referencia nenhum token de tema, então o modo escuro não a alcança.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
