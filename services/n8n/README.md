# 🤖 Central de Automações n8n — GLTech3D

Esta pasta centraliza toda a infraestrutura, credenciais, templates de fluxos e documentação de integração entre o **CRM GLTech3D**, o serviço **n8n na nuvem (Render)** e o banco de dados dedicado **Supabase**.

---

## 📌 Visão Geral da Arquitetura

* **Plataforma n8n:** Web Service hospedado no Render ([n8n-636f.onrender.com](https://n8n-636f.onrender.com))
* **Workflow Ativo:** [7iua4dTJrDU9QrUd](https://n8n-636f.onrender.com/workflow/7iua4dTJrDU9QrUd)
* **Banco de Dados Dedicado:** Supabase PostgreSQL (pooler em `aws-1-us-west-2.pooler.supabase.com`)
* **Manutenção Keep-Alive 24/7:** Webhook disparado a cada 5 minutos pelo [cron-job.org](https://console.cron-job.org/jobs/8619437)
* **URL do Webhook Keep-Alive:** `https://n8n-636f.onrender.com/webhook/780020eb-c627-4e45-baf1-c046447e5a7b`

---

## 🗄️ Credenciais do Banco de Dados (Supabase n8n)

```env
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=aws-1-us-west-2.pooler.supabase.com
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=postgres
DB_POSTGRESDB_USER=postgres.plfwkvnhhhjnqrmrlbzl
DB_POSTGRESDB_PASSWORD=Guidata@4834
DB_POSTGRESDB_SCHEMA=public
DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false
```

> ⚠️ **Atenção Importante sobre a Porta:**  
> Use a porta **`5432`** (Session Mode) em vez de `6543`. No Supabase, a porta `6543` é do PgBouncer em modo de transação, o que impede o TypeORM do n8n de realizar migrações de esquema e locks na inicialização do container.

---

## 📁 Estrutura de Pastas

```
services/n8n/
├── config.json                     # Dados estruturados de conexão e webhooks
├── README.md                       # Esta documentação
└── templates/                      # PASTA DEDICADA PARA TEMPLATES
    ├── README.md                   # Orientações para soltar arquivos (.json, .zip, .txt)
    ├── bot-ofertas-evolution.json  # Template de Bot de Ofertas para WhatsApp/Telegram
    └── keepalive-monitor.json      # Template do Webhook de Manutenção 24/7
```

---

## 🚀 Como Adicionar Novos Templates para Análise

Coloque qualquer arquivo na pasta [`services/n8n/templates/`](file:///c:/Users/Gui/Documents/GUILHERME/Claude/PROJETOS/gltech3d/services/n8n/templates/):
* **Arquivos `.json`:** Exportações diretas do n8n (podem ser lidos e ajustados pelo assistente).
* **Arquivos `.zip`:** Pacotes de templates compactados (o assistente extrai e organiza os nós).
* **Arquivos `.txt` / `.md`:** Descrições em texto do fluxo que você deseja criar do zero.

---

## 🛠️ Diagnóstico do Erro 502 no Render

Caso a URL do Render retorne `502 Bad Gateway` ou o deploy fique com status `Failed`:

1. **Ajuste da Porta do Banco:** Altere `DB_POSTGRESDB_PORT` de `6543` para `5432` no painel do Render > *Environment*.
2. **Variável SSL:** Adicione `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false` nas Environment Variables do Render para autorizar a conexão TLS do Supabase.
3. **Porta do Web Service:** Em Render > *Settings* > *Port*, certifique-se de que a porta configurada corresponde a `5678` (ou adicione `N8N_PORT=10000` e aponte a porta para 10000).
