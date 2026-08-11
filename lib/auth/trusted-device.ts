import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const TRUSTED_DEVICE_COOKIE_NAME = "dc_trusted_device";
export const TRUSTED_DEVICE_MAX_AGE_DAYS = 30;

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseDeviceName(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconhecido";
  let os = "Desktop";
  if (/windows/i.test(userAgent)) os = "Windows";
  else if (/macintosh|mac os x/i.test(userAgent)) os = "Mac";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS";
  else if (/linux/i.test(userAgent)) os = "Linux";

  let browser = "Navegador";
  if (/edg/i.test(userAgent)) browser = "Edge";
  else if (/chrome|crios/i.test(userAgent)) browser = "Chrome";
  else if (/firefox|fxios/i.test(userAgent)) browser = "Firefox";
  else if (/safari/i.test(userAgent)) browser = "Safari";

  return `${browser} no ${os}`;
}

export async function isTrustedDevice(
  userId: string,
  token?: string,
): Promise<boolean> {
  const cookieToken = token ?? (await cookies()).get(TRUSTED_DEVICE_COOKIE_NAME)?.value;
  if (!cookieToken || cookieToken.trim() === "") return false;

  const admin = createAdminClient();
  const tokenHash = hashDeviceToken(cookieToken);

  const { data: record, error } = await admin
    .from("user_trusted_devices")
    .select("id, status, expires_at")
    .eq("user_id", userId)
    .eq("device_token_hash", tokenHash)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();

  if (error || !record) return false;

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return false;
  }

  // Best-effort: atualiza o timestamp do último uso
  void admin
    .from("user_trusted_devices")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", record.id);

  return true;
}

export async function registerTrustedDevice(
  userId: string,
  userAgent: string | null,
  ip: string | null,
): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashDeviceToken(rawToken);
  const deviceName = parseDeviceName(userAgent);
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  await admin.from("user_trusted_devices").insert({
    user_id: userId,
    device_token_hash: tokenHash,
    device_name: deviceName,
    ip_address: ip ?? null,
    user_agent: userAgent ?? null,
    status: "approved",
    approved_at: new Date().toISOString(),
    expires_at: expiresAt,
    last_used_at: new Date().toISOString(),
  });

  const cookieStore = await cookies();
  cookieStore.set(TRUSTED_DEVICE_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: TRUSTED_DEVICE_MAX_AGE_DAYS * 24 * 60 * 60,
    path: "/",
  });

  return rawToken;
}
