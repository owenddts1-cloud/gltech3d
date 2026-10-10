const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../data');
const OFFERS_FILE = path.join(DATA_DIR, 'offers.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// Garante que o diretório de dados existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_CONFIG = {
  whatsappTargetGroupId: '',
  whatsappTargetGroupName: '',
  telegramBotToken: '',
  telegramChatId: '',
  autoDispatchEnabled: false,
  dispatchIntervalMinutes: 10,
  dispatchJitterMinutes: 3,
  minIntervalMinutes: 2,
  maxIntervalMinutes: 15,
  recycleMode: true,
  welcomeMessageEnabled: true,
  welcomeGroupName: 'GLTech Ofertas - Impressão 3D',
  nicheGroups: {
    impressao_3d: {
      whatsappJid: '',
      whatsappName: 'GLTech Ofertas - Impressão 3D',
      telegramChatId: ''
    },
    ferramentas: {
      whatsappJid: '',
      whatsappName: 'GLTech Ofertas - Ferramentas & Oficina',
      telegramChatId: ''
    },
    eletronicos: {
      whatsappJid: '',
      whatsappName: 'GLTech Ofertas - Smart Home & Tech',
      telegramChatId: ''
    }
  },
  marketplacesCouponHubs: {
    mercadolivre: 'https://www.mercadolivre.com.br/cupons',
    shopee: 'https://shopee.com.br/m/cupons-diarios',
    amazon: 'https://www.amazon.com.br/cupom',
    aliexpress: 'https://best.aliexpress.com',
    tiktok: 'https://www.tiktok.com'
  },
  dispatchStartHour: 9,
  dispatchEndHour: 23,
  defaultHashtags: '#anúncio #cacadoresderenda #GLTech3D',
  groupInviteUrl: '',
  watermarkText: 'GLTech3D'
};

function readJsonFile(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Erro ao ler ${filePath}:`, err.message);
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Erro ao salvar ${filePath}:`, err.message);
    return false;
  }
}

// Config
function getConfig() {
  const cfg = readJsonFile(CONFIG_FILE, DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG, ...cfg };
}

function saveConfig(newConfig) {
  const current = getConfig();
  const merged = { ...current, ...newConfig };
  writeJsonFile(CONFIG_FILE, merged);
  return merged;
}

// Ofertas
function getOffers() {
  return readJsonFile(OFFERS_FILE, []);
}

function saveOffers(offers) {
  return writeJsonFile(OFFERS_FILE, offers);
}

function addOffer(offerData) {
  const offers = getOffers();
  const newOffer = {
    id: 'off_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    title: offerData.title || '',
    category: offerData.category || 'Geral',
    niche: offerData.niche || 'impressao_3d',
    marketplace: offerData.marketplace || 'mercadolivre',
    originalPrice: parseFloat(offerData.originalPrice) || 0,
    promoPrice: parseFloat(offerData.promoPrice) || 0,
    coupon: offerData.coupon || '',
    couponHubUrl: offerData.couponHubUrl || '',
    copyStyle: offerData.copyStyle || 'padrao',
    affiliateUrl: offerData.affiliateUrl || '',
    imageUrl: offerData.imageUrl || '',
    status: offerData.status || 'pendente', // pendente, enviado, pausado, esgotado
    recycledCount: 0,
    createdAt: new Date().toISOString(),
    dispatchedAt: null,
    lastDispatchedAt: null
  };
  offers.push(newOffer);
  saveOffers(offers);
  return newOffer;
}

function updateOffer(id, updates) {
  const offers = getOffers();
  const index = offers.findIndex((o) => o.id === id);
  if (index === -1) return null;
  offers[index] = { ...offers[index], ...updates };
  saveOffers(offers);
  return offers[index];
}

function deleteOffer(id) {
  const offers = getOffers();
  const filtered = offers.filter((o) => o.id !== id);
  saveOffers(filtered);
  return true;
}

function getNextPendingOffer(niche = null) {
  const offers = getOffers();
  if (niche) {
    return offers.find((o) => o.status === 'pendente' && o.niche === niche) || null;
  }
  return offers.find((o) => o.status === 'pendente') || null;
}

function getNextRecycledOffer(niche = null) {
  const offers = getOffers();
  let pool = offers.filter((o) => o.status === 'enviado');
  if (niche) {
    pool = pool.filter((o) => o.niche === niche || !o.niche);
  }
  if (pool.length === 0) return null;

  // Ordena pelo que foi disparado há mais tempo (ou nunca teve lastDispatchedAt)
  pool.sort((a, b) => {
    const timeA = new Date(a.lastDispatchedAt || a.dispatchedAt || a.createdAt).getTime();
    const timeB = new Date(b.lastDispatchedAt || b.dispatchedAt || b.createdAt).getTime();
    return timeA - timeB;
  });

  return pool[0] || null;
}

// Histórico de Disparos
function getHistory() {
  return readJsonFile(HISTORY_FILE, []);
}

function logDispatch(entry) {
  const history = getHistory();
  const logItem = {
    id: 'log_' + Date.now(),
    timestamp: new Date().toISOString(),
    offerId: entry.offerId,
    title: entry.title,
    channel: entry.channel, // 'whatsapp', 'telegram' ou 'ambos'
    target: entry.target,
    status: entry.status, // 'success' ou 'error'
    message: entry.message || ''
  };
  history.unshift(logItem); // mais recente primeiro
  // mantém últimos 500 logs
  if (history.length > 500) history.length = 500;
  writeJsonFile(HISTORY_FILE, history);
  return logItem;
}

// CSV Import/Export Helper
function exportToCsv() {
  const offers = getOffers();
  const headers = ['id', 'title', 'category', 'originalPrice', 'promoPrice', 'coupon', 'affiliateUrl', 'imageUrl', 'status'];
  const rows = [headers.join(';')];

  offers.forEach((o) => {
    const row = headers.map((key) => {
      const val = (o[key] ?? '').toString().replace(/;/g, ',').replace(/\n/g, ' ');
      return `"${val}"`;
    });
    rows.push(row.join(';'));
  });

  return rows.join('\r\n');
}

function importFromCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { count: 0, errors: ['CSV vazio ou sem dados'] };

  const separator = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(separator).map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

  let importedCount = 0;
  const currentOffers = getOffers();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map((c) => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length === 0 || !cols.some((c) => c)) continue;

    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = cols[idx] || '';
    });

    const title = rowObj['title'] || rowObj['titulo'] || rowObj['nome'] || '';
    const affiliateUrl = rowObj['affiliateurl'] || rowObj['link'] || rowObj['link_afiliado'] || rowObj['url'] || '';

    if (title || affiliateUrl) {
      currentOffers.push({
        id: 'off_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        title: title || 'Oferta Sem Título',
        category: rowObj['category'] || rowObj['categoria'] || '3D Printing',
        originalPrice: parseFloat(rowObj['originalprice'] || rowObj['preco_de'] || rowObj['de'] || 0) || 0,
        promoPrice: parseFloat(rowObj['promoprice'] || rowObj['preco_por'] || rowObj['por'] || 0) || 0,
        coupon: rowObj['coupon'] || rowObj['cupom'] || '',
        affiliateUrl: affiliateUrl,
        imageUrl: rowObj['imageurl'] || rowObj['imagem'] || rowObj['foto'] || '',
        status: 'pendente',
        createdAt: new Date().toISOString(),
        dispatchedAt: null
      });
      importedCount++;
    }
  }

  saveOffers(currentOffers);
  return { count: importedCount };
}

module.exports = {
  getConfig,
  saveConfig,
  getOffers,
  saveOffers,
  addOffer,
  updateOffer,
  deleteOffer,
  getNextPendingOffer,
  getNextRecycledOffer,
  getHistory,
  logDispatch,
  exportToCsv,
  importFromCsv
};
