/**
 * Auto-cadastro público com trial de 7 dias.
 *
 * `.strict()` pelo mesmo motivo de `pro-signup.ts`: o corpo vem de um formulário
 * aberto e vai direto para um INSERT com service role, que bypassa RLS. Aceitar
 * chave extra em silêncio é como `organization_id` ou `plan` entrariam pelo body.
 */
import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

/** Tempo mínimo de preenchimento. Abaixo disso é robô. */
export const MIN_SIGNUP_ELAPSED_MS = 1200;

export const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(200),
    password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
    /** Nome da oficina/marca. Vira `display_name` da organização. */
    display_name: z.string().trim().min(2).max(120),
    /** Aceite de Termos e Privacidade. */
    accept_terms: z.literal(true),
    /** Honeypot: escondido por CSS. Humano nunca preenche. */
    website: z.string().max(0).optional(),
    /** Tempo de preenchimento em ms, medido no cliente. */
    elapsed_ms: z.coerce.number().int().nonnegative().optional(),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;
