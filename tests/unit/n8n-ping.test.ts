import { describe, it, expect, vi } from "vitest";
import { POST } from "../../app/api/n8n/ping-webhook/route";

describe("n8n Ping Webhook API", () => {
  it("executa ping com sucesso quando o webhook responde 200", async () => {
    // Mock fetch
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "healthy", timestamp: "2026-10-10T18:00:00Z" }),
    } as any);

    const req = new Request("http://localhost:3000/api/n8n/ping-webhook", {
      method: "POST",
      body: JSON.stringify({ url: "https://n8n-636f.onrender.com/webhook/test" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.statusCode).toBe(200);
    expect(json.data?.status).toBe("healthy");
    expect(typeof json.responseTimeMs).toBe("number");

    global.fetch = originalFetch;
  });

  it("trata erro HTTP com formato resiliente", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => "Bad Gateway",
    } as any);

    const req = new Request("http://localhost:3000/api/n8n/ping-webhook", {
      method: "POST",
      body: JSON.stringify({ url: "https://n8n-636f.onrender.com/webhook/test" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.statusCode).toBe(502);
    expect(json.error).toContain("HTTP 502");

    global.fetch = originalFetch;
  });
});
