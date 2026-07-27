import type { MeshPayload, MeshPayloadType, AppDomain } from "@/types/hub";

/**
 * Barramento de eventos LOCAL entre as telas do hub.
 *
 * Apesar do nome, isto não é um data mesh: não há backend, não há persistência
 * no servidor e não há escopo de organização. É um array de listeners em
 * memória mais um histórico de 50 itens em `localStorage`, tudo dentro da aba
 * do navegador. Recarregar em outro dispositivo não vê nada; outro usuário da
 * mesma organização também não.
 *
 * Serve para o que já faz hoje — passar o contexto de um produto do CRM para a
 * tela de conteúdo sem redigitar. Qualquer uso que dependa de durabilidade ou
 * de compartilhamento entre usuários precisa de tabela e RLS antes.
 */

class DataMeshEngine {
  private listeners: ((payload: MeshPayload) => void)[] = [];

  public emit<T>(
    sourceApp: AppDomain,
    targetApp: AppDomain,
    payloadType: MeshPayloadType,
    data: T,
    metadata?: Record<string, unknown>
  ): MeshPayload<T> {
    const payload: MeshPayload<T> = {
      id: `mesh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sourceApp,
      targetApp,
      payloadType,
      timestamp: new Date().toISOString(),
      data,
      metadata,
    };

    // Broadcast no browser window para escuta reativa se disponível
    if (typeof window !== "undefined") {
      const event = new CustomEvent("cross-app-mesh-event", { detail: payload });
      window.dispatchEvent(event);

      // Salva histórico em localStorage para persistência local rápida
      const existing = JSON.parse(localStorage.getItem("mesh_history") || "[]");
      existing.unshift(payload);
      localStorage.setItem("mesh_history", JSON.stringify(existing.slice(0, 50)));
    }

    this.listeners.forEach((fn) => fn(payload as MeshPayload));
    return payload;
  }

  public subscribe(callback: (payload: MeshPayload) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== callback);
    };
  }

  public getHistory(): MeshPayload[] {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("mesh_history") || "[]");
    } catch {
      return [];
    }
  }
}

export const dataMesh = new DataMeshEngine();
