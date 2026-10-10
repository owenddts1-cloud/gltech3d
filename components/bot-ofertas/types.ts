export type OfferNiche = "impressao_3d" | "ferramentas" | "eletronicos" | "geral";
export type OfferMarketplace = "mercadolivre" | "amazon" | "shopee" | "aliexpress" | "tiktok" | "outro";
export type OfferCopyStyle = "padrao" | "achado" | "cupom_mes" | "urgencia";
export type OfferStatus = "pendente" | "enviado" | "pausado" | "esgotado";

export interface OfferItem {
  id: string;
  title: string;
  category: string;
  niche?: OfferNiche | string;
  marketplace?: OfferMarketplace | string;
  originalPrice: number;
  promoPrice: number;
  coupon: string;
  couponHubUrl?: string;
  copyStyle?: OfferCopyStyle | string;
  affiliateUrl: string;
  imageUrl: string;
  status: OfferStatus;
  recycledCount?: number;
  createdAt: string;
  dispatchedAt: string | null;
  lastDispatchedAt?: string | null;
}

export interface NicheGroupMapping {
  whatsappJid: string;
  whatsappName: string;
  telegramChatId: string;
}

export interface BotConfigData {
  whatsappTargetGroupId: string;
  whatsappTargetGroupName: string;
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

export interface BotStatusData {
  daemonOnline: boolean;
  whatsapp: {
    status: "disconnected" | "connecting" | "waiting_qr" | "connected";
    qr: string | null;
    user: { id: string; name?: string } | null;
    groups: Array<{ id: string; name: string; participantsCount: number }>;
  };
  scheduler: {
    running: boolean;
    active: boolean;
    nextRun: string | null;
  };
  config: {
    whatsappTargetGroupId: string;
    whatsappTargetGroupName: string;
    telegramChatId: string;
    hasTelegramToken: boolean;
  };
  counts: {
    total: number;
    pending: number;
    sent: number;
  };
}

export interface HistoryItem {
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

