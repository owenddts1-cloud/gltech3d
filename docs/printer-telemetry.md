# Telemetria de impressoras — como o CRM lê o status

Há **dois caminhos** para o CRM saber o estado da impressora (imprimindo, temperaturas, progresso).
Você escolhe por impressora no campo **Leitura de status** (`poll_mode`).

## 1. PUSH — webhook `print_done` (recomendado p/ produção)

A impressora/host AVISA o CRM quando termina um job. É o mais robusto (funciona mesmo com a
impressora atrás de NAT/LAN, sem o CRM precisar alcançá-la).

- Endpoint: `POST /api/v1/webhooks/printers?orgId=<ORG>&secret=<PRINTER_WEBHOOK_SECRET>`
- Corpo (JSON): `{ "topic":"print_done", "printer_id":"<client_id ou nome>", "filename":"x.gcode", "weight_grams":45, "print_time_seconds":7200, "filament_id":"<opcional>", "service_order_id":"<uuid opcional>" }`
- Efeito: baixa o peso do filamento, calcula o **custo real** (material+energia+depreciação), registra o job e marca a impressora ociosa.
- Config: variável de ambiente **`PRINTER_WEBHOOK_SECRET`** (>= 8 chars). No Klipper, dispare via macro `print_done` + `[gcode_shell_command]`/webhook do Moonraker no fim da impressão.

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
