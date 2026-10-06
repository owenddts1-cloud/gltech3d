/**
 * Dados de pagamento por Pix, resolvidos uma vez.
 *
 * Viviam lidos de `process.env` dentro de cada tela que mostra o Pix (a landing
 * e a cobrança dentro do CRM). Com o copia-e-cola entrando — e precisando de
 * validação contra o preço —, duas leituras independentes divergiriam: uma tela
 * validaria, a outra mostraria um código desatualizado.
 *
 * Lê `process.env.NEXT_PUBLIC_*` direto, não `lib/env.ts`: este módulo roda no
 * cliente, e `lib/env.ts` valida segredos de servidor. Variável `NEXT_PUBLIC_` é
 * embutida no bundle em tempo de build — por isso mudar na Vercel exige redeploy.
 */
import { PRO_PLANS } from "@/lib/pricing/pro-plans";
import { checkCopiaECola, type CopiaEColaCheck } from "./brcode";

export const PIX_KEY = (process.env.NEXT_PUBLIC_PIX_KEY ?? "").trim();
export const PIX_RECEIVER_NAME = (process.env.NEXT_PUBLIC_PIX_RECEIVER_NAME ?? "").trim();

/**
 * QR estático, versionado em `public/pix/`. Fica fora de env porque imagem não
 * cabe em variável. Se o arquivo não existir, as telas escondem a imagem.
 */
export const PIX_QR_SRC = "/pix/calc3d-pro-qr.jpeg";

/**
 * Resultado da validação do copia-e-cola contra o preço e a chave atuais.
 *
 * Quando `usable` é falso, as telas NÃO mostram o código — a chave copiável
 * continua lá, então o comprador ainda paga. Mostrar um código com valor velho
 * seria pior que não mostrar nenhum.
 */
export const PIX_COPIA_E_COLA: CopiaEColaCheck = checkCopiaECola(
  process.env.NEXT_PUBLIC_PIX_COPIA_E_COLA,
  { amountCents: PRO_PLANS.pro.amountCents, key: PIX_KEY || null },
);

/** O código pronto para exibir, ou `null` quando não deve aparecer. */
export const PIX_COPIA_E_COLA_TEXT: string | null = PIX_COPIA_E_COLA.usable
  ? (process.env.NEXT_PUBLIC_PIX_COPIA_E_COLA ?? "").replace(/\s+/g, "")
  : null;
