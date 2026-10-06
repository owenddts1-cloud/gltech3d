#!/usr/bin/env node
/**
 * Manda um e-mail real pelo SMTP configurado no .env.local.
 *
 *   node scripts/testar-smtp.mjs                     -> envia para o próprio SMTP_FROM
 *   node scripts/testar-smtp.mjs alguem@exemplo.com  -> envia para outro destinatário
 *
 * "Parece configurado" não prova nada: senha errada, remetente não verificado e
 * porta bloqueada só aparecem quando um e-mail tenta sair. Este script é a prova.
 *
 * Lê o .env.local à mão em vez de usar `dotenv`, que não é dependência do repo.
 * Nunca imprime a senha.
 */
import nodemailer from "nodemailer";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env.local");

function loadEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv();
const host = env.SMTP_HOST;
const port = Number(env.SMTP_PORT) || 465;
const user = env.SMTP_USER;
const pass = env.SMTP_PASSWORD;
const from = env.SMTP_FROM || user;

const faltando = [
  !host && "SMTP_HOST",
  !user && "SMTP_USER",
  !pass && "SMTP_PASSWORD",
].filter(Boolean);

if (faltando.length) {
  console.error(`Falta preencher no .env.local: ${faltando.join(", ")}`);
  process.exit(1);
}

// Extrai o endereço de "Nome <email>" para usar como destino padrão.
const fromAddress = (from.match(/<([^>]+)>/)?.[1] ?? from).trim();
const to = process.argv[2] || fromAddress;

console.log(`Servidor : ${host}:${port}`);
console.log(`Login    : ${user}`);
console.log(`De       : ${from}`);
console.log(`Para     : ${to}`);
console.log("");

const transport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

try {
  await transport.verify();
  console.log("1. Login no servidor SMTP: OK");
} catch (err) {
  console.error("1. Login no servidor SMTP: FALHOU");
  console.error("   ", err.message);
  const rede = ["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET", "ESOCKET", "ECONNECTION", "EDNS"];
  if (rede.includes(err.code)) {
    // Falha de REDE: a conexão nem chegou ao servidor, a senha não foi testada.
    console.error("\n   Problema de conexão, não de senha. Rode de novo — o servidor tem");
    console.error("   vários endereços e um pode não responder. Se persistir, a porta pode");
    console.error("   estar bloqueada na sua rede: tente SMTP_PORT=2525.");
  } else {
    console.error("\n   Confira SMTP_USER e SMTP_PASSWORD. Na Brevo, o usuário é o 'Login'");
    console.error("   da página SMTP e API (xxxx@smtp-brevo.com), não o seu e-mail.");
  }
  process.exit(1);
}

try {
  const info = await transport.sendMail({
    from,
    to,
    subject: "Teste de envio — GLTech3D",
    text:
      "Se você está lendo isto, o envio de e-mail do GLTech3D está funcionando.\n\n" +
      "Confira se chegou na caixa de entrada ou no spam.",
    html:
      "<p>Se você está lendo isto, o envio de e-mail do <strong>GLTech3D</strong> está funcionando.</p>" +
      "<p>Confira se chegou na caixa de entrada ou no spam.</p>",
  });
  console.log("2. Envio: OK — id", info.messageId);
  console.log(`\nAbra ${to} e confira. Olhe também a pasta de SPAM.`);
} catch (err) {
  console.error("2. Envio: FALHOU");
  console.error("   ", err.message);
  console.error("\n   Na Brevo, isto costuma ser remetente não verificado ou telefone");
  console.error("   da conta ainda não confirmado.");
  process.exit(1);
} finally {
  transport.close();
}
