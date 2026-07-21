import { z } from "zod";

export const materialQuickCreateSchema = z.object({
  name: z.string().trim().min(1, "Nome muito curto.").max(120),
});

export type MaterialQuickCreate = z.infer<typeof materialQuickCreateSchema>;
