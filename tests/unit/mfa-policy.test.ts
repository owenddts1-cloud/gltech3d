import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignIn = vi.fn();
const mockListFactors = vi.fn();
const mockIsTrustedDevice = vi.fn();
const mockSendEmail = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (key: string) => {
      if (key === "x-request-id") return "req-123";
      if (key === "x-forwarded-for") return "192.168.1.100";
      if (key === "user-agent") return "Mozilla/5.0 Test Browser";
      return null;
    },
  }),
}));

vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true }),
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(),
  hashEmail: (email: string) => `hash_${email}`,
}));

vi.mock("@/lib/auth/trusted-device", () => ({
  isTrustedDevice: (...args: any[]) => mockIsTrustedDevice(...args),
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: (...args: any[]) => mockSignIn(...args),
      mfa: {
        listFactors: (...args: any[]) => mockListFactors(...args),
      },
    },
  }),
}));

import { signInWithPassword } from "@/app/actions/auth/signInWithPassword";

describe("differentiated MFA policy and anti-lockout on signInWithPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue({ ok: true, id: "msg-123" });
  });

  it("allows standard users without enrolled MFA to log in directly without prompt", async () => {
    mockSignIn.mockResolvedValue({
      data: { user: { id: "user-standard", email: "cliente@calc3d.com.br" } },
      error: null,
    });
    mockListFactors.mockResolvedValue({
      data: { totp: [] },
    });

    await expect(
      signInWithPassword({
        email: "cliente@calc3d.com.br",
        password: "ValidPassword123!",
      }),
    ).rejects.toThrow("REDIRECT:/portal");
  });

  it("challenges directorate admin with enrolled MFA when device is not trusted", async () => {
    mockSignIn.mockResolvedValue({
      data: {
        user: {
          id: "user-dir",
          email: "diretoria.gltech@gmail.com",
          app_metadata: { role: "admin" },
        },
      },
      error: null,
    });
    mockListFactors.mockResolvedValue({
      data: { totp: [{ id: "totp-factor-456", status: "verified" }] },
    });
    mockIsTrustedDevice.mockResolvedValue(false);

    const result = await signInWithPassword({
      email: "diretoria.gltech@gmail.com",
      password: "ValidPassword123!",
    });

    expect(result).toEqual({
      ok: false,
      error: "mfa_required",
      challengeId: "totp-factor-456",
    });
  });

  it("bypasses MFA challenge for directorate admin if device is already trusted", async () => {
    mockSignIn.mockResolvedValue({
      data: {
        user: {
          id: "user-dir",
          email: "diretoria.gltech@gmail.com",
          app_metadata: { role: "admin" },
        },
      },
      error: null,
    });
    mockListFactors.mockResolvedValue({
      data: { totp: [{ id: "totp-factor-456", status: "verified" }] },
    });
    mockIsTrustedDevice.mockResolvedValue(true);

    await expect(
      signInWithPassword({
        email: "diretoria.gltech@gmail.com",
        password: "ValidPassword123!",
      }),
    ).rejects.toThrow("REDIRECT:/portal");
  });

  it("anti-lockout: ensures diretoria.gltech@gmail.com is NOT locked out when MFA is not yet enrolled", async () => {
    mockSignIn.mockResolvedValue({
      data: {
        user: {
          id: "user-dir-no-mfa",
          email: "diretoria.gltech@gmail.com",
          app_metadata: { role: "admin" },
        },
      },
      error: null,
    });
    mockListFactors.mockResolvedValue({
      data: { totp: [] },
    });

    // Should not throw error, should not lockout, should redirect smoothly
    await expect(
      signInWithPassword({
        email: "diretoria.gltech@gmail.com",
        password: "ValidPassword123!",
      }),
    ).rejects.toThrow("REDIRECT:/portal");

    // Sends security advisory email via Brevo/SMTP
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "diretoria.gltech@gmail.com",
        subject: expect.stringContaining("Diretoria GLTech3D"),
      }),
    );
  });
});
