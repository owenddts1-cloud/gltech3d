# 📦 Repositório de Templates n8n — GLTech3D

Esta pasta é o seu diretório dedicado para armazenar, gerenciar e evoluir fluxos de automação do n8n.

---

## 🎯 Como utilizar este diretório com o Agente de IA

Você pode salvar aqui:
1. **Arquivos `.json`:** Copiados direto da área de transferência do n8n ou exportados da ferramenta.
2. **Arquivos `.zip`:** Pacotes completos baixados da comunidade n8n.
3. **Arquivos `.txt` ou `.md`:** Rascunhos, requisitos de novas automações ou fluxos desejados.

Quando você adicionar arquivos nesta pasta, basta me avisar na conversa:
> *"Gemini, adicionei um template chamado `meu-fluxo.json` (ou `.zip`), analise e adapte para o meu CRM / bot de WhatsApp."*

Eu lerei, interpretarei os nós, corrigirei as variáveis e devolverei o JSON pronto e otimizado para colar no n8n.

---

## 📂 Templates Iniciais Inclusos

* `shopee-achadinhos-filtros-avancados.json`: Fluxo especializado da Shopee com os nós de filtro enviados pelo usuário (score de palavras positivas/negativas, preço min/max, comissão mínima e diversificação por categoria anti-flood) com envio para Google Sheets e WhatsApp.
* `achadinhos-multicanal-master.json`: Automação completa (Mercado Livre, Shopee, Amazon, AliExpress) com Cron 2h, mineração/scraping, IA para copy persuasiva e cálculo De/Por, logging em planilha Google Sheets no Drive e envio em loop para grupos de WhatsApp via Evolution API com delay anti-ban.
* `bot-ofertas-evolution.json`: Fluxo profissional de captura de ofertas via Webhook, enriquecimento de copy com IA, rate limiting (anti-banimento) e disparo para Evolution API (WhatsApp) e Telegram.
* `keepalive-monitor.json`: Fluxo leve com trigger Webhook e resposta imediata com timestamp para manutenção contínua 24/7.
