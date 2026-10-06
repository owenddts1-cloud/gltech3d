import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

function req(headers: Record<string, string>) {
  return { headers: new Headers(headers) };
}

describe("clientIp", () => {
  it("prefere x-real-ip (definido pela Vercel e pelo nginx do kit)", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("sem x-real-ip, usa a ULTIMA entrada do x-forwarded-for (a do nosso proxy)", () => {
    // `$proxy_add_x_forwarded_for` acrescenta o IP real ao que o cliente mandou.
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("um X-Forwarded-For forjado pelo cliente nao troca o IP a cada request", () => {
    const a = clientIp(req({ "x-forwarded-for": "10.0.0.1, 198.51.100.9" }));
    const b = clientIp(req({ "x-forwarded-for": "10.0.0.2, 198.51.100.9" }));
    expect(a).toBe(b);
  });

  it("ignora entradas vazias e espacos", () => {
    expect(clientIp(req({ "x-forwarded-for": " 198.51.100.9 , " }))).toBe("198.51.100.9");
    expect(clientIp(req({ "x-real-ip": "   ", "x-forwarded-for": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("sem nenhum header, unknown", () => {
    expect(clientIp(req({}))).toBe("unknown");
    expect(clientIp(req({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});
