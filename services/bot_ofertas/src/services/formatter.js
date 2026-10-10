/**
 * Formata mensagens promocionais no estilo de alta conversão
 * baseado no padrão real de grupos como "Tech Ofertas - Impressão 3D".
 */

function formatCurrency(val) {
  if (!val || isNaN(val)) return '0,00';
  return Number(val).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function calculateDiscount(original, promo) {
  if (!original || !promo || original <= promo) return 0;
  return Math.round(((original - promo) / original) * 100);
}

/**
 * Monta o texto promocional para o WhatsApp / Telegram.
 * 
 * @param {Object} offer - Dados da oferta
 * @param {Object} options - Configurações extras (hashtags, invite link, etc.)
 */
function formatOfferMessage(offer, options = {}) {
  const lines = [];

  // Título com emoji de sacola de compras (igual ao padrão do grupo)
  const title = (offer.title || 'Super Oferta').trim();
  lines.push(`🛍️ ${title}`);
  lines.push('');

  // Bloco de Preços
  const orig = parseFloat(offer.originalPrice) || 0;
  const promo = parseFloat(offer.promoPrice) || 0;
  const discount = calculateDiscount(orig, promo);

  if (orig > promo && promo > 0) {
    lines.push(`De: R$ ${formatCurrency(orig)}`);
    const discountTag = discount > 0 ? ` (${discount}% OFF)` : '';
    lines.push(`Por: R$ ${formatCurrency(promo)} ✅${discountTag}`);
  } else if (promo > 0) {
    lines.push(`Por: R$ ${formatCurrency(promo)} ✅`);
  }

  // Cupom (se houver)
  if (offer.coupon && offer.coupon.trim().length > 0) {
    const cp = offer.coupon.trim();
    const cupomText = cp.toLowerCase().includes('cupom') ? cp : `Use o cupom ${cp}`;
    lines.push(`🎟️ ${cupomText}`);
  }

  lines.push('');

  // Link de Afiliado (com carrinho de compras)
  if (offer.affiliateUrl && offer.affiliateUrl.trim().length > 0) {
    lines.push(`🛒 ${offer.affiliateUrl.trim()}`);
  }

  // Link de Convite do Grupo (opcional para atrair mais membros se encaminharem a mensagem)
  if (options.groupInviteUrl && options.groupInviteUrl.trim().length > 0) {
    lines.push('');
    lines.push(`🚀 Entre no grupo: ${options.groupInviteUrl.trim()}`);
  }

  // Hashtags e Identificação do Grupo
  const hashtags = options.defaultHashtags || '#anúncio #ofertas';
  if (hashtags.trim().length > 0) {
    lines.push('');
    lines.push(hashtags.trim());
  }

  return lines.join('\n');
}

module.exports = {
  formatCurrency,
  calculateDiscount,
  formatOfferMessage
};
