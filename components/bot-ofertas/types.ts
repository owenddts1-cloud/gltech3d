export interface OfferItem {
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

export interface BotConfigData {
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
