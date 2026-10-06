#!/usr/bin/env node
/**
 * Apaga uma conta criada pelos testes de jornada.
 *
 *   node scripts/limpar-conta-teste.mjs diretoria.gltech+teste-123@gmail.com
 *   node scripts/limpar-conta-teste.mjs --todas     (todas as contas +teste)
 *
 * TRAVA: recusa qualquer e-mail sem "+teste". Os testes de jornada rodam contra
 * o banco de PRODUÇÃO, e este script apaga usuário e organização inteira — um
 * e-mail digitado errado não pode levar a conta de um cliente de verdade.
 *
 * Ordem: pedidos -> organização (cascade apaga membership e dados da org) ->
 * usuário do Auth. Mostra a contagem de organizações antes e depois.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const arg = process.argv[2];
if (!arg) {
  console.error("Uso: node scripts/limpar-conta-teste.mjs <email com +teste> | --todas");
  process.exit(1);
}

// Recusa ANTES de abrir qualquer conexão com o banco.
if (arg !== "--todas" && !arg.toLowerCase().includes("+teste")) {
  console.error(`RECUSADO: "${arg}" não tem "+teste". Este script só apaga contas de teste.`);
  process.exit(1);
}

async function todosOsUsuarios() {
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return out;
}

const usuarios = await todosOsUsuarios();
const alvos =
  arg === "--todas"
    ? usuarios.filter((u) => (u.email ?? "").toLowerCase().includes("+teste"))
    : usuarios.filter((u) => (u.email ?? "").toLowerCase() === arg.toLowerCase());

const contar = async () =>
  (await db.from("organizations").select("*", { count: "exact", head: true })).count;

const antes = await contar();
console.log(`Organizações antes: ${antes}`);

if (alvos.length === 0) {
  // Pode haver pedido órfão de uma rodada interrompida.
  if (arg !== "--todas") {
    const { count } = await db.from("pro_signup_requests").delete({ count: "exact" }).eq("buyer_email", arg.toLowerCase());
    console.log(`Nenhum usuário com esse e-mail. Pedidos órfãos apagados: ${count ?? 0}`);
  } else {
    console.log("Nenhuma conta +teste encontrada.");
  }
  process.exit(0);
}

for (const u of alvos) {
  const email = (u.email ?? "").toLowerCase();
  if (!email.includes("+teste")) continue; // trava repetida por segurança

  const { data: mem } = await db.from("user_organizations").select("organization_id").eq("user_id", u.id);
  const orgIds = [...new Set((mem ?? []).map((m) => m.organization_id))];

  const { count: pedidos } = await db.from("pro_signup_requests").delete({ count: "exact" }).eq("buyer_email", email);

  for (const orgId of orgIds) {
    // Só apaga a org se TODOS os membros dela forem contas de teste — nunca a org
    // de um cliente real que, por acaso, tenha um +teste como convidado.
    const { data: membros } = await db.from("user_organizations").select("user_id").eq("organization_id", orgId);
    const ids = (membros ?? []).map((m) => m.user_id);
    const reais = usuarios.filter((x) => ids.includes(x.id) && !(x.email ?? "").toLowerCase().includes("+teste"));
    if (reais.length > 0) {
      console.log(`  org ${orgId} tem membros reais — mantida, só o vínculo do teste sai.`);
      await db.from("user_organizations").delete().eq("organization_id", orgId).eq("user_id", u.id);
      continue;
    }
    const { error } = await db.from("organizations").delete().eq("id", orgId);
    console.log(`  org ${orgId}: ${error ? "ERRO " + error.message : "apagada"}`);
  }

  const { error: userErr } = await db.auth.admin.deleteUser(u.id);
  console.log(`${email}: pedidos=${pedidos ?? 0}, orgs=${orgIds.length}, usuário ${userErr ? "ERRO " + userErr.message : "apagado"}`);
}

console.log(`Organizações depois: ${await contar()}`);
