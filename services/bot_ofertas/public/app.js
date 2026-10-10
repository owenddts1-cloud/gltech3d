/**
 * Frontend Application Logic for Bot de Ofertas Pro
 */

// Estado local
let state = {
  currentTab: 'tab-ofertas',
  offers: [],
  config: {},
  groups: [],
  history: [],
  whatsappStatus: 'disconnected',
  qrCode: null,
  schedulerStatus: {}
};

// Form Elements
const offerForm = document.getElementById('offer-form');
const offerTitle = document.getElementById('offer-title');
const offerOrigPrice = document.getElementById('offer-orig-price');
const offerPromoPrice = document.getElementById('offer-promo-price');
const offerCoupon = document.getElementById('offer-coupon');
const offerAffiliateUrl = document.getElementById('offer-affiliate-url');
const offerImageUrl = document.getElementById('offer-image-url');
const offerCategory = document.getElementById('offer-category');

// Preview Elements
const waPreviewImg = document.getElementById('wa-preview-img');
const waPreviewCaption = document.getElementById('wa-preview-caption');
const waPreviewWatermark = document.getElementById('wa-preview-watermark');

// Scraper Elements
const scrapeUrlInput = document.getElementById('scrape-url-input');
const btnScrape = document.getElementById('btn-scrape');
const scrapeFeedback = document.getElementById('scrape-feedback');

// Navigation Tabs
document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((tc) => tc.classList.remove('active'));

    btn.classList.add('active');
    const tabId = btn.getAttribute('data-tab');
    document.getElementById(tabId).classList.add('active');
    state.currentTab = tabId;

    if (tabId === 'tab-fila') loadOffers();
    if (tabId === 'tab-historico') loadHistory();
    if (tabId === 'tab-conexoes') loadGroups();
  });
});

// Update WhatsApp Chat Mockup Preview
function updatePreview() {
  const title = offerTitle.value.trim() || 'Título do Produto';
  const orig = parseFloat(offerOrigPrice.value) || 0;
  const promo = parseFloat(offerPromoPrice.value) || 0;
  const coupon = offerCoupon.value.trim();
  const affiliateUrl = offerAffiliateUrl.value.trim() || 'https://meli.la/uy-H1GSDg0h0bWC';
  const imgUrl = offerImageUrl.value.trim();
  const watermark = state.config.watermarkText || 'Tech Ofertas';

  // Imagem
  if (imgUrl && imgUrl.startsWith('http')) {
    waPreviewImg.src = imgUrl;
    waPreviewImg.style.display = 'block';
  } else {
    waPreviewImg.src = 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80';
  }
  waPreviewWatermark.textContent = watermark;

  // Preço e Desconto
  let discountBlock = '';
  if (orig > promo && promo > 0) {
    const discount = Math.round(((orig - promo) / orig) * 100);
    discountBlock = `
      <div class="caption-prices">
        <span class="price-de">De: R$ ${orig.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        <span class="price-por">Por: ${promo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ✅ (${discount}% OFF)</span>
      </div>
    `;
  } else if (promo > 0) {
    discountBlock = `
      <div class="caption-prices">
        <span class="price-por">Por: ${promo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ✅</span>
      </div>
    `;
  }

  // Cupom
  let couponBlock = '';
  if (coupon) {
    const cpText = coupon.toLowerCase().includes('cupom') ? coupon : `Use o cupom ${coupon}`;
    couponBlock = `<div class="caption-coupon">🎟️ ${cpText}</div>`;
  }

  // Hashtags
  const hashtags = state.config.defaultHashtags || '#anúncio #cacadoresderenda';

  waPreviewCaption.innerHTML = `
    <div class="caption-title">🛍️ ${title}</div>
    ${discountBlock}
    ${couponBlock}
    <div class="caption-link">🛒 <span class="link-text">${affiliateUrl}</span></div>
    <div class="caption-tags">${hashtags}</div>
  `;
}

// Input listeners for real-time preview
[offerTitle, offerOrigPrice, offerPromoPrice, offerCoupon, offerAffiliateUrl, offerImageUrl].forEach((el) => {
  el.addEventListener('input', updatePreview);
});

// Extração Automática (Scraper)
btnScrape.addEventListener('click', async () => {
  const url = scrapeUrlInput.value.trim();
  if (!url) {
    showFeedback(scrapeFeedback, 'Por favor, cole um link antes de extrair.', 'error');
    return;
  }

  btnScrape.disabled = true;
  btnScrape.innerHTML = '<span class="spinner" style="width:14px;height:14px;display:inline-block;"></span> Extraindo...';
  scrapeFeedback.className = 'feedback-msg';
  scrapeFeedback.style.display = 'none';

  try {
    const res = await fetch('/api/offers/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();

    if (data.success && data.data) {
      const p = data.data;
      if (p.title) offerTitle.value = p.title;
      if (p.imageUrl) offerImageUrl.value = p.imageUrl;
      if (p.promoPrice > 0) offerPromoPrice.value = p.promoPrice;
      offerAffiliateUrl.value = url; // mantém o link de afiliado fornecido

      updatePreview();

      if (p.warning) {
        showFeedback(scrapeFeedback, p.warning, 'error');
      } else {
        showFeedback(scrapeFeedback, 'Dados extraídos com sucesso! Revise e complete os valores.', 'success');
      }
    } else {
      showFeedback(scrapeFeedback, 'Não foi possível extrair dados automaticamente deste site.', 'error');
    }
  } catch (err) {
    showFeedback(scrapeFeedback, 'Erro na extração: ' + err.message, 'error');
  } finally {
    btnScrape.disabled = false;
    btnScrape.innerHTML = '<span class="btn-icon">⚡</span> Puxar Dados';
  }
});

// Salvar Oferta na Fila
offerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    title: offerTitle.value.trim(),
    originalPrice: parseFloat(offerOrigPrice.value) || 0,
    promoPrice: parseFloat(offerPromoPrice.value) || 0,
    coupon: offerCoupon.value.trim(),
    category: offerCategory.value.trim() || 'Geral',
    affiliateUrl: offerAffiliateUrl.value.trim(),
    imageUrl: offerImageUrl.value.trim()
  };

  try {
    const res = await fetch('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      alert('Oferta salva na fila com sucesso!');
      offerForm.reset();
      scrapeUrlInput.value = '';
      updatePreview();
      fetchStatus();
    } else {
      alert('Erro ao salvar: ' + data.error);
    }
  } catch (err) {
    alert('Erro de conexão: ' + err.message);
  }
});

// Disparar Imediatamente a partir do Form
document.getElementById('btn-dispatch-now').addEventListener('click', async () => {
  if (!offerTitle.value.trim() || !offerPromoPrice.value.trim() || !offerAffiliateUrl.value.trim()) {
    alert('Preencha pelo menos Título, Preço POR e Link de Afiliado para disparar.');
    return;
  }

  const confirmDispatch = confirm('Deseja disparar esta oferta imediatamente para o grupo configurado?');
  if (!confirmDispatch) return;

  const payload = {
    title: offerTitle.value.trim(),
    originalPrice: parseFloat(offerOrigPrice.value) || 0,
    promoPrice: parseFloat(offerPromoPrice.value) || 0,
    coupon: offerCoupon.value.trim(),
    category: offerCategory.value.trim() || 'Geral',
    affiliateUrl: offerAffiliateUrl.value.trim(),
    imageUrl: offerImageUrl.value.trim()
  };

  try {
    // 1. Salva na base
    const saveRes = await fetch('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const saveData = await saveRes.json();
    if (!saveData.success) throw new Error(saveData.error);

    // 2. Dispara imediatamente
    const hasTg = Boolean(state.config.telegramBotToken && state.config.telegramChatId && !state.config.telegramChatId.includes('@gmail'));
    const dispatchRes = await fetch(`/api/offers/${saveData.offer.id}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sendWhatsapp: true, sendTelegram: hasTg })
    });
    const dispatchData = await dispatchRes.json();

    if (dispatchData.success) {
      alert('🚀 Oferta disparada com sucesso!');
      offerForm.reset();
      updatePreview();
      fetchStatus();
    } else {
      const err = dispatchData.results?.whatsapp?.error || 'Verifique se o WhatsApp está conectado e se o grupo foi configurado.';
      alert('Falha no disparo: ' + err);
    }
  } catch (err) {
    alert('Erro ao disparar: ' + err.message);
  }
});

// Carregar e Renderizar Ofertas da Fila
async function loadOffers() {
  try {
    const res = await fetch('/api/offers');
    const data = await res.json();
    state.offers = data.offers || [];

    renderOffersTable();
  } catch (err) {
    console.error('Erro ao carregar ofertas:', err);
  }
}

function renderOffersTable() {
  const tbody = document.getElementById('offers-tbody');
  const searchFilter = document.getElementById('filter-search').value.toLowerCase();
  const statusFilter = document.getElementById('filter-status').value;

  const filtered = state.offers.filter((o) => {
    const matchSearch = o.title.toLowerCase().includes(searchFilter) || (o.category || '').toLowerCase().includes(searchFilter);
    const matchStatus = statusFilter === 'todos' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">Nenhuma oferta encontrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((o) => {
    const priceText = o.originalPrice > o.promoPrice
      ? `<span class="price-de">De R$ ${o.originalPrice.toFixed(2)}</span><br><strong>Por R$ ${o.promoPrice.toFixed(2)}</strong>`
      : `<strong>Por R$ ${o.promoPrice.toFixed(2)}</strong>`;

    const imgTag = o.imageUrl
      ? `<img src="${o.imageUrl}" class="table-img" alt="Foto" onerror="this.src='https://via.placeholder.com/50'"/>`
      : `<div class="table-img" style="display:flex;align-items:center;justify-content:center;">📦</div>`;

    return `
      <tr>
        <td>${imgTag}</td>
        <td class="product-cell">
          <h4>${escapeHtml(o.title)}</h4>
          <span class="product-niche">🏷️ ${escapeHtml(o.category || 'Geral')}</span>
        </td>
        <td>${priceText}</td>
        <td>${o.coupon ? `🎟️ ${escapeHtml(o.coupon)}` : '<span style="color:var(--text-muted);">-</span>'}</td>
        <td><span class="badge-status ${o.status}">${o.status.toUpperCase()}</span></td>
        <td>
          <div class="cell-actions">
            <button class="btn btn-sm btn-warning" onclick="dispatchRowOffer('${o.id}')" title="Disparar Imediatamente">🚀</button>
            <button class="btn btn-sm btn-danger-ghost" onclick="deleteRowOffer('${o.id}')" title="Excluir">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.dispatchRowOffer = async function(id) {
  if (!confirm('Deseja disparar esta oferta agora?')) return;
  try {
    const hasTg = Boolean(state.config.telegramBotToken && state.config.telegramChatId && !state.config.telegramChatId.includes('@gmail'));
    const res = await fetch(`/api/offers/${id}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sendWhatsapp: true, sendTelegram: hasTg })
    });
    const data = await res.json();
    if (data.success) {
      alert('Oferta disparada com sucesso!');
      loadOffers();
      fetchStatus();
    } else {
      alert('Falha ao disparar: ' + (data.results?.whatsapp?.error || 'Erro desconhecido'));
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  }
};

window.deleteRowOffer = async function(id) {
  if (!confirm('Excluir esta oferta?')) return;
  try {
    await fetch(`/api/offers/${id}`, { method: 'DELETE' });
    loadOffers();
    fetchStatus();
  } catch (err) {
    alert('Erro: ' + err.message);
  }
};

document.getElementById('filter-search').addEventListener('input', renderOffersTable);
document.getElementById('filter-status').addEventListener('change', renderOffersTable);

// CSV Export & Import
document.getElementById('btn-export-csv').addEventListener('click', () => {
  window.open('/api/csv/export', '_blank');
});

document.getElementById('csv-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  try {
    const res = await fetch('/api/csv/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText: text })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Importação concluída! ${data.imported} ofertas adicionadas.`);
      loadOffers();
      fetchStatus();
    } else {
      alert('Erro na importação: ' + data.error);
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  }
});

// Conexão WhatsApp Controls
document.getElementById('btn-wpp-reconnect').addEventListener('click', async () => {
  try {
    await fetch('/api/whatsapp/connect', { method: 'POST' });
    fetchStatus();
  } catch (err) {
    console.error(err);
  }
});

document.getElementById('btn-wpp-logout').addEventListener('click', async () => {
  if (!confirm('Desconectar sua sessão do WhatsApp?')) return;
  try {
    await fetch('/api/whatsapp/logout', { method: 'POST' });
    fetchStatus();
  } catch (err) {
    console.error(err);
  }
});

// Carregar Grupos do WhatsApp
async function loadGroups() {
  const select = document.getElementById('wpp-group-select');
  select.innerHTML = '<option value="">Buscando grupos na sua conta...</option>';

  try {
    const res = await fetch('/api/whatsapp/groups');
    const data = await res.json();
    state.groups = data.groups || [];

    if (state.groups.length === 0) {
      select.innerHTML = '<option value="">Nenhum grupo encontrado (conecte o WhatsApp)</option>';
      return;
    }

    select.innerHTML = '<option value="">-- Selecione o Grupo de Ofertas --</option>' +
      state.groups.map((g) => `
        <option value="${g.id}" ${g.id === state.config.whatsappTargetGroupId ? 'selected' : ''}>
          ${escapeHtml(g.name)} (${g.participantsCount} membros)
        </option>
      `).join('');
  } catch (err) {
    select.innerHTML = '<option value="">Erro ao carregar grupos</option>';
  }
}

document.getElementById('btn-refresh-groups').addEventListener('click', loadGroups);

// Salvar Grupo Principal
document.getElementById('btn-save-group-target').addEventListener('click', async () => {
  const select = document.getElementById('wpp-group-select');
  const targetId = select.value;
  if (!targetId) {
    alert('Selecione um grupo da lista.');
    return;
  }
  const selectedOption = select.options[select.selectedIndex];
  const targetName = selectedOption.text;

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        whatsappTargetGroupId: targetId,
        whatsappTargetGroupName: targetName
      })
    });
    const data = await res.json();
    if (data.success) {
      alert('Grupo de ofertas configurado com sucesso!');
      state.config = data.config;
      updateGroupDisplay();
    }
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  }
});

function updateGroupDisplay() {
  const box = document.getElementById('current-group-box');
  const previewLabel = document.getElementById('preview-target-label');
  if (state.config.whatsappTargetGroupId) {
    box.innerHTML = `<strong>Grupo Ativo:</strong> ${state.config.whatsappTargetGroupName || state.config.whatsappTargetGroupId}`;
    previewLabel.textContent = `Grupo: ${state.config.whatsappTargetGroupName || 'WhatsApp Ativo'}`;
  } else {
    box.textContent = 'Nenhum grupo selecionado ainda.';
    previewLabel.textContent = 'Grupo: Não configurado';
  }
}

// Telegram Config Form & Test
document.getElementById('tg-config-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const botToken = document.getElementById('tg-bot-token').value.trim();
  const chatId = document.getElementById('tg-chat-id').value.trim();

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramBotToken: botToken, telegramChatId: chatId })
    });
    const data = await res.json();
    if (data.success) {
      alert('Configuração do Telegram salva!');
      state.config = data.config;
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  }
});

document.getElementById('btn-test-tg').addEventListener('click', async () => {
  const botToken = document.getElementById('tg-bot-token').value.trim();
  const chatId = document.getElementById('tg-chat-id').value.trim();
  const feedback = document.getElementById('tg-test-feedback');

  if (!botToken) {
    showFeedback(feedback, 'Informe o Bot Token para testar.', 'error');
    return;
  }

  feedback.className = 'feedback-msg';
  feedback.style.display = 'none';

  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, chatId })
    });
    const data = await res.json();
    if (data.success) {
      showFeedback(feedback, `✅ Sucesso! Bot conectado: @${data.result.bot.username}`, 'success');
    } else {
      showFeedback(feedback, 'Falha: ' + data.error, 'error');
    }
  } catch (err) {
    showFeedback(feedback, 'Erro de conexão: ' + err.message, 'error');
  }
});

// Automação & Anti-Ban Form
document.getElementById('automation-config-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    autoDispatchEnabled: document.getElementById('auto-dispatch-toggle').checked,
    dispatchIntervalMinutes: parseInt(document.getElementById('cfg-interval').value) || 40,
    dispatchJitterMinutes: parseInt(document.getElementById('cfg-jitter').value) || 5,
    dispatchStartHour: parseInt(document.getElementById('cfg-start-hour').value) || 9,
    dispatchEndHour: parseInt(document.getElementById('cfg-end-hour').value) || 22,
    defaultHashtags: document.getElementById('cfg-hashtags').value.trim(),
    groupInviteUrl: document.getElementById('cfg-invite-url').value.trim(),
    watermarkText: document.getElementById('cfg-watermark').value.trim()
  };

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showFeedback(document.getElementById('cfg-save-feedback'), 'Configurações de automação salvas!', 'success');
      state.config = data.config;
      updatePreview();
      fetchStatus();
    }
  } catch (err) {
    showFeedback(document.getElementById('cfg-save-feedback'), 'Erro ao salvar: ' + err.message, 'error');
  }
});

// Histórico
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    state.history = data.history || [];

    const tbody = document.getElementById('history-tbody');
    if (state.history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">Nenhum disparo registrado ainda.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.history.map((h) => {
      const date = new Date(h.timestamp).toLocaleString('pt-BR');
      return `
        <tr>
          <td>${date}</td>
          <td><strong>${escapeHtml(h.title || 'Oferta')}</strong></td>
          <td><span style="text-transform:uppercase;font-weight:700;">${h.channel}</span></td>
          <td>${escapeHtml(h.target || '-')}</td>
          <td><span class="badge-status ${h.status === 'success' ? 'enviado' : 'pendente'}">${h.status.toUpperCase()}</span></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Erro ao carregar histórico:', err);
  }
}

// Polling de Status Geral
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    // Counts
    document.getElementById('stat-total').textContent = data.counts.total;
    document.getElementById('stat-sent').textContent = data.counts.sent;
    document.getElementById('pending-badge').textContent = data.counts.pending;

    // WhatsApp Status Pill
    const wppDot = document.getElementById('wpp-dot');
    const wppText = document.getElementById('wpp-status-text');
    const qrBox = document.getElementById('qr-box');
    const qrPlaceholder = document.getElementById('qr-placeholder');
    const qrImage = document.getElementById('qr-image');
    const wppConnectedInfo = document.getElementById('wpp-connected-info');
    const wppBadge = document.getElementById('wpp-connection-badge');

    if (data.whatsapp.status === 'connected') {
      wppDot.className = 'status-dot connected';
      wppText.textContent = `WhatsApp: Conectado (${data.whatsapp.user?.name || 'Sessão Ativa'})`;
      wppBadge.className = 'badge';
      wppBadge.textContent = '🟢 Conectado';
      qrBox.style.display = 'none';
      wppConnectedInfo.style.display = 'block';
      document.getElementById('wpp-user-details').textContent = `Conta conectada: ${data.whatsapp.user?.id || ''}`;
    } else if (data.whatsapp.status === 'waiting_qr' && data.whatsapp.qr) {
      wppDot.className = 'status-dot waiting';
      wppText.textContent = 'WhatsApp: Escaneie o QR Code';
      wppBadge.className = 'badge';
      wppBadge.textContent = '🟡 Aguardando Leitura';
      qrBox.style.display = 'flex';
      qrPlaceholder.style.display = 'none';
      qrImage.src = data.whatsapp.qr;
      qrImage.style.display = 'block';
      wppConnectedInfo.style.display = 'none';
    } else {
      wppDot.className = 'status-dot disconnected';
      wppText.textContent = 'WhatsApp: Desconectado';
      wppBadge.className = 'badge';
      wppBadge.textContent = '🔴 Desconectado';
      qrBox.style.display = 'flex';
      qrPlaceholder.style.display = 'flex';
      qrImage.style.display = 'none';
      wppConnectedInfo.style.display = 'none';
    }

    // Automação Status Pill
    const schedDot = document.getElementById('sched-dot');
    const schedText = document.getElementById('sched-status-text');
    if (data.scheduler.autoDispatchEnabled) {
      schedDot.className = 'status-dot connected';
      schedText.textContent = `Automação: Ativa (${data.scheduler.intervalMinutes}m ± ${data.scheduler.jitterMinutes}m)`;
    } else {
      schedDot.className = 'status-dot paused';
      schedText.textContent = 'Automação: Pausada';
    }

  } catch (err) {
    console.warn('Erro ao verificar status:', err.message);
  }
}

// Inicialização de Dados ao Carregar
async function initApp() {
  try {
    const cfgRes = await fetch('/api/config');
    state.config = await cfgRes.json();

    // Preenche forms com valores da config
    document.getElementById('auto-dispatch-toggle').checked = Boolean(state.config.autoDispatchEnabled);
    document.getElementById('cfg-interval').value = state.config.dispatchIntervalMinutes || 40;
    document.getElementById('cfg-jitter').value = state.config.dispatchJitterMinutes || 5;
    document.getElementById('cfg-start-hour').value = state.config.dispatchStartHour || 9;
    document.getElementById('cfg-end-hour').value = state.config.dispatchEndHour || 22;
    document.getElementById('cfg-hashtags').value = state.config.defaultHashtags || '#anúncio #cacadoresderenda';
    document.getElementById('cfg-invite-url').value = state.config.groupInviteUrl || '';
    document.getElementById('cfg-watermark').value = state.config.watermarkText || 'Tech Ofertas';

    if (state.config.telegramBotToken) {
      document.getElementById('tg-bot-token').value = state.config.telegramBotToken;
      document.getElementById('tg-status-badge').textContent = 'Configurado';
    }
    if (state.config.telegramChatId) {
      document.getElementById('tg-chat-id').value = state.config.telegramChatId;
    }

    updateGroupDisplay();
    updatePreview();
  } catch (err) {
    console.error('Erro na config inicial:', err);
  }

  fetchStatus();
  setInterval(fetchStatus, 4000); // Polling a cada 4 segundos
}

// Helpers
function showFeedback(el, msg, type) {
  el.textContent = msg;
  el.className = `feedback-msg show ${type}`;
  setTimeout(() => {
    el.className = 'feedback-msg';
    el.style.display = 'none';
  }, 6000);
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.addEventListener('DOMContentLoaded', initApp);
