import { randomBytes } from "crypto";

export interface PasskeyRpConfig {
  name: string;
  id: string;
}

export interface PasskeyUserConfig {
  id: string;
  name: string;
  displayName: string;
}

export interface PasskeyParam {
  type: "public-key";
  alg: number; // COSE algorithm identifiers: -7 for ES256, -257 for RS256
}

export interface PasskeyAuthenticatorSelection {
  authenticatorAttachment?: "platform" | "cross-platform";
  residentKey: "required" | "preferred" | "discouraged";
  userVerification: "required" | "preferred" | "discouraged";
}

export interface PasskeyRegistrationOptions {
  challenge: string;
  rp: PasskeyRpConfig;
  user: PasskeyUserConfig;
  pubKeyCredParams: PasskeyParam[];
  timeout: number;
  attestation: "none" | "indirect" | "direct";
  authenticatorSelection: PasskeyAuthenticatorSelection;
}

/**
 * Checa se o browser do usuário possui suporte para WebAuthn / Passkeys.
 * Execução segura tanto no cliente quanto no SSR/Node.
 */
export function isWebAuthnSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.PublicKeyCredential &&
      typeof window.PublicKeyCredential === "function" &&
      typeof navigator !== "undefined" &&
      navigator.credentials,
  );
}

/**
 * Cria a carga de opções padrão para registro de Biometria / Passkey (WebAuthn).
 */
export function createWebAuthnRegistrationOptions(
  userId: string,
  userEmail: string,
): PasskeyRegistrationOptions {
  const challenge = randomBytes(32).toString("base64url");

  return {
    challenge,
    rp: {
      name: "GLTech3D",
      id: "gltech3d.com.br",
    },
    user: {
      id: userId,
      name: userEmail,
      displayName: userEmail,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 }, // ES256
      { type: "public-key", alg: -257 }, // RS256
    ],
    timeout: 60000,
    attestation: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  };
}
