import { Great_Vibes, Montserrat } from "next/font/google";

/**
 * Tipografia exclusiva da folha impressa.
 *
 * Fica aqui, e não no layout raiz, para que as duas famílias não pesem em toda
 * página do CRM — só quem renderiza um documento carrega. As variáveis são
 * aplicadas no próprio elemento `.doc-sheet` (ver `DocumentSheet`), o que também
 * torna a folha autossuficiente: ela mantém a tipografia em qualquer árvore onde
 * for montada, sem depender de o `<html>` ter as classes certas.
 *
 * O corpo do texto segue em Atkinson Hyperlegible (`--font-atkinson`, definida no
 * layout raiz), que é desenhada para legibilidade — o que importa num documento
 * lido em 9pt.
 */
export const documentDisplay = Montserrat({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-montserrat",
});

/** Só a linha de agradecimento do rodapé. */
export const documentScript = Great_Vibes({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-handwriting",
});

/** Classes a aplicar no elemento raiz da folha. */
export const documentFontClassName = `${documentDisplay.variable} ${documentScript.variable}`;
