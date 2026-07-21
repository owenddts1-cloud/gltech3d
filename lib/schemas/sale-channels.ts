import { z } from "zod";

export const saleChannelQuickCreateSchema = z.object({
  name: z.string().trim().min(1, "Nome muito curto.").max(120),
});

export type SaleChannelQuickCreate = z.infer<typeof saleChannelQuickCreateSchema>;
