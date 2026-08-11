"use server";

import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRUSTED_DEVICE_COOKIE_NAME, hashDeviceToken } from "@/lib/auth/trusted-device";

export interface TrustedDeviceRow {
  id: string;
  deviceName: string;
  ipAddress: string | null;
  userAgent: string | null;
  status: "approved" | "pending" | "revoked";
  approvedAt: string | null;
  expiresAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

export async function listTrustedDevices(): Promise<{
  ok: true;
  devices: TrustedDeviceRow[];
}> {
  const user = await requireAuth();
  const admin = createAdminClient();

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(TRUSTED_DEVICE_COOKIE_NAME)?.value;
  const currentHash = currentToken ? hashDeviceToken(currentToken) : null;

  const { data, error } = await admin
    .from("user_trusted_devices")
    .select("*")
    .eq("user_id", user.id)
    .order("last_used_at", { ascending: false });

  if (error || !data) {
    return { ok: true, devices: [] };
  }

  const devices: TrustedDeviceRow[] = data.map((row) => ({
    id: row.id,
    deviceName: row.device_name,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    status: row.status as "approved" | "pending" | "revoked",
    approvedAt: row.approved_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    isCurrent: currentHash ? row.device_token_hash === currentHash : false,
  }));

  return { ok: true, devices };
}

export async function approveTrustedDevice(deviceId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  const admin = createAdminClient();

  const { error } = await admin
    .from("user_trusted_devices")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", deviceId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function revokeTrustedDevice(deviceId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  const admin = createAdminClient();

  const { error } = await admin
    .from("user_trusted_devices")
    .update({
      status: "revoked",
      updated_at: new Date().toISOString(),
    })
    .eq("id", deviceId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
