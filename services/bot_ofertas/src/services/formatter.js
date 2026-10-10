/**
 * Formata mensagens promocionais no estilo de alta conversão
 * com suporte a múltiplos estilos criativos, central de cupons e boas-vindas oficiais.
 */

function formatCurrency(val) {
  if (!val || isNaN(Number(val))) return '0,00';
  return Number(val).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function calculateDiscount(original, promo) {
  const o = Number(original) || 0;
  const p = Number(promo) || 0;
  if (!o || !p || o <= p) return 0;
  return Math.round(((o - p) / o) * 100);
}

function detectMarketplace(url = '') {
  const lower = (url || '').toLowerCase();
  if (
    lower.includes('mercadolivre.com') ||
    lower.includes('mercadolivre.com.br') ||
    lower.includes('meli.la') ||
    lower.includes('melila.me')
  ) {
    return 'mercadolivre';
  }
  if (lower.includes('shopee.com') || lower.includes('shope.ee') || lower.includes('sshopee.me')) {
    return 'shopee';
  }
  if (lower.includes('amazon.com') || lower.includes('amzn.to')) {
    return 'amazon';
  }
  if (lower.includes('aliexpress.com') || lower.includes('s.click.aliexpress.com')) {
    return 'aliexpress';
  }
  if (lower.includes('tiktok.com')) {
    return 'tiktok';
  }
  return 'outro';
}

function formatWelcomeMessage(participantPhone = '', groupName = 'GLTech Ofertas - Impressão 3D') {
  const cleanPhone = (participantPhone || '').replace(/\D/g, '') || participantPhone;
  return [
    `🖨️ Bem-vindo @${cleanPhone} ao ${groupName}!`,
    '',
    'Aqui você encontra promoções de:',
    '🧵 Filamentos',
    '🧪 Resinas',
    '🔧 Ferramentas',
    '🖨️ Impressoras 3D',
    '⚙️ Peças, acessórios e upgrades',
    '',
    '🤖 Promoções monitoradas automaticamente ao longo do dia',
    '✅ Ofertas compartilhadas diariamente',
    '✅ Grupo gratuito',
    '🚫 Sem spam',
    '🚫 Sem conversas paralelas',
    '',
    '🔥 Muitas promoções possuem estoque limitado e podem esgotar rapidamente.'
  ].join('\n');
}

function formatOfferMessage(offer, options = {}) {
  const lines = [];
  const style = offer.copyStyle || 'padrao';
  const title = (offer.title || 'Super Oferta').trim();

  // Cabeçalho por estilo
  if (style === 'achado') {
    lines.push('✨ Achado sensacional! ✨');
    lines.push('');
    lines.push(title);
  } else if (style === 'cupom_mes') {
    lines.push('🔥 Liberado para resgate o melhor cupom do MÊS! 🔥');
    lines.push('');
    lines.push(title);
  } else if (style === 'urgencia') {
    lines.push('⚡ CORRE QUE VAI ESGOTAR! ⚡');
    lines.push('');
    lines.push(title);
  } else {
    lines.push(`🛍️ ${title}`);
  }

  lines.push('');

  // Bloco de Preços
  const orig = Number(offer.originalPrice) || 0;
  const promo = Number(offer.promoPrice) || 0;
  const discount = calculateDiscount(orig, promo);

  if (orig > promo && promo > 0) {
    lines.push(`De: R$ ${formatCurrency(orig)}`);
    const discountTag = discount > 0 ? ` (${discount}% OFF)` : '';
    lines.push(`Por: R$ ${formatCurrency(promo)} ✅${discountTag}`);
  } else if (promo > 0) {
    lines.push(`Por: R$ ${formatCurrency(promo)} ✅`);
  }

  // Cupom
  if (offer.coupon && offer.coupon.trim().length > 0) {
    const cp = offer.coupon.trim();
    const cupomText = cp.toLowerCase().includes('cupom') ? cp : `Use o cupom ${cp}`;
    lines.push(`🎟️ ${cupomText}`);
  }

  // Tutorial de Cupom (se houver)
  if (offer.couponTutorial && offer.couponTutorial.trim().length > 0) {
    lines.push('');
    lines.push('🔥 TUTORIAL DE RESGATE DO CUPOM:');
    lines.push(offer.couponTutorial.trim());
  }

  // Frases de efeito por estilo
  if (style === 'achado') {
    lines.push('');
    lines.push('Atenção: Oferta sujeita a alterações de preço e disponibilidade no site. Garanta o seu!');
  } else if (style === 'cupom_mes') {
    lines.push('');
    lines.push('Atenção: Cupom com quantidade limitada, aplique imediatamente no carrinho!');
  } else if (style === 'urgencia') {
    lines.push('');
    lines.push('Quem viu, levou. Estoque extremamente limitado!');
  }

  lines.push('');

  // Link de Afiliado
  if (offer.affiliateUrl && offer.affiliateUrl.trim().length > 0) {
    lines.push(`🛒 ${offer.affiliateUrl.trim()}`);
  }

  // Central de Cupons do Marketplace
  if (offer.couponHubUrl && offer.couponHubUrl.trim().length > 0) {
    lines.push('');
    lines.push(`⚠️ Sempre resgate todos os cupons disponíveis aqui:\n${offer.couponHubUrl.trim()}`);
  }

  // Link de Convite do Grupo
  if (options.groupInviteUrl && options.groupInviteUrl.trim().length > 0) {
    lines.push('');
    lines.push(`🚀 Participe do Grupo: ${options.groupInviteUrl.trim()}`);
  }

  // Hashtags oficiais
  const hashtags = options.defaultHashtags || '#anúncio #cacadoresderenda #GLTech3D';
  if (hashtags.trim().length > 0) {
    lines.push('');
    lines.push(hashtags.trim());
  }

  return lines.join('\n');
}

module.exports = {
  formatCurrency,
  calculateDiscount,
  detectMarketplace,
  formatWelcomeMessage,
  formatOfferMessage
};
