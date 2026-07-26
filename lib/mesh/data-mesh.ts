import type { MeshPayload, MeshPayloadType, AppDomain } from "@/types/hub";

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
