const express = require('express');
const router = express.Router();
const storage = require('../services/storage');
const whatsapp = require('../services/whatsapp');
const telegram = require('../services/telegram');
const scheduler = require('../services/scheduler');
const scraper = require('../services/scraper');
const formatter = require('../services/formatter');

// 1. Status Geral do Sistema
router.get('/status', (req, res) => {
  const wpp = whatsapp.getStatus();
  const sched = scheduler.getSchedulerStatus();
  const config = storage.getConfig();
  const offers = storage.getOffers();

  res.json({
    whatsapp: wpp,
    scheduler: sched,
    config: {
      whatsappTargetGroupId: config.whatsappTargetGroupId,
      whatsappTargetGroupName: config.whatsappTargetGroupName,
      telegramChatId: config.telegramChatId,
      hasTelegramToken: Boolean(config.telegramBotToken)
    },
    counts: {
      total: offers.length,
      pending: offers.filter((o) => o.status === 'pendente').length,
      sent: offers.filter((o) => o.status === 'enviado').length
    }
  });
});

// 2. WhatsApp Controls
router.post('/whatsapp/connect', async (req, res) => {
  try {
    await whatsapp.initWhatsApp(true);
    res.json({ success: true, message: 'Iniciando conexão...' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/whatsapp/logout', async (req, res) => {
  try {
    await whatsapp.logoutWhatsApp();
    res.json({ success: true, message: 'Desconectado com sucesso.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/whatsapp/groups', async (req, res) => {
  try {
    const groups = await whatsapp.refreshGroups();
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Telegram Controls
router.post('/telegram/test', async (req, res) => {
  try {
    const { botToken, chatId } = req.body;
    const result = await telegram.testTelegramConnection(botToken, chatId);
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 4. Ofertas CRUD
router.get('/offers', (req, res) => {
  res.json({ offers: storage.getOffers() });
});

router.post('/offers', (req, res) => {
  try {
    const newOffer = storage.addOffer(req.body);
    res.json({ success: true, offer: newOffer });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/offers/:id', (req, res) => {
  const updated = storage.updateOffer(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Oferta não encontrada' });
  res.json({ success: true, offer: updated });
});

router.delete('/offers/:id', (req, res) => {
  storage.deleteOffer(req.params.id);
  res.json({ success: true });
});

// 5. Disparo Imediato de Oferta
router.post('/offers/:id/dispatch', async (req, res) => {
  const offers = storage.getOffers();
  const offer = offers.find((o) => o.id === req.params.id);
  if (!offer) return res.status(404).json({ error: 'Oferta não encontrada' });

  const { sendWhatsapp, sendTelegram, targetGroupJid } = req.body;

  try {
    const dispatchResult = await scheduler.dispatchOffer(offer, {
      sendWhatsapp: sendWhatsapp !== false,
      sendTelegram: Boolean(sendTelegram),
      targetGroupJid
    });
    res.json(dispatchResult);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Link Scraper Automático
router.post('/offers/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Informe a URL do produto' });

    const data = await scraper.scrapeProductInfo(url);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Preview de Mensagem Formatada
router.post('/offers/preview', (req, res) => {
  const config = storage.getConfig();
  const message = formatter.formatOfferMessage(req.body, {
    defaultHashtags: config.defaultHashtags,
    groupInviteUrl: config.groupInviteUrl
  });
  res.json({ message });
});

// 8. Configurações
router.get('/config', (req, res) => {
  res.json(storage.getConfig());
});

router.post('/config', (req, res) => {
  const updated = storage.saveConfig(req.body);
  res.json({ success: true, config: updated });
});

// 9. Histórico de Disparos
router.get('/history', (req, res) => {
  res.json({ history: storage.getHistory() });
});

// 10. Importação e Exportação CSV
router.get('/csv/export', (req, res) => {
  const csv = storage.exportToCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=ofertas.csv');
  res.send(csv);
});

router.post('/csv/import', (req, res) => {
  const { csvText } = req.body;
  if (!csvText) return res.status(400).json({ error: 'Nenhum conteúdo CSV enviado' });

  const result = storage.importFromCsv(csvText);
  res.json({ success: true, imported: result.count });
});

// 11. Webhook para Integração Externa (n8n, Make.com, Google Sheets)
router.post('/webhook/offer', async (req, res) => {
  try {
    const { title, originalPrice, promoPrice, coupon, affiliateUrl, imageUrl, category, dispatchNow } = req.body;

    const offer = storage.addOffer({
      title,
      originalPrice,
      promoPrice,
      coupon,
      affiliateUrl,
      imageUrl,
      category: category || 'Importado via Webhook'
    });

    if (dispatchNow) {
      await scheduler.dispatchOffer(offer);
    }

    res.json({ success: true, offer, dispatched: Boolean(dispatchNow) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
