export function formatCurrency(val: number | string | undefined | null): string {
  if (!val || isNaN(Number(val))) return "0,00";
  return Number(val).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function calculateDiscount(original: number | string, promo: number | string): number {
  const o = Number(original) || 0;
  const p = Number(promo) || 0;
  if (!o || !p || o <= p) return 0;
  return Math.round(((o - p) / o) * 100);
}

export interface FormatOptions {
  groupInviteUrl?: string;
  defaultHashtags?: string;
}

export function formatOfferMessage(
  offer: {
    title?: string;
    originalPrice?: number | string;
    promoPrice?: number | string;
    coupon?: string;
    affiliateUrl?: string;
  },
  options: FormatOptions = {},
): string {
  const lines: string[] = [];

  const title = (offer.title || "Super Oferta").trim();
  lines.push(`🛍️ ${title}`);
  lines.push("");

  const orig = Number(offer.originalPrice) || 0;
  const promo = Number(offer.promoPrice) || 0;
  const discount = calculateDiscount(orig, promo);

  if (orig > promo && promo > 0) {
    lines.push(`De: R$ ${formatCurrency(orig)}`);
    const discountTag = discount > 0 ? ` (${discount}% OFF)` : "";
    lines.push(`Por: R$ ${formatCurrency(promo)} ✅${discountTag}`);
  } else if (promo > 0) {
    lines.push(`Por: R$ ${formatCurrency(promo)} ✅`);
  }

  if (offer.coupon && offer.coupon.trim().length > 0) {
    const cp = offer.coupon.trim();
    const cupomText = cp.toLowerCase().includes("cupom") ? cp : `Use o cupom ${cp}`;
    lines.push(`🎟️ ${cupomText}`);
  }

  lines.push("");

  if (offer.affiliateUrl && offer.affiliateUrl.trim().length > 0) {
    lines.push(`🛒 ${offer.affiliateUrl.trim()}`);
  }

  if (options.groupInviteUrl && options.groupInviteUrl.trim().length > 0) {
    lines.push("");
    lines.push(`🚀 Entre no grupo: ${options.groupInviteUrl.trim()}`);
  }

  const hashtags = options.defaultHashtags || "#anúncio #cacadoresderenda #GLTech3D";
  if (hashtags.trim().length > 0) {
    lines.push("");
    lines.push(hashtags.trim());
  }

  return lines.join("\n");
}
