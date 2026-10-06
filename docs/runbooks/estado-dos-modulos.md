# Estado de cada módulo do CRM

Retrato honesto, tela por tela, do que funciona, do que é parcial e do que é só
demonstração. Serve para decidir o que priorizar e para não prometer ao cliente o que
o sistema ainda não faz. Levantado no código e conferido pela jornada automatizada
(`tests/e2e/calc3d-pro-jornada.spec.ts`) em 2026-10-06 e atualizado em 2026-10-07.

**Legenda**

- **FUNCIONAL**: o cliente cadastra, edita e consulta dados reais de ponta a ponta.
- **PARCIAL**: funciona, mas falta alguma operação básica (editar, excluir...).
- **INTEGRAÇÃO**: depende de um serviço externo configurado para fazer qualquer coisa.
- **DEMONSTRAÇÃO**: tela de prévia, nada é gravado nem enviado. A tela diz isso.

Todas as telas têm guia próprio (`lib/guides/registry.ts`), aberto sozinho na primeira
visita e pelo botão "Guia desta tela".

---

## Produção

| Tela | Estado | Como o cliente cadastra | O que falta |
|---|---|---|---|
| Dashboard | FUNCIONAL (só leitura) | Não cadastra: resume vendas, O.S., impressões | — |
| Projetos | FUNCIONAL | "Novo Projeto Técnico", editar (lápis no card), apagar; notas no "Quadro de Ideias" | — |
| Ordens de Serviço | FUNCIONAL | "Nova OS"; documentos Orçamento / OS / Recibo | — |
| Organização | FUNCIONAL (admin) | Formulário de dados da empresa e documentos | — (salvava zero linhas até 2026-10-06; corrigido e testado) |
| Impressoras & Filamentos | FUNCIONAL; status ao vivo = INTEGRAÇÃO | "Nova Máquina", "Adicionar Carretel" | Status ao vivo exige Moonraker/OctoPrint alcançável. Token de webhook por organização na própria tela |
| Modelagem | FUNCIONAL | Upload de STL/3MF, pastas, versões | — |
| Fatiar | FUNCIONAL (nada é salvo) | Fatia no navegador e baixa o G-code | Tela para configurar o perfil de impressão (hoje só no JSON da org) |
| Calculadora 3D | FUNCIONAL (nada é salvo) | Calcula custo/preço e gera PDF | Salvar o orçamento no CRM |
| Calendário | FUNCIONAL | "Agendar Novo Evento"; "Editar" no detalhe do evento | — |

## Vendas

| Tela | Estado | Como o cliente cadastra | O que falta |
|---|---|---|---|
| Vendas (visão geral) | FUNCIONAL | "Nova venda"; Tabela / Kanban / Timeline | Aba "Docs" da venda é placeholder |
| Shopee / Mercado Livre / Facebook | PARCIAL | Lançamento manual, filtrado por canal | **Integração automática não existe** — nenhuma sincronização de pedidos |
| Produtos | FUNCIONAL | "Nova peça"; custo real e lucro por canal; catálogo em PDF | — |

## Financeiro

| Tela | Estado | Como o cliente cadastra | O que falta |
|---|---|---|---|
| Controle | FUNCIONAL | Lançamentos na planilha; abas personalizadas salvas automaticamente; "Sincronizar" com os módulos | Depende da migration 0086 aplicada |
| Relatórios | FUNCIONAL (só leitura) | Exporta CSV / XLSX / PDF | — |

## Clientes

| Tela | Estado | Como o cliente cadastra | O que falta |
|---|---|---|---|
| Inbox | INTEGRAÇÃO | Conversas chegam pelo WhatsApp conectado | Anexos ("em breve"); exige WAHA |
| Conexões | INTEGRAÇÃO (admin) | "Conectar novo WhatsApp" por QR | WhatsApp precisa estar ativado na conta (WAHA) |
| Contatos | FUNCIONAL | "Novo contato"; Lista / Funil; "Excluir contato" (admin) | Contato com conversa, O.S. ou venda não é apagado — use Anonimizar (LGPD) |
| Equipe | FUNCIONAL | "Convidar membros", trocar papel, revogar | E-mail do convite depende do SMTP/Resend |
| LGPD | FUNCIONAL (por desenho) | Pedidos chegam da aba LGPD do contato ou da Nuvemshop | — |
| Agentes IA | INTEGRAÇÃO (manager+) | "Novo agente" | Exige chave de IA + WhatsApp; o "Testar" é **simulado** enquanto `INTERNAL_AGENT_RUN_STUB=true` (a tela mostra o selo) |

## Suprimentos

| Tela | Estado | Como o cliente cadastra | O que falta |
|---|---|---|---|
| Inventário | FUNCIONAL | "Novo ativo"; aba Consumíveis | — |
| Fornecedores | FUNCIONAL | "Novo Fornecedor" (com edição), "Registrar Compra" | — |

## Outros

| Tela | Estado | Observação |
|---|---|---|
| Assistente IA | redireciona para Agentes IA | — |
| Automações (n8n) | DEMONSTRAÇÃO | Nada roda. Faixa de demonstração na tela |
| Criação de Conteúdo | DEMONSTRAÇÃO | Nada é publicado nem exportado. Faixa de demonstração na tela |
| Landing Edit | FUNCIONAL só para a org do site | Em outra organização edita um catálogo que não está no ar (a tela avisa) |
| Configurações | FUNCIONAL | Notificações e troca de e-mail: "em breve" |
| Segurança | FUNCIONAL | MFA, códigos de recuperação, dispositivos, sessões |
| Plano e cobrança | FUNCIONAL (manual) | Pix declarado pelo cliente, aprovação à mão em `/admin/pro-signups` |

---

## Páginas sem item no menu

`/app/ai/credentials`, `/app/ai/usage`, `/app/ai/knowledge/sources` e
`/app/integrations/nuvemshop` existem mas não aparecem na navegação. As credenciais de
IA são pré-requisito dos Agentes IA — vale um link a partir da tela de Agentes.

## Prioridade sugerida (impacto para quem paga)

1. Integração real com Shopee / Mercado Livre (hoje todo pedido é digitado).
2. Salvar o orçamento da Calculadora no CRM (vira O.S. com um clique).
3. Ativar o motor de IA (tirar o modo simulado) e WhatsApp por cliente.
4. Automações e Criação de Conteúdo: decidir entre implementar ou tirar do menu.

## Console do dono da plataforma (`/admin`)

| Tela | Estado | O que faz |
|---|---|---|
| Assinantes (`/admin/assinantes`) | FUNCIONAL | Lista quem tem trial/PRO/vencido; ficha com plano (definir, +30/+365, remover), papel de cada membro e histórico. Toda ação exige motivo e vai para a auditoria |
| Calc3D PRO (`/admin/pro-signups`) | FUNCIONAL | Pedidos Pix. Também dá para aprovar/recusar pelo botão do e-mail (sem login; ver `calc3d-pro-liberacao.md`) |
