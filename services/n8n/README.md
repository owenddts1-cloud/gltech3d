# 🤖 Central de Automações n8n — GLTech3D

Esta pasta centraliza toda a infraestrutura, credenciais, templates de fluxos e documentação de integração entre o **CRM GLTech3D**, o serviço **n8n na nuvem (Render)** e o banco de dados dedicado **Supabase**.

---

## 📌 Visão Geral da Arquitetura

* **Plataforma n8n:** Web Service hospedado no Render ([n8n-636f.onrender.com](https://n8n-636f.onrender.com))
* **Workflow Ativo:** [3B6VULNjIV9yKeQQ](https://n8n-636f.onrender.com/workflow/3B6VULNjIV9yKeQQ)
* **Banco de Dados Dedicado:** Supabase PostgreSQL (pooler em `aws-1-us-west-2.pooler.supabase.com`)
* **Manutenção Keep-Alive 24/7:** Webhook disparado a cada 5 minutos pelo [cron-job.org](https://console.cron-job.org/jobs/8619437)
* **URL do Webhook Keep-Alive:** `https://n8n-636f.onrender.com/webhook/a7a52aba-ec0b-4c3c-a75a-4e9c65d6b123`

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

## 🔐 Correção Definitiva do Erro: `signing.hmac cannot be read with this instance encryption key`

### Por que esse erro aconteceu?
No plano gratuito do Render, o disco do container é **efêmero** (ele é destruído e recriado a cada deploy ou reinicialização).
1. No primeiro deploy, o n8n gerou uma chave aleatória temporária e salvou em `/home/node/.n8n/config`. Ele conectou no Supabase e criptografou a chave interna do sistema (`signing.hmac`) com essa chave.
2. Quando o Render reiniciou após a alteração de variáveis, o container foi recriado e aquela chave temporária sumiu.
3. O n8n gerou uma **nova** chave aleatória no boot, tentou ler o Supabase e falhou porque a chave não batia com a anterior. Isso causou o crash imediato (`Exited with status 1`) e a página ficou exibindo `502 Bad Gateway`.

---

### Solução Passo a Passo (2 Minutos):

#### 1. Definir a Chave Fixa no Render (Environment Variables):
No painel do Render > Web Service `n8n` > aba **Environment**:
* Adicione a variável:
  * **Key:** `N8N_ENCRYPTION_KEY`
  * **Value:** `9a7f3c1b8e4d206f5a3b7c9e1f4a8b2d`
* Salve as alterações. Com isso, o Render **nunca mais** vai gerar chaves aleatórias no boot!

#### 2. Resetar o Schema no Supabase (Elimina a chave antiga corrompida):
Como esse Supabase é exclusivo para o n8n e foi criado do zero:
1. Abra o painel do Supabase no projeto `n8n's Project`.
2. No menu lateral esquerdo, clique no ícone **SQL Editor** (`>_`).
3. Clique em **New query**, cole o código abaixo e clique em **Run**:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   GRANT ALL ON SCHEMA public TO postgres;
   GRANT ALL ON SCHEMA public TO public;
   ```
4. O Supabase limpa o schema `public` em 1 segundo.

#### 3. Fazer Deploy no Render:
No painel do Render, vá em **Manual Deploy** > **Deploy latest commit** (ou aguarde o redeploy automático após salvar a variável `N8N_ENCRYPTION_KEY`).
* O n8n iniciará, detectará a chave fixa `N8N_ENCRYPTION_KEY`, recriará as tabelas no Supabase limpo e ficará **Live** na porta 5678!
* O erro `502 Bad Gateway` desaparecerá e seu n8n voltará a funcionar imediatamente.

---

### Dúvida sobre a Porta no Render Settings:
Você **não precisa alterar nada na aba Settings sobre porta**!  
Como a variável `PORT=5678` já está configurada nas *Environment Variables*, o Render detecta e roteia automaticamente o tráfego HTTPS para a porta `5678`. O único motivo de dar 502 era o container que estava crashando antes de conseguir subir.

---

## 🔑 Ativação da Licença do n8n

Sua chave de licença enviada por e-mail:
`855e3a57-bbe3-4eed-adee-35d59d1db721`

### Como ativar:
1. **Via Interface Web (Mais Rápido):**
   * Abra o n8n: [https://n8n-636f.onrender.com/](https://n8n-636f.onrender.com/)
   * Vá em **Settings** (engrenagem no canto inferior esquerdo) > **Usage and plan** (ou **License**).
   * Cole a chave `855e3a57-bbe3-4eed-adee-35d59d1db721` no campo de ativação e clique em **Activate**.
2. **Via Variável no Render (Persistente):**
   * Em Render > `n8n` > **Environment**, adicione:
     * **Key:** `N8N_LICENSE_ACTIVATION_KEY`
     * **Value:** `855e3a57-bbe3-4eed-adee-35d59d1db721`

---

## 📲 Como Subir a Evolution API no Render Conectada ao Supabase

A Evolution API conectada ao seu Supabase **garante que as sessões do WhatsApp nunca desloguem**, mesmo que o Render reinicie.

### 1. Criar o Web Service no Render:
1. No painel do Render, clique em **+ New** > **Web Service**.
2. Selecione **"Deploy an existing image from a registry"**.
3. Em **Image URL**, digite: `atendai/evolution-api:v2.1.2` e clique em **Next**.
4. Configure os campos:
   * **Name:** `evolution-api-gltech`
   * **Region:** Oregon (US West) ou a mesma do seu Supabase
   * **Instance Type:** Free

### 2. Variáveis de Ambiente no Render (Environment):
Adicione as seguintes variáveis na aba **Environment**:

| KEY | VALUE |
|---|---|
| `SERVER_URL` | `https://evolution-api-gltech.onrender.com` (a URL do seu serviço no Render) |
| `AUTHENTICATION_API_KEY` | `gltech_evolution_secret_key_2026` (sua chave secreta) |
| `DATABASE_ENABLED` | `true` |
| `DATABASE_PROVIDER` | `postgresql` |
| `DATABASE_CONNECTION_URI` | `postgresql://postgres.plfwkvnhhhjnqrmrlbzl:Guidata%404834@aws-1-us-west-2.pooler.supabase.com:5432/postgres?schema=evolution&sslmode=require` |
| `DATABASE_CONNECTION_CLIENT_NAME` | `evolution_api` |
| `PORT` | `8080` |

> ⚠️ **Atenção sobre o Schema Isolado:** Adicionamos `?schema=evolution` para isolar as tabelas da Evolution API das tabelas do n8n (que rodam no schema `public`). Antes de iniciar, execute no SQL Editor do Supabase:
> ```sql
> CREATE SCHEMA IF NOT EXISTS evolution;
> GRANT ALL ON SCHEMA evolution TO postgres;
> GRANT ALL ON SCHEMA evolution TO public;
> ```

### 3. Conectar seu WhatsApp via QR Code:
1. Assim que a Evolution API ficar **Live**, acesse o painel ou envie um POST para `/instance/create` com o nome `gltech_ofertas`.
2. Escaneie o QR Code no seu celular (WhatsApp > Aparelhos Conectados).
3. A sessão será salva diretamente na tabela do Supabase e o n8n poderá disparar mensagens de mídia e texto em todos os seus grupos!

---

## 📊 Estrutura da Planilha Google Sheets (`Achadinhos shoope`)

Para usar o template master com o Google Sheets, crie a planilha no Google Drive com a aba `produtos` e as colunas exatas:

```text
Nome Produto | Imagem Produto | preco | link_produtos_afiliado | titulo_produto | mensagem | Plataforma | Status_Meta
```

* `Nome Produto`: Título completo do produto
* `Imagem Produto`: URL da imagem CDN em alta resolução
* `preco`: Valor promocional numérico (ex: `19.7`)
* `link_produtos_afiliado`: Link parametrizado com a sua tag de afiliado
* `titulo_produto`: Nome resumido
* `mensagem`: Copy persuasiva gerada pela OpenAI / ChatGPT com emojis, tópicos de benefícios e gatilhos de escassez
* `Plataforma`: `Shopee`, `Mercado Livre`, `Amazon` ou `AliExpress`
* `Status_Meta`: Inicialmente `Pendente` (depois atualizado para `Publicado` pelo fluxo do Instagram/Facebook)
