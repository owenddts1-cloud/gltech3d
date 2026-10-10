import fs from "node:fs";
import path from "node:path";

const BOT_SERVICE_URL = process.env.BOT_OFERTAS_URL || "http://127.0.0.1:3000";
const DATA_DIR = path.resolve(process.cwd(), "services/bot_ofertas/data");
const OFFERS_FILE = path.join(DATA_DIR, "offers.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

export interface BotConfig {
  whatsappTargetGroupId: string;
  whatsappTargetGroupName: string;
  telegramBotToken: string;
  telegramChatId: string;
  autoDispatchEnabled: boolean;
  dispatchIntervalMinutes: number;
  dispatchJitterMinutes: number;
  dispatchStartHour: number;
  dispatchEndHour: number;
  defaultHashtags: string;
  groupInviteUrl: string;
  watermarkText: string;
}

export interface BotOffer {
  id: string;
  title: string;
  category: string;
  originalPrice: number;
  promoPrice: number;
  coupon: string;
  affiliateUrl: string;
  imageUrl: string;
  status: "pendente" | "enviado" | "pausado";
  createdAt: string;
  dispatchedAt: string | null;
}

export interface BotHistoryItem {
  id: string;
  offerId?: string;
  title: string;
  channel: string;
  target: string;
  status: "success" | "error";
  error?: string;
  timestamp: string;
  messageText?: string;
}

const DEFAULT_CONFIG: BotConfig = {
  whatsappTargetGroupId: "",
  whatsappTargetGroupName: "",
  telegramBotToken: "",
  telegramChatId: "",
  autoDispatchEnabled: false,
  dispatchIntervalMinutes: 40,
  dispatchJitterMinutes: 5,
  dispatchStartHour: 9,
  dispatchEndHour: 22,
  defaultHashtags: "#anúncio #cacadoresderenda #GLTech3D",
  groupInviteUrl: "",
  watermarkText: "GLTech3D",
};

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (_) {}
}

export function readLocalJson<T>(filePath: string, fallback: T): T {
  try {
    ensureDataDir();
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf-8");
      return fallback;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeLocalJson<T>(filePath: string, data: T): boolean {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

/** Tenta chamar o daemon local na porta 3000; se offline, lança erro para acionar fallback. */
export async function fetchFromDaemon(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${BOT_SERVICE_URL}/api${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export async function getBotStatus() {
  try {
    const data = await fetchFromDaemon("/status");
    return { ...data, daemonOnline: true };
  } catch {
    const config = readLocalJson<BotConfig>(CONFIG_FILE, DEFAULT_CONFIG);
    const offers = readLocalJson<BotOffer[]>(OFFERS_FILE, []);
    return {
      daemonOnline: false,
      whatsapp: {
        status: "disconnected",
        qr: null,
        user: null,
        groups: [],
      },
      scheduler: {
        running: false,
        active: false,
        nextRun: null,
      },
      config: {
        whatsappTargetGroupId: config.whatsappTargetGroupId,
        whatsappTargetGroupName: config.whatsappTargetGroupName,
        telegramChatId: config.telegramChatId,
        hasTelegramToken: Boolean(config.telegramBotToken),
      },
      counts: {
        total: offers.length,
        pending: offers.filter((o) => o.status === "pendente").length,
        sent: offers.filter((o) => o.status === "enviado").length,
      },
    };
  }
}

export async function getBotOffers(): Promise<BotOffer[]> {
  try {
    const res = await fetchFromDaemon("/offers");
    return res.offers || [];
  } catch {
    return readLocalJson<BotOffer[]>(OFFERS_FILE, []);
  }
}

export async function saveBotOffers(offers: BotOffer[]) {
  writeLocalJson(OFFERS_FILE, offers);
}

export async function getBotConfig(): Promise<BotConfig> {
  try {
    return await fetchFromDaemon("/config");
  } catch {
    return readLocalJson<BotConfig>(CONFIG_FILE, DEFAULT_CONFIG);
  }
}

export async function saveBotConfig(cfg: Partial<BotConfig>): Promise<BotConfig> {
  try {
    const res = await fetchFromDaemon("/config", {
      method: "POST",
      body: JSON.stringify(cfg),
    });
    return res.config;
  } catch {
    const current = readLocalJson<BotConfig>(CONFIG_FILE, DEFAULT_CONFIG);
    const merged = { ...current, ...cfg };
    writeLocalJson(CONFIG_FILE, merged);
    return merged;
  }
}

export async function getBotHistory(): Promise<BotHistoryItem[]> {
  try {
    const res = await fetchFromDaemon("/history");
    return res.history || [];
  } catch {
    return readLocalJson<BotHistoryItem[]>(HISTORY_FILE, []);
  }
}
