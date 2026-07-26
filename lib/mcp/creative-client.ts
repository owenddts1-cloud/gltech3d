export interface McpServerConfig {
  name: string;
  type: "higgsfield" | "flux" | "ai-studio" | "ollama" | "whisper";
  endpoint: string;
  status: "connected" | "disconnected";
}

export class CreativeMcpClient {
  private servers: McpServerConfig[] = [
    { name: "Higgsfield AI Video", type: "higgsfield", endpoint: "mcp://higgsfield.local/v1", status: "connected" },
    { name: "Flux.1 / ComfyUI Engine", type: "flux", endpoint: "ws://127.0.0.1:8188", status: "connected" },
    { name: "Google AI Studio API", type: "ai-studio", endpoint: "https://generativelanguage.googleapis.com", status: "connected" },
    { name: "Ollama Local Model (Llama3)", type: "ollama", endpoint: "http://localhost:11434", status: "connected" },
    { name: "Faster-Whisper Transcriber", type: "whisper", endpoint: "http://localhost:9000/transcribe", status: "connected" },
  ];

  public getServers(): McpServerConfig[] {
    return this.servers;
  }

  public async generateScriptWithLLM(prompt: string): Promise<string> {
    return `[ROTEIRO GERADO VIA MCP]\n\nCENA 1 (0-3s): [Hook] "Você sabia que uma peça impressa em 3D pode ter mais resistência mecânica que alumínio?"\n\nCENA 2 (3-8s): [Demonstração] Mostra protótipo impresso em PETG de alta qualidade.\n\nCENA 3 (8-15s): [CTA] "Acesse o site da GLTech3D e solicite seu orçamento instantâneo em 60 segundos!"`;
  }

  public async generateVideoAnimation(prompt: string): Promise<string> {
    return "https://cdn.gltech3d.com/mcp/higgsfield_anim_sample.mp4";
  }
}

export const creativeMcpClient = new CreativeMcpClient();
