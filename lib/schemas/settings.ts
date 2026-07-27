/**
 * Zod schemas for /app/settings/* server actions and routes (EPIC-10).
 *
 * - profileSchema: persisted to auth.users.raw_user_meta_data
 * - tenantSchema: persisted to organizations row + organizations.settings jsonb
 * - notificationPrefsSchema: STUB (notification_prefs table not yet migrated)
 * - pipelineConfigPatchSchema: pipeline vocabulary + settings.fields + settings.lost_reasons
 */
import { z } from "zod";

const LOCALES = ["pt-BR", "en-US"] as const;
export type Locale = (typeof LOCALES)[number];

export const profileSchema = z.object({
  full_name: z.string().min(1).max(120).nullable().optional(),
  locale: z.enum(LOCALES),
  timezone: z.string().min(1).max(64),
  avatar_url: z
    .string()
    .url()
    .max(2048)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
});
export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * Branding dos documentos impressos, persistido em `organizations.settings.documents`.
 *
 * Vive no jsonb e não em colunas porque `organizations` é tabela de plataforma (fica
 * no snapshot do baseline, não no apêndice) e nenhum destes campos é filtrado,
 * ordenado ou joinado — é payload de renderização puro (DIRC-D). O anti-pattern de
 * jsonb lock-in é evitado justamente por este schema: ninguém lê path cru.
 *
 * `display_name`, `legal_name` e `cnpj` NÃO se repetem aqui — vêm das colunas.
 */
const brandingAddressSchema = z.object({
  street: z.string().trim().max(200).default(""),
  number: z.string().trim().max(20).default(""),
  complement: z.string().trim().max(100).default(""),
  district: z.string().trim().max(120).default(""),
  city: z.string().trim().max(120).default(""),
  state: z.string().trim().max(2).default(""),
  cep: z.string().trim().max(12).default(""),
});

export const documentBrandingSchema = z.object({
  logo_url: z.string().trim().max(2048).default(""),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().max(200).default(""),
  site: z.string().trim().max(200).default(""),
  instagram: z.string().trim().max(120).default(""),
  address: brandingAddressSchema.default({}),
  footer_note: z.string().trim().max(300).default(""),
  default_validity_days: z.coerce.number().int().min(0).max(365).default(15),
  default_payment_terms: z.string().trim().max(600).default(""),
  default_warranty: z.string().trim().max(600).default(""),
  default_delivery_estimate: z.string().trim().max(200).default(""),
  /** Observação padrão impressa no bloco OBSERVAÇÕES (ex.: variação de tom do filamento). */
  default_notes: z.string().trim().max(1000).default(""),
  signer_name: z.string().trim().max(200).default(""),
  signer_role: z.string().trim().max(120).default(""),
});
export type DocumentBranding = z.infer<typeof documentBrandingSchema>;

/** Branding vazio, já com os defaults — usado quando a org nunca configurou nada. */
export function emptyDocumentBranding(): DocumentBranding {
  return documentBrandingSchema.parse({});
}

/**
 * Lê `organizations.settings.documents` com tolerância: settings corrompido ou
 * ausente devolve os defaults em vez de derrubar a página.
 */
export function readDocumentBranding(settings: unknown): DocumentBranding {
  const bag = (settings ?? {}) as Record<string, unknown>;
  const parsed = documentBrandingSchema.safeParse(bag.documents ?? {});
  return parsed.success ? parsed.data : emptyDocumentBranding();
}

export const tenantSchema = z.object({
  display_name: z.string().min(1).max(120),
  legal_name: z.string().min(1).max(200),
  cnpj: z
    .string()
    .max(20)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  timezone: z.string().min(1).max(64),
  locale: z.enum(LOCALES),
  media_retention_days: z.coerce.number().int().min(30).max(3650),
  dpo_email: z
    .string()
    .email()
    .max(200)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  privacy_policy_url: z
    .string()
    .url()
    .max(2048)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  lost_reasons_extra: z.array(z.string().min(1).max(80)).max(50).default([]),
  documents: documentBrandingSchema.default({}),
});
export type TenantInput = z.infer<typeof tenantSchema>;

export const NOTIFICATION_CATEGORIES = [
  "lead_assigned",
  "lead_won",
  "lead_lost",
  "mention",
] as const;
export const NOTIFICATION_CHANNELS = ["email", "in_app", "push"] as const;

export const notificationPrefsSchema = z.object({
  prefs: z.array(
    z.object({
      category: z.enum(NOTIFICATION_CATEGORIES),
      channel: z.enum(NOTIFICATION_CHANNELS),
      enabled: z.boolean(),
    }),
  ),
});
export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;

const customFieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/i, "Use letras, números e underscore"),
  label: z.string().min(1).max(80),
  type: z.enum([
    "text",
    "textarea",
    "number",
    "date",
    "select",
    "multiselect",
    "boolean",
    "email",
    "phone",
    "url",
  ]),
  required: z.boolean().optional(),
  options: z
    .array(z.object({ value: z.string().min(1), label: z.string().min(1) }))
    .optional(),
});

export const pipelineConfigPatchSchema = z.object({
  vocabulary: z
    .object({
      lead: z.string().min(1).max(40).optional(),
      deal: z.string().min(1).max(40).optional(),
      won: z.string().min(1).max(40).optional(),
      lost: z.string().min(1).max(40).optional(),
    })
    .optional(),
  fields: z.array(customFieldSchema).max(50).optional(),
  lost_reasons: z.array(z.string().min(1).max(80)).max(50).optional(),
});
export type PipelineConfigPatch = z.infer<typeof pipelineConfigPatchSchema>;
