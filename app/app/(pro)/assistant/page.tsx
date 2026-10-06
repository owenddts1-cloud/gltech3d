import { redirect } from "next/navigation";

export const metadata = { title: "Assistente IA" };

/**
 * A aba "Assistente IA" era um placeholder ("Prévia") enquanto o construtor de
 * agentes real já existia em /app/ai/agents. Redireciona para lá — a IA existe,
 * só estava noutra rota. Um chat operacional próprio (RAG sobre o CRM) fica como
 * épico futuro.
 */
export default function AssistantPage() {
  redirect("/app/ai/agents");
}
