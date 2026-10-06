/**
 * The agent test endpoint returns a fake trace while the real AI runtime is not
 * enabled (`INTERNAL_AGENT_RUN_STUB=true`). These helpers keep the UI honest
 * about it: a simulated answer must never look like a real LLM answer.
 */
export const SIMULATED_EXPLANATION =
  "Resposta simulada: o motor de IA ainda não está ativado nesta conta.";

/** `stub` is the legacy flag; `simulated` is the current one. Either marks a fake run. */
export function isSimulatedResult(data: { simulated?: boolean; stub?: boolean }): boolean {
  return data.simulated === true || data.stub === true;
}
