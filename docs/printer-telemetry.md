# Telemetria de impressoras — como o CRM lê o status

Há **dois caminhos** para o CRM saber o estado da impressora (imprimindo, temperaturas, progresso).
Você escolhe por impressora no campo **Leitura de status** (`poll_mode`).

## 1. PUSH — webhook `print_done` (recomendado p/ produção)

A impressora/host AVISA o CRM quando termina um job. É o mais robusto (funciona mesmo com a
impressora atrás de NAT/LAN, sem o CRM precisar alcançá-la).

- Endpoint: `POST /api/v1/webhooks/printers`.
- **Autenticação — token por organização (recomendado):** em **Impressoras → Token do webhook**
  (só admin), clique em **Gerar token**. É um token de API `dsk_...` com o escopo único
  `printer:webhook`, mostrado **uma vez** (guardamos só o SHA-256). Envie no cabeçalho:
  - `Authorization: Bearer dsk_...` (preferido), ou
  - `X-Webhook-Secret: dsk_...` (para hosts que só deixam configurar esse cabeçalho).

  A organização vem **do token**, não da URL: `?orgId=` é opcional e, se vier, precisa ser a
  mesma org do token (senão `403 org_mismatch`). Um token só grava na org que o emitiu e não
  serve para mais nada (o MCP exige `mcp:read`/`mcp:write`). Revogar na mesma tela corta o
  acesso na hora. O `last_used_at` mostra se a impressora está chamando.
- Credencial **nunca** na query string (`?secret=`/`?token=`): vai parar em logs da Vercel/CDN.
- **Simulador do navegador:** a tela de Impressoras chama o webhook com a sessão do usuário
  logado (org = org ativa).
- **Legado (deprecado):** `X-Webhook-Secret: <PRINTER_WEBHOOK_SECRET>` (env global, >= 8 chars)
  ainda é aceito **só para a org do site** (`GLTECH_ORG_ID`/`GLTECH_ORG_SLUG`, ver
  `lib/marketing/gltech-org.ts`) e loga um aviso de depreciação a cada chamada. Migre para o
  token e apague a env.
- Rate limit: 60 chamadas/min por organização.
- Corpo (JSON): `{ "topic":"print_done", "printer_id":"<client_id ou nome>", "filename":"x.gcode", "weight_grams":45, "print_time_seconds":7200, "filament_id":"<opcional>", "service_order_id":"<uuid opcional>" }`
- Exemplo:

  ```bash
  curl -X POST "https://<seu-dominio>/api/v1/webhooks/printers"     -H "Authorization: Bearer dsk_xxxxxxxx_..."     -H "Content-Type: application/json"     -d '{"printer_id":"ender3","filename":"peca.gcode","weight_grams":42,"print_time_seconds":5400}'
  ```
- Respostas de erro: `401 missing_token|token_not_recognized|token_revoked|token_expired|unauthorized`,
  `403 token_missing_scope|org_mismatch|legacy_secret_site_org_only`, `429 rate_limited`,
  `400 invalid_payload`, `404 printer_not_found`.
- Efeito: baixa o peso do filamento, calcula o **custo real** (material+energia+depreciação), registra o job e marca a impressora ociosa.
- No Klipper, dispare via macro `print_done` + `[gcode_shell_command]`/webhook do Moonraker no fim da impressão.

## 2. PULL — leitura ao vivo por IP (botão "Atualizar status")

O CRM (ou o navegador) CONSULTA a impressora pelo IP. Implementado de forma **genérica**:
tenta **Moonraker** e cai para **OctoPrint**.

- **Moonraker (Klipper)**: `GET <url>/printer/objects/query?extruder&heater_bed&print_stats&display_status` (sem auth por padrão). URL típica: `http://192.168.0.50:7125`.
- **OctoPrint**: `GET <url>/api/printer` + `GET <url>/api/job` com header `X-Api-Key: <sua_key>`. URL típica: `http://192.168.0.50`.

Retorna: estado (printing/paused/idle/error), temperatura do bico e da mesa, progresso e arquivo.

### Modos (`poll_mode`)

- **`browser` (LAN)** — o **navegador** da oficina faz o `fetch` direto na impressora. Necessário
  porque o servidor na nuvem (Vercel) NÃO alcança IPs de LAN `192.168.x.x`. Requer **CORS**:
  - Moonraker: em `moonraker.conf` → `[authorization]` → `cors_domains: *` (ou o domínio do CRM).
  - OctoPrint: habilitar CORS nas configurações + usar a API key.
- **`server` (IP público/túnel)** — o **servidor** faz a leitura (server action `fetchPrinterLiveStatus`).
  Só funciona se a impressora for acessível pela internet (IP público, Cloudflare Tunnel, ngrok).
  Tem timeout curto e **guard SSRF** (só http/https; bloqueia metadata de nuvem).
- **`off`** — desliga a leitura por IP (fica só com o PUSH).

O status lido atualiza o card automaticamente, **exceto** quando você marcou a máquina como
**"Em manutenção"** à mão — nesse caso o manual vence e a telemetria não sobrescreve.

## Arquivos

- Parser puro (testado): `lib/printers/live-status.ts` (`parseMoonraker` / `parseOctoPrint`).
- Leitura pelo navegador: `lib/printers/browser-poll.ts`.
- Leitura pelo servidor: `app/actions/printers/live-status.ts`.
- Webhook PUSH: `app/api/v1/webhooks/printers/route.ts`.
- Validação do token (compartilhada com o MCP): `lib/auth/api-token.ts`.
- Card de token: `components/printers/PrinterWebhookTokenCard.tsx` (renderizado em `app/app/(pro)/printers/page.tsx`).
