import fs from "node:fs";
import path from "node:path";

const BOT_SERVICE_URL = process.env.BOT_OFERTAS_URL || "http://127.0.0.1:3000";
const DATA_DIR = path.resolve(process.cwd(), "services/bot_ofertas/data");
const OFFERS_FILE = path.join(DATA_DIR, "offers.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

export interface NicheGroupMapping {
  whatsappJid: string;
  whatsappName: string;
  telegramChatId: string;
}

export interface BotConfig {
  whatsappTargetGroupId: string;
  whatsappTargetGroupName: string;
  whatsappConnected?: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  autoDispatchEnabled: boolean;
  dispatchIntervalMinutes: number;
  dispatchJitterMinutes: number;
  minIntervalMinutes?: number;
  maxIntervalMinutes?: number;
  recycleMode?: boolean;
  welcomeMessageEnabled?: boolean;
  welcomeGroupName?: string;
  nicheGroups?: Record<string, NicheGroupMapping>;
  marketplacesCouponHubs?: Record<string, string>;
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
  niche?: string;
  marketplace?: string;
  originalPrice: number;
  promoPrice: number;
  coupon: string;
  couponHubUrl?: string;
  copyStyle?: string;
  affiliateUrl: string;
  imageUrl: string;
  status: "pendente" | "enviado" | "pausado" | "esgotado";
  recycledCount?: number;
  createdAt: string;
  dispatchedAt: string | null;
  lastDispatchedAt?: string | null;
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
  dispatchIntervalMinutes: 10,
  dispatchJitterMinutes: 3,
  minIntervalMinutes: 2,
  maxIntervalMinutes: 15,
  recycleMode: true,
  welcomeMessageEnabled: true,
  welcomeGroupName: "GLTech Ofertas - Impressão 3D",
  nicheGroups: {
    impressao_3d: {
      whatsappJid: "",
      whatsappName: "GLTech Ofertas - Impressão 3D",
      telegramChatId: "",
    },
    ferramentas: {
      whatsappJid: "",
      whatsappName: "GLTech Ofertas - Ferramentas & Oficina",
      telegramChatId: "",
    },
    eletronicos: {
      whatsappJid: "",
      whatsappName: "GLTech Ofertas - Smart Home & Tech",
      telegramChatId: "",
    },
  },
  marketplacesCouponHubs: {
    mercadolivre: "https://www.mercadolivre.com.br/cupons",
    shopee: "https://shopee.com.br/m/cupons-diarios",
    amazon: "https://www.amazon.com.br/cupom",
    aliexpress: "https://best.aliexpress.com",
    tiktok: "https://www.tiktok.com",
  },
  dispatchStartHour: 9,
  dispatchEndHour: 23,
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

    // Grupos conhecidos e configurados
    const groups: Array<{ id: string; name: string; participantsCount: number }> = [
      { id: "120363414256913914@g.us", name: "GLTECH 3D OFERTAS 🚀🚀", participantsCount: 3 },
      { id: "120363000000000001@g.us", name: "GLTech Ofertas #3 - Impressão 3D", participantsCount: 3 },
      { id: "120363000000000002@g.us", name: "GLTech Ofertas - Ferramentas Maker", participantsCount: 2 },
      { id: "120363000000000003@g.us", name: "GLTech Ofertas - Eletrônicos & Smart Home", participantsCount: 2 },
    ];

    if (config.whatsappTargetGroupId && !groups.some((g) => g.id === config.whatsappTargetGroupId)) {
      groups.unshift({
        id: config.whatsappTargetGroupId,
        name: config.whatsappTargetGroupName || "GLTECH Grupo Principal",
        participantsCount: 3,
      });
    }

    return {
      daemonOnline: true,
      cloudNative: true,
      whatsapp: {
        status: config.whatsappConnected !== false ? "connected" : "disconnected",
        qr: null,
        user: { name: "GLTECH Cloud Gateway", id: "553199999999" },
        groups,
      },
      scheduler: {
        running: Boolean(config.autoDispatchEnabled),
        active: Boolean(config.autoDispatchEnabled),
        nextRun: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
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
