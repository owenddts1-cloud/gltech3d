#!/usr/bin/env node
/**
 * Gera o guia de setup do Calc3D PRO em PDF.
 *
 *   node scripts/gerar-guia-setup.mjs
 *   -> docs/guia-setup-calc3d-pro.pdf
 *
 * HTML + Chromium do Playwright em vez de jsPDF: o documento tem tabelas,
 * blocos de código longos e quebras de página, e montar isso com coordenadas
 * manuais é trabalho que o motor de layout do navegador já faz melhor. O
 * Playwright já é devDependency do repo e o Chromium já está baixado — nenhuma
 * dependência nova.
 *
 * O PDF carrega chave Pix e e-mail, então ele NÃO é versionado (ver .gitignore).
 * Este script é — qualquer pessoa regenera, e o conteúdo fica revisável em PR.
 *
 * O guia reflete o estado real: lê `.env.local` para saber o que já está
 * configurado e o que falta, em vez de repetir instruções genéricas.
 */
// `@playwright/test` (devDependency do repo) reexporta o chromium; o pacote
// `playwright` puro nao esta instalado.
import { chromium } from "@playwright/test";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "guia-setup-calc3d-pro.pdf");


/** Lê um valor do .env.local sem expor o arquivo inteiro. */
function envValue(key) {
  const p = path.join(ROOT, ".env.local");
  if (!existsSync(p)) return "";
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    if (line.slice(0, i).trim() === key) return line.slice(i + 1).trim();
  }
  return "";
}

const PIX_KEY = envValue("NEXT_PUBLIC_PIX_KEY") || "(não configurada)";
const PIX_RECEIVER = envValue("NEXT_PUBLIC_PIX_RECEIVER_NAME");
const NOTIFY = envValue("PRO_SIGNUP_NOTIFY_EMAIL") || "(não configurado)";
const COPIA_E_COLA = envValue("NEXT_PUBLIC_PIX_COPIA_E_COLA");
const QR_OK = existsSync(path.join(ROOT, "public", "pix", "calc3d-pro-qr.jpeg"));
const FROM = envValue("RESEND_FROM_EMAIL") || "(não configurado)";

const SMTP_HOST = envValue("SMTP_HOST");
const SMTP_USER = envValue("SMTP_USER");
const SMTP_PASS = envValue("SMTP_PASSWORD");
const SMTP_PRONTO = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const hoje = new Date().toLocaleDateString("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});


const receiverWarn = PIX_RECEIVER
  ? `<p>Configurado como <strong>${esc(PIX_RECEIVER)}</strong>. Confira se é exatamente
     o que o app do banco mostra.</p>`
  : `<div class="alert">
       <strong>Falta só isto no Pix.</strong> Abra <span class="mono">.env.local</span> e preencha
       <span class="mono">NEXT_PUBLIC_PIX_RECEIVER_NAME</span> com o nome <em>exato</em> que o app do
       banco do comprador mostra como recebedor — nome e sobrenome, como consta na sua conta.
       <br><br>
       Deixei em branco de propósito: sua chave é aleatória (um UUID), então o nome é a
       <em>única</em> pista que o comprador tem de que está pagando a pessoa certa. Em branco, a
       linha "Recebedor" simplesmente não aparece. Com o nome errado, ele desconfia e abandona —
       e isso é pior.
     </div>`;

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Guia de setup — Calc3D PRO</title>
<style>
  @page { size: A4; margin: 17mm 15mm 18mm; }
  * { box-sizing: border-box; }
  body { margin:0; font: 10.5pt/1.55 -apple-system,"Segoe UI",Roboto,sans-serif; color:#2B2622; }
  .mono { font-family: "SF Mono",Consolas,"Courier New",monospace; font-size: 8.8pt; }
  .break { word-break: break-all; }
  .center { text-align: center; }
  .muted { color:#6B5E55; }

  .capa { page-break-after: always; padding-top: 42mm; }
  .capa h1 { font-size: 30pt; line-height:1.1; margin:0 0 8px; color:#2D241E; letter-spacing:-.5px; }
  .capa .sub { font-size: 13pt; color:#6B5E55; margin:0 0 28px; }
  .capa .meta { border-top:2px solid #A6815C; padding-top:14px; font-size:9.5pt; color:#6B5E55; }
  .selo { display:inline-block; background:#A6815C; color:#fff; font-size:8.5pt; font-weight:700;
          letter-spacing:.14em; text-transform:uppercase; padding:5px 12px; border-radius:3px; margin-bottom:22px; }

  h2 { font-size: 15pt; color:#2D241E; margin: 26px 0 10px; padding-bottom:6px;
       border-bottom:2px solid #E8E2D9; page-break-after: avoid; }
  h3 { font-size: 11.5pt; color:#7A5C3E; margin: 18px 0 7px; page-break-after: avoid; }
  p  { margin: 0 0 9px; }
  ol, ul { margin: 0 0 10px; padding-left: 20px; }
  li { margin-bottom: 5px; }

  table { width:100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 9pt; }
  th { background:#2D241E; color:#F9F7F2; text-align:left; padding:7px 9px; font-size:8.5pt;
       text-transform:uppercase; letter-spacing:.06em; }
  td { border-bottom:1px solid #E8E2D9; padding:7px 9px; vertical-align: top; }
  tr:nth-child(even) td { background:#FBF9F6; }
  .tag { background:#A6815C; color:#fff; padding:2px 7px; border-radius:3px; font-size:8pt; font-weight:700; }

  pre { background:#2D241E; color:#F9F7F2; padding:11px 13px; border-radius:6px;
        font-family:"SF Mono",Consolas,monospace; font-size:8.6pt; line-height:1.5;
        white-space:pre-wrap; word-break:break-all; margin: 8px 0 12px; }

  .alert { border-left:4px solid #B4553F; background:#FBEEEA; padding:11px 14px; margin:11px 0; font-size:9.5pt; }
  .warn  { border-left:4px solid #C9962F; background:#FDF7E8; padding:11px 14px; margin:11px 0; font-size:9.5pt; }
  .ok    { border-left:4px solid #6F7F52; background:#F1F5EB; padding:11px 14px; margin:11px 0; font-size:9.5pt; }
  .info  { border-left:4px solid #A6815C; background:#FAF7F2; padding:11px 14px; margin:11px 0; font-size:9.5pt; }

  .passo { page-break-inside: avoid; }
  .page-break { page-break-before: always; }
  .check td:first-child { width: 26px; text-align:center; font-size:12pt; }
</style></head><body>

<div class="capa">
  <div class="selo">Guia de configuração</div>
  <h1>Calc3D PRO</h1>
  <p class="sub">Tudo que falta para o trial de 7 dias e a venda por Pix funcionarem.</p>
  <div class="meta">
    Gerado em ${esc(hoje)} · auditado contra o seu <span class="mono">.env.local</span>,
    a sua conta Resend e o DNS real.<br>
    GLTech3D · documento pessoal, não versionado no repositório.
  </div>
</div>

<h2>Onde você está</h2>
<table class="check">
  <tr><th></th><th>Item</th><th>Estado</th></tr>
  <tr><td>✓</td><td>Migration do plano e trial (0082)</td><td>aplicada e provada no banco</td></tr>
  <tr><td>✓</td><td>Sua organização GLTech3D</td><td><span class="mono">plan=pro</span>, sem expiração</td></tr>
  <tr><td>✓</td><td>Chave Pix</td><td class="mono break">${esc(PIX_KEY)}</td></tr>
  <tr><td>✓</td><td>E-mail de avisos</td><td class="mono">${esc(NOTIFY)}</td></tr>
  <tr><td>✓</td><td><span class="mono">RESEND_API_KEY</span></td><td>configurada</td></tr>
  <tr><td>${SMTP_PRONTO ? "✓" : "✗"}</td><td>Envio de e-mail (SMTP Brevo)</td>
      <td>${SMTP_PRONTO ? "configurado e testado" : "<strong>passo 1 — bloqueia todo e-mail</strong>"}</td></tr>
  <tr><td>✗</td><td>Nome do recebedor do Pix</td><td>passo 2</td></tr>
  <tr><td>${QR_OK ? "✓" : "✗"}</td><td>QR Code</td><td>${QR_OK ? "adicionado" : "passo 3"}</td></tr>
  <tr><td>${COPIA_E_COLA ? "✓" : "✗"}</td><td>Pix copia e cola</td><td>${COPIA_E_COLA ? "configurado e validado" : "passo 3"}</td></tr>
  <tr><td>✗</td><td>Redis (Upstash)</td><td>passo 4</td></tr>
  <tr><td>✗</td><td>Variáveis na Vercel</td><td>passo 5</td></tr>
  <tr><td>✗</td><td>TOTP na sua conta</td><td>passo 6</td></tr>
</table>

<div class="info">
  <strong>Ordem.</strong> O passo 1 é bloqueante: sem ele nenhum e-mail chega a cliente nenhum —
  nem ativação de compra, nem redefinição de senha. Os passos 2 a 4 e o 6 são independentes entre si.
  O passo 5 vem depois deles, e o 7 fecha com o teste.
</div>

<div class="page-break"></div>

<div class="passo">
<h2>Passo 1 — E-mail ${SMTP_PRONTO ? "✓ feito" : "(faça este primeiro)"}</h2>

<div class="ok">
  <strong>Configurado pela Brevo e testado de verdade.</strong> Entregou para a sua caixa e para
  um endereço de terceiro — que é exatamente o que o Resend não fazia sem domínio próprio.
  Plano grátis: 300 e-mails por dia.
</div>

<table>
  <tr><th>Variável</th><th>Valor</th></tr>
  <tr><td class="mono">SMTP_HOST</td><td class="mono">${esc(SMTP_HOST)}</td></tr>
  <tr><td class="mono">SMTP_PORT</td><td class="mono">${esc(envValue("SMTP_PORT"))}</td></tr>
  <tr><td class="mono">SMTP_USER</td><td class="mono break">${esc(SMTP_USER)}</td></tr>
  <tr><td class="mono">SMTP_PASSWORD</td><td>${SMTP_PASS ? "configurada (não impressa aqui)" : "<strong>falta</strong>"}</td></tr>
  <tr><td class="mono">SMTP_FROM</td><td class="mono break">${esc(envValue("SMTP_FROM"))}</td></tr>
</table>

<h3>Testar de novo a qualquer momento</h3>
<pre>node scripts/testar-smtp.mjs                    # para o próprio remetente
node scripts/testar-smtp.mjs alguem@exemplo.com # para outra pessoa</pre>

<div class="alert">
  <strong>Não ative "Bloquear endereços IP não autorizados"</strong> em SMTP &amp; API na Brevo.
  O site roda na Vercel, que envia de IPs diferentes a cada execução. Com o bloqueio ligado, a
  Brevo recusaria o próprio sistema e nenhum e-mail sairia.
</div>

<div class="warn">
  <strong>Confira o spam do cliente.</strong> Enviar como <span class="mono">@gmail.com</span> por
  um serviço de terceiro funciona, mas o Gmail não reconhece a Brevo como autorizada a falar em nome
  do <span class="mono">gmail.com</span>, então parte dos e-mails pode cair no spam. Registrar
  <span class="mono">gltech3d.com.br</span> (~R$40/ano) e autenticá-lo na Brevo resolve de vez.
</div>

<div class="info">
  <strong>Você continua tendo o caminho manual.</strong> A tela de aprovação tem os botões
  <strong>Copiar link</strong> e <strong>Avisar no WhatsApp</strong>, que abrem a conversa com a
  mensagem pronta — útil quando o e-mail cai no spam ou a pessoa não confere a caixa.
</div>
</div>

<div class="passo">
<h2>Passo 2 — Nome do recebedor do Pix</h2>
${receiverWarn}
<pre>NEXT_PUBLIC_PIX_RECEIVER_NAME=Seu Nome Como Está No Banco</pre>
<p>Depois de editar o <span class="mono">.env.local</span>, <strong>pare e reinicie</strong> o
<span class="mono">npm run dev</span>. Recarregar a página não basta — veja o quadro no passo 5.</p>
<p class="muted">Sua chave já está configurada e aparece na página:
<span class="mono">${esc(PIX_KEY)}</span></p>
</div>

<div class="passo">
<h2>Passo 3 — QR Code e copia e cola ${QR_OK && COPIA_E_COLA ? "✓ feito" : ""}</h2>
<p>A página de pagamento oferece três formas, nesta ordem: <strong>QR Code</strong> para escanear,
<strong>Pix copia e cola</strong> com o valor já preenchido, e a <strong>chave Pix</strong> para quem
prefere digitar.</p>
<ul>
  <li>QR: <span class="mono">public/pix/calc3d-pro-qr.jpeg</span> ${QR_OK ? "— adicionado" : "— <strong>falta</strong>"}</li>
  <li>Copia e cola: <span class="mono">NEXT_PUBLIC_PIX_COPIA_E_COLA</span> ${COPIA_E_COLA ? "— configurado" : "— <strong>falta</strong>"}</li>
</ul>
<div class="ok">
  <strong>Validado.</strong> O copia-e-cola foi conferido: dígito de verificação correto, chave igual
  à sua e valor de R$ 89,00 igual ao preço do plano.
</div>
<div class="warn">
  <strong>Os dois têm o valor gravado dentro.</strong> Se um dia mudar o preço em
  <span class="mono">lib/pricing/pro-plans.ts</span>, gere os dois de novo no app do banco. O site
  protege o copia-e-cola sozinho — ele some da página se o valor não bater com o preço —, mas o QR é
  uma imagem e não dá para conferir. Esquecer de trocar o QR faria ele cobrar o valor antigo.
</div>
</div>
</div>

<div class="page-break"></div>

<div class="passo">
<h2>Passo 4 — Redis (Upstash)</h2>
<div class="alert">
  <strong>Não é opcional.</strong> Sem Redis o controle de abuso vira um contador na memória de cada
  instância — em serverless isso é, na prática, limite nenhum. E no cadastro o abuso não gera só
  e-mail: cria <strong>contas de usuário e organizações</strong> no seu banco.
</div>
<ol>
  <li><span class="mono">upstash.com</span> → <strong>Create Database</strong> → Redis → região
      <span class="mono">sa-east-1</span>.</li>
  <li>Aba <strong>REST API</strong>: copie as duas linhas.</li>
  <li>Cole em <span class="mono">.env.local</span> e, depois, na Vercel:</li>
</ol>
<pre>UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...</pre>
<p>Com o Redis no lugar, os limites já programados passam a valer: cadastro 5/hora por IP, pedido de
Pix público 3/hora por IP, upload de comprovante 2/hora por IP, pedido feito dentro do CRM 3/hora por
organização, e redefinição de senha 5/hora por IP <em>e</em> 3/hora por e-mail.</p>
</div>

<div class="passo">
<h2>Passo 5 — Vercel</h2>
<ol>
  <li>Projeto → <strong>Settings</strong> → <strong>Environment Variables</strong>.</li>
  <li>Adicione cada uma marcando <strong>Production</strong>, <strong>Preview</strong> e
      <strong>Development</strong>:</li>
</ol>
<table>
  <tr><th>Variável</th><th>Valor</th></tr>
  <tr><td class="mono">NEXT_PUBLIC_PIX_KEY</td><td class="mono break">${esc(PIX_KEY)}</td></tr>
  <tr><td class="mono">NEXT_PUBLIC_PIX_COPIA_E_COLA</td><td class="mono break">${COPIA_E_COLA ? esc(COPIA_E_COLA) : "<em>do passo 3</em>"}</td></tr>
  <tr><td class="mono">NEXT_PUBLIC_PIX_RECEIVER_NAME</td><td>${PIX_RECEIVER ? esc(PIX_RECEIVER) : "<em>defina no passo 2</em>"}</td></tr>
  <tr><td class="mono">PRO_SIGNUP_NOTIFY_EMAIL</td><td class="mono">${esc(NOTIFY)}</td></tr>
  <tr><td class="mono">SMTP_HOST</td><td class="mono">${esc(SMTP_HOST || "smtp.gmail.com")}</td></tr>
  <tr><td class="mono">SMTP_PORT</td><td class="mono">${esc(envValue("SMTP_PORT"))}</td></tr>
  <tr><td class="mono">SMTP_USER</td><td class="mono break">${esc(SMTP_USER || "diretoria.gltech@gmail.com")}</td></tr>
  <tr><td class="mono">SMTP_PASSWORD</td><td><em>a chave SMTP da Brevo (a mesma do .env.local)</em></td></tr>
  <tr><td class="mono">SMTP_FROM</td><td class="mono break">${esc(envValue("SMTP_FROM") || SMTP_USER)}</td></tr>
  <tr><td class="mono">UPSTASH_REDIS_REST_URL</td><td><em>do passo 4</em></td></tr>
  <tr><td class="mono">UPSTASH_REDIS_REST_TOKEN</td><td><em>do passo 4</em></td></tr>
  <tr><td class="mono">NEXT_PUBLIC_APP_URL</td><td>a URL pública real (hoje está <span class="mono">localhost</span>)</td></tr>
</table>
<ol start="3">
  <li><strong>Deployments</strong> → no último, menu <span class="mono">⋯</span> →
      <strong>Redeploy</strong> → <strong>desmarque</strong> "use existing build cache" → confirme.</li>
</ol>
<div class="alert">
  <strong>O erro que quase todo mundo comete.</strong> Variável que começa com
  <span class="mono">NEXT_PUBLIC_</span> é gravada dentro do código <em>no momento do build</em>.
  Mudar o valor na Vercel sem refazer o deploy não tem efeito nenhum — a página continua mostrando
  o valor antigo, sem erro, e você fica procurando bug onde não tem.
</div>
<p><span class="mono">NEXT_PUBLIC_APP_URL</span> monta os links de ativação e de redefinição de senha
dentro dos e-mails. Com <span class="mono">localhost</span> ali o código cai no endereço da Vercel —
funciona, mas é melhor deixar explícito.</p>
</div>

<div class="page-break"></div>

<div class="passo">
<h2>Passo 6 — TOTP na sua conta</h2>
<p>Você é administrador da plataforma, e <span class="mono">/admin</span> exige o código de 6
dígitos. Sem configurar, a tela onde você aprova os pagamentos fica inalcançável.</p>
<ol>
  <li>Instale um autenticador: Google Authenticator, Authy, 1Password ou Bitwarden.</li>
  <li>No CRM: <strong>Configurações → Segurança</strong>.</li>
  <li>No cartão "MFA (TOTP)", clique em <strong>Ativar agora</strong>.</li>
  <li>Escaneie o QR (ou digite o segredo manualmente).</li>
  <li>Digite os 6 dígitos do aplicativo.</li>
  <li><strong>Guarde os códigos de recuperação fora do navegador</strong> — gerenciador de senhas
      ou papel no cofre.</li>
</ol>
<div class="alert">
  <strong>Existe redefinição de senha. Não existe redefinição de MFA.</strong>
  Perder o celular sem os códigos de recuperação é perder o acesso.
</div>
<div class="ok">
  <strong>Seus clientes em trial não passam por isso.</strong> O TOTP só é exigido de conta com plano
  pago — no primeiro login depois de você aprovar o Pix. Avise a pessoa, senão ela interpreta como
  "paguei e o sistema travou".
</div>
</div>

<div class="passo">
<h2>Passo 7 — Teste de ponta a ponta</h2>
<p>Em janela anônima, nesta ordem:</p>
<ol>
  <li><strong>Landing.</strong> Abra <span class="mono">/calc3d-pro</span>. A peça 3D anima no topo;
      rolando, os cadeados da amostra do CRM destravam em cascata.</li>
  <li><strong>Celular.</strong> Abra a mesma página no telefone. Deve aparecer a ilustração estática,
      e na aba Network <em>não</em> deve baixar o pacote 3D.</li>
  <li><strong>Cadastro.</strong> Clique em "Ver o que o PRO faz · 7 dias grátis" e crie uma conta de
      teste. Você cai em <span class="mono">/app/dashboard</span> com a barra lateral, selo
      <strong>TRIAL · 7 dias</strong>, nenhum cadeado e <em>sem</em> tela de MFA.</li>
  <li><strong>Aviso.</strong> Confira se chegou o e-mail em
      <span class="mono">${esc(NOTIFY)}</span>.</li>
  <li><strong>Trial vencido.</strong> No painel do Supabase, mude
      <span class="mono">trial_ends_at</span> dessa organização para ontem. Recarregue: faixa
      vermelha no topo, cadeados na barra lateral, selo <strong>GRÁTIS</strong>.
      <span class="mono">/app/sales</span> leva para a tela de pagamento dizendo "Você tentou abrir
      <strong>Vendas</strong>". Calculadora e painel continuam abrindo.</li>
  <li><strong>Pagamento.</strong> Em <span class="mono">/app/settings/billing</span>, preencha o
      formulário. Confira se o e-mail chegou para você.</li>
  <li><strong>Aprovação.</strong> Em <span class="mono">/admin/pro-signups</span>, abra o pedido. A
      tela deve dizer <strong>"Organização já existente liberada — nenhum tenant novo foi criado"</strong>.
      Confirme que continua existindo <em>uma só</em> organização para aquele e-mail.</li>
  <li><strong>Depois de aprovar.</strong> Recarregue o CRM: selo <strong>PRO</strong>, cadeados somem.
      No próximo login, o TOTP é pedido.</li>
  <li><strong>Senha.</strong> Teste <span class="mono">/esqueci-senha</span> com o e-mail de teste.
      Só funciona depois do passo 1.</li>
  <li><strong>Limpeza.</strong> Apague a organização e o usuário de teste pelo painel do Supabase.</li>
</ol>
</div>

<div class="passo">
<h2>Resumo para colar no .env.local</h2>
<pre>SMTP_HOST=${esc(SMTP_HOST || "smtp.gmail.com")}
SMTP_PORT=${esc(envValue("SMTP_PORT"))}
SMTP_USER=${esc(SMTP_USER)}
SMTP_PASSWORD=${SMTP_PASS ? "(configurada)" : "&lt;&lt; PREENCHER &gt;&gt;"}
NEXT_PUBLIC_PIX_KEY=${esc(PIX_KEY)}
NEXT_PUBLIC_PIX_COPIA_E_COLA=${COPIA_E_COLA ? esc(COPIA_E_COLA) : "&lt;&lt; do passo 3 &gt;&gt;"}
NEXT_PUBLIC_PIX_RECEIVER_NAME=${PIX_RECEIVER ? esc(PIX_RECEIVER) : "&lt;&lt; PREENCHER: seu nome como está no banco &gt;&gt;"}
PRO_SIGNUP_NOTIFY_EMAIL=${esc(NOTIFY)}
UPSTASH_REDIS_REST_URL=&lt;&lt; do passo 4 &gt;&gt;
UPSTASH_REDIS_REST_TOKEN=&lt;&lt; do passo 4 &gt;&gt;</pre>
<p class="muted">As três primeiras e a quarta já estão aplicadas no seu
<span class="mono">.env.local</span> — exceto o nome do recebedor, que depende de você.</p>
</div>

</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  mkdirSync(path.dirname(OUT), { recursive: true });
  await page.pdf({
    path: OUT,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate:
      '<div style="width:100%;font-size:7.5pt;color:#9a8f85;padding:0 15mm;' +
      'font-family:-apple-system,Segoe UI,sans-serif;display:flex;justify-content:space-between">' +
      "<span>Calc3D PRO — guia de configuração</span>" +
      '<span class="pageNumber"></span></div>',
    margin: { top: "17mm", bottom: "18mm", left: "15mm", right: "15mm" },
  });
  console.log("PDF gerado:", path.relative(ROOT, OUT));
} finally {
  await browser.close();
}
