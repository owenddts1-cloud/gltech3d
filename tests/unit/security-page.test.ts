import { describe, it, expect } from "vitest";
import {
  createWebAuthnRegistrationOptions,
  isWebAuthnSupported,
} from "@/lib/auth/webauthn-types";

describe("WebAuthn / Passkeys scaffolding and security types", () => {
  it("creates valid registration options payload with GLTech3D RP configuration", () => {
    const opts = createWebAuthnRegistrationOptions("user-abc", "diretoria@gltech3d.com.br");

    expect(opts.rp.name).toBe("GLTech3D");
    expect(opts.user.id).toBe("user-abc");
    expect(opts.user.name).toBe("diretoria@gltech3d.com.br");
    expect(opts.challenge).toBeDefined();
    expect(opts.pubKeyCredParams.length).toBeGreaterThan(0);
    expect(opts.authenticatorSelection.userVerification).toBe("preferred");
  });

  it("handles environment check when window is undefined in node/server context", () => {
    expect(isWebAuthnSupported()).toBe(false);
  });
});
