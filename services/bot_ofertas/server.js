require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./src/routes/api');
const whatsapp = require('./src/services/whatsapp');
const scheduler = require('./src/services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use('/api', apiRoutes);

// Rota fallback para o app SPA (compatível com Express 5)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicialização
app.listen(PORT, async () => {
  console.log('====================================================');
  console.log(`🤖 BOT DE OFERTAS PRO INICIADO COM SUCESSO!`);
  console.log(`🌐 Painel Web: http://localhost:${PORT}`);
  console.log(`⚡ WhatsApp: Conectando via Baileys (Zero Docker / Zero VPS)...`);
  console.log('====================================================');

  // Inicializa o agendador anti-ban
  scheduler.startScheduler();

  // Inicia conexão do WhatsApp
  try {
    await whatsapp.initWhatsApp();
  } catch (err) {
    console.warn('[WhatsApp] Inicialização em background aguardando ação no dashboard...');
  }
});
