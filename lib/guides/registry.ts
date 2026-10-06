import type { GuideEntry } from "./types";

/**
 * Content of every screen guide.
 *
 * Writing rules (keep them when editing):
 * - Aimed at the owner of a small 3D-printing business: plain words, no jargon.
 * - Button names are written exactly as they appear on screen.
 * - Be honest: if a module depends on an external integration or is a demo,
 *   say so in `notice`. Never promise a feature that does not exist yet.
 *
 * The array order is the order used by the guide center inside each group.
 */

export const WELCOME_GUIDE_ID = "welcome";

export const WELCOME_GUIDE: GuideEntry = {
  id: WELCOME_GUIDE_ID,
  paths: [],
  group: "inicio",
  href: "/app/dashboard",
  title: "Boas-vindas ao CRM",
  idea: "Tudo do seu negócio de impressão 3D em um lugar só: da peça na impressora até o dinheiro no caixa.",
  purpose: [
    "Produção: projetos, ordens de serviço, impressoras, modelos 3D e calendário.",
    "Vendas: pedidos de todos os canais e o catálogo de produtos com custo real.",
    "Financeiro: a planilha de controle e os relatórios.",
    "Clientes: contatos, conversas do WhatsApp, equipe e LGPD.",
    "Suprimentos: inventário da oficina e fornecedores.",
  ],
  steps: [
    {
      title: "Organização",
      detail: "Preencha os dados da empresa. Eles aparecem nos orçamentos e recibos que você imprime.",
    },
    {
      title: "Impressoras & Filamentos",
      detail: "Cadastre suas máquinas e os carretéis que você tem. É a base do cálculo de custo.",
    },
    {
      title: "Produtos",
      detail: "Monte o catálogo com o custo real de cada peça e o lucro em cada canal de venda.",
    },
    {
      title: "Projetos e Ordens de Serviço",
      detail: "Para encomendas sob medida: estime no projeto e acompanhe a produção na OS.",
    },
    {
      title: "Vendas",
      detail: "Registre os pedidos. O Dashboard e os Relatórios passam a mostrar seus números.",
    },
  ],
  tip: "Cada tela tem o próprio guia. Ele abre sozinho na primeira visita e fica sempre no botão “Guia desta tela”, no topo.",
  primaryAction: { label: "Configurar a organização", href: "/app/settings/tenant" },
};

export const GUIDES: GuideEntry[] = [
  WELCOME_GUIDE,

  // ── Início ────────────────────────────────────────────────────────────────
  {
    id: "dashboard",
    paths: ["/app/dashboard"],
    group: "inicio",
    title: "Dashboard",
    idea: "Uma fotografia do negócio: quanto entrou, o que está em produção e o que precisa de atenção.",
    purpose: [
      "Ver faturamento, pedidos, lucro e ticket médio do período.",
      "Acompanhar as ordens de serviço em andamento, atrasadas e concluídas.",
      "Saber o valor parado em estoque de produtos e filamentos.",
    ],
    steps: [
      {
        title: "Escolha o período",
        detail: "Use os botões de período, de 7 dias até 12 meses, para mudar todos os números da tela.",
      },
      {
        title: "Olhe os indicadores",
        detail: "Os cartões do topo comparam o período atual com o anterior.",
      },
      {
        title: "Confira as ordens de serviço",
        detail: "O painel separa Em andamento, Atrasadas e Concluídas. Atrasadas pedem ação primeiro.",
      },
    ],
    tip: "O Dashboard só lê informações. Os números aparecem conforme você registra vendas, ordens de serviço e impressões nas outras telas.",
    notice: {
      kind: "info",
      text: "Conta nova começa com tudo zerado. Isso é normal: os dados chegam quando você usa os outros módulos.",
    },
  },

  // ── Produção ──────────────────────────────────────────────────────────────
  {
    id: "projects",
    paths: ["/app/projects"],
    group: "producao",
    title: "Projetos",
    idea: "O rascunho técnico de uma peça antes de virar pedido: parâmetros, custo e ideias.",
    purpose: [
      "Estimar tempo, material e custo de uma peça sob medida.",
      "Guardar anotações e referências de projetos futuros.",
      "Levar os parâmetros prontos para uma Ordem de Serviço.",
    ],
    steps: [
      {
        title: "Crie o projeto",
        detail: "Clique em “Novo Projeto Técnico” e dê um nome que você reconheça depois.",
      },
      {
        title: "Simule o custo",
        detail: "Na aba “Fatiamento & Custos”, ajuste material, tempo e perfil de impressão até o custo fazer sentido.",
      },
      {
        title: "Anote as ideias",
        detail: "Use o “Quadro de Ideias” para registrar pedidos do cliente, medidas e referências.",
      },
      {
        title: "Gere a OS",
        detail: "Quando o cliente aprovar, use “Criar OS deste Projeto” para levar os parâmetros para a Ordem de Serviço.",
      },
    ],
    tabs: [
      { name: "Fatiamento & Custos", detail: "Simulador de custo com os parâmetros de impressão." },
      { name: "Quadro de Ideias", detail: "Notas livres para cada projeto." },
    ],
    tip: "Projeto é estimativa. O compromisso com o cliente, com prazo e valor, fica na Ordem de Serviço.",
    primaryAction: { label: "Novo Projeto Técnico" },
  },
  {
    id: "service-orders",
    paths: ["/app/service-orders"],
    group: "producao",
    title: "Ordens de Serviço",
    idea: "Cada encomenda vira um cartão que anda pelas etapas, do orçamento até a entrega.",
    purpose: [
      "Saber em que etapa está cada encomenda.",
      "Controlar prazos e prioridades.",
      "Emitir orçamento, ordem de serviço e recibo para o cliente.",
    ],
    steps: [
      {
        title: "Crie a OS",
        detail: "Clique em “Nova OS”, escolha o cliente e descreva a peça, o material e o prazo.",
      },
      {
        title: "Mova pelas colunas",
        detail: "Arraste o cartão: Orçamento → Aprovado / Fila → Em Produção → Pronto p/ Entrega → Concluído.",
      },
      {
        title: "Emita os documentos",
        detail: "Dentro da OS, abra Orçamento, Ordem de Serviço ou Recibo para imprimir ou salvar em PDF.",
      },
    ],
    tabsTitle: "Documentos de cada OS",
    tabs: [
      { name: "Orçamento", detail: "Documento para o cliente aprovar o valor." },
      { name: "Ordem de Serviço", detail: "Ficha de produção com as especificações." },
      { name: "Recibo", detail: "Comprovante de pagamento para entregar ao cliente." },
    ],
    tip: "Os documentos usam os dados da empresa cadastrados em Organização. Confira lá antes de imprimir o primeiro.",
    primaryAction: { label: "Nova OS" },
  },
  {
    id: "tenant",
    paths: ["/app/settings/tenant"],
    group: "producao",
    title: "Organização",
    idea: "Os dados oficiais da sua empresa, usados em todos os documentos que você emite.",
    purpose: [
      "Definir nome, documento e contatos que saem no orçamento e no recibo.",
      "Manter a identidade da empresa igual em todo o sistema.",
    ],
    steps: [
      {
        title: "Preencha os dados",
        detail: "Informe nome da empresa, CNPJ ou CPF, telefone, e-mail e endereço.",
      },
      {
        title: "Salve",
        detail: "As alterações passam a valer nos próximos documentos impressos.",
      },
      {
        title: "Teste num documento",
        detail: "Abra o orçamento de uma Ordem de Serviço e veja como ficou.",
      },
    ],
    tip: "Só administradores conseguem alterar estes dados.",
    notice: { kind: "info", text: "Tela restrita a administradores da organização." },
  },
  {
    id: "printers",
    paths: ["/app/printers"],
    group: "producao",
    title: "Impressoras & Filamentos",
    idea: "Sua fazenda de impressão e o estoque de filamento, juntos, para saber o que dá para produzir.",
    purpose: [
      "Cadastrar as impressoras e acompanhar o estado de cada uma.",
      "Controlar quanto filamento sobrou em cada carretel.",
      "Registrar impressões e o custo real de cada uma.",
    ],
    steps: [
      {
        title: "Cadastre as máquinas",
        detail: "Clique em “Nova Máquina” e informe modelo, bico e consumo de energia.",
      },
      {
        title: "Adicione os carretéis",
        detail: "Use “Adicionar Carretel” com material, cor, peso e preço pago.",
      },
      {
        title: "Acompanhe a produção",
        detail: "Na Fazenda você vê cada máquina. Ao imprimir, vincule a impressão a uma Ordem de Serviço.",
      },
      {
        title: "Confira o histórico",
        detail: "O Histórico mostra o que foi impresso e quanto custou de verdade.",
      },
    ],
    tabs: [
      { name: "Fazenda", detail: "Suas impressoras e o estado de cada uma." },
      { name: "Estoque de Filamentos", detail: "Carretéis, peso restante e custo por grama." },
      { name: "Simulador de Telemetria (Klipper)", detail: "Mostra como fica o acompanhamento ao vivo." },
      { name: "Histórico", detail: "Impressões recentes com o custo real." },
    ],
    tip: "O preço pago no carretel alimenta o custo por grama usado em Produtos e na Calculadora. Vale cadastrar certinho.",
    notice: {
      kind: "integration",
      text: "O status ao vivo exige que a impressora esteja acessível na rede (Moonraker/Klipper ou OctoPrint). Sem isso, o cadastro e o estoque funcionam normalmente.",
    },
    primaryAction: { label: "Nova Máquina" },
  },
  {
    id: "models",
    paths: ["/app/models"],
    group: "producao",
    title: "Modelagem",
    idea: "A biblioteca dos seus arquivos 3D, organizada e com histórico de versões.",
    purpose: [
      "Guardar arquivos STL e 3MF em pastas.",
      "Ajustar e dividir modelos antes de imprimir.",
      "Manter versões e exportar em 3MF.",
    ],
    steps: [
      {
        title: "Envie um arquivo",
        detail: "Envie um STL ou 3MF. Ele aparece na biblioteca com a pré-visualização.",
      },
      {
        title: "Organize em pastas",
        detail: "Crie pastas por cliente, coleção ou tipo de peça.",
      },
      {
        title: "Edite ou divida",
        detail: "Abra o modelo para ajustar ou dividir em partes que cabem na mesa da impressora.",
      },
      {
        title: "Salve versões e exporte",
        detail: "Cada alteração pode virar uma versão. Exporte em 3MF quando estiver pronto.",
      },
    ],
    tip: "Quer gerar o G-code? Use a tela Fatiar e escolha um modelo daqui.",
  },
  {
    id: "slicer",
    paths: ["/app/models/fatiar"],
    group: "producao",
    title: "Fatiar",
    idea: "Transforma um modelo 3D em G-code direto no navegador, sem instalar nada.",
    purpose: [
      "Gerar o arquivo que a impressora entende.",
      "Ter uma estimativa de tempo e material antes de imprimir.",
    ],
    steps: [
      {
        title: "Escolha o modelo",
        detail: "Selecione um modelo que já está na sua biblioteca de Modelagem.",
      },
      {
        title: "Ajuste as configurações",
        detail: "Defina impressora, material, altura de camada e suporte.",
      },
      {
        title: "Fatie e baixe",
        detail: "Gere o G-code e baixe o arquivo para enviar à impressora.",
      },
    ],
    tip: "O fatiamento roda no seu computador. Modelos grandes podem levar alguns segundos.",
    notice: {
      kind: "info",
      text: "Nada é salvo no CRM: o G-code é só baixado. Guarde o arquivo se for reutilizar.",
    },
    primaryAction: { label: "Escolher um modelo" },
  },
  {
    id: "calculator",
    paths: ["/app/calculator"],
    group: "producao",
    title: "Calculadora 3D",
    idea: "Descubra quanto custa e quanto cobrar por uma impressão em poucos segundos.",
    purpose: [
      "Somar filamento, tempo de máquina, energia e margem.",
      "Chegar a um preço de venda justo.",
      "Gerar um PDF para mandar ao cliente.",
    ],
    steps: [
      {
        title: "Informe a peça",
        detail: "Preencha peso de filamento, tempo de impressão e o material usado.",
      },
      {
        title: "Ajuste os custos",
        detail: "Confira energia, desgaste e a margem que você quer ganhar. Use os presets para não digitar tudo de novo.",
      },
      {
        title: "Gere o PDF",
        detail: "Baixe o orçamento em PDF para enviar ao cliente.",
      },
    ],
    tip: "Para um orçamento que fica registrado e acompanha a produção, crie uma Ordem de Serviço.",
    notice: { kind: "info", text: "O cálculo não fica salvo no CRM. Baixe o PDF se precisar guardar." },
  },
  {
    id: "calendar",
    paths: ["/app/calendar"],
    group: "producao",
    title: "Calendário",
    idea: "Prazos e compromissos do negócio em uma única agenda.",
    purpose: [
      "Ver os prazos das ordens de serviço e as vendas no tempo.",
      "Agendar entregas, retiradas e reuniões.",
    ],
    steps: [
      {
        title: "Escolha a visualização",
        detail: "Alterne entre a grade do mês e a lista de agenda.",
      },
      {
        title: "Agende um evento",
        detail: "Clique em “Agendar Novo Evento” e informe data, hora e descrição.",
      },
      {
        title: "Acompanhe os prazos",
        detail: "Prazos de OS e vendas aparecem sozinhos, sem precisar cadastrar de novo.",
      },
    ],
    tip: "Use o calendário no começo do dia para decidir o que entra na impressora primeiro.",
    primaryAction: { label: "Agendar Novo Evento" },
  },

  // ── Vendas ────────────────────────────────────────────────────────────────
  {
    id: "sales",
    paths: ["/app/sales"],
    group: "vendas",
    title: "Vendas — visão geral",
    idea: "Todos os pedidos de todos os canais em um só lugar, do jeito que você preferir ver.",
    purpose: [
      "Registrar e acompanhar cada venda.",
      "Ver o andamento dos pedidos em lista, quadro ou linha do tempo.",
      "Guardar itens e documentos de cada pedido.",
    ],
    steps: [
      {
        title: "Registre a venda",
        detail: "Clique em “Nova venda”, escolha o canal, o cliente e as peças vendidas.",
      },
      {
        title: "Escolha a visualização",
        detail: "Use Tabela para conferir, Kanban para mover etapas e Timeline para ver a ordem dos acontecimentos.",
      },
      {
        title: "Abra o pedido",
        detail: "Clique numa venda para abrir o painel com Detalhes, Itens e Docs.",
      },
    ],
    tabsTitle: "Visualizações",
    tabs: [
      { name: "Tabela", detail: "Lista completa com filtros." },
      { name: "Kanban", detail: "Pedidos por etapa, de arrastar." },
      { name: "Timeline", detail: "Vendas em ordem de data." },
    ],
    tip: "A venda precisa estar ligada a uma peça cadastrada em Produtos. Assim o lucro de cada pedido sai certo.",
    primaryAction: { label: "Nova venda" },
  },
  {
    id: "sales-shopee",
    paths: ["/app/sales/shopee"],
    group: "vendas",
    title: "Vendas na Shopee",
    idea: "A mesma tela de vendas, mostrando só os pedidos da Shopee.",
    purpose: [
      "Acompanhar o desempenho da Shopee separado dos outros canais.",
      "Ver o lucro real depois das taxas da plataforma.",
    ],
    steps: [
      {
        title: "Registre o pedido",
        detail: "Clique em “Nova venda” com o canal Shopee e as peças do pedido.",
      },
      {
        title: "Acompanhe as etapas",
        detail: "Use as visualizações Tabela, Kanban ou Timeline, como na visão geral.",
      },
    ],
    tip: "As taxas da Shopee configuradas em Produtos → Canais entram no cálculo do lucro.",
    notice: {
      kind: "integration",
      text: "Ainda não há sincronização automática com a Shopee. Os pedidos são registrados manualmente aqui.",
    },
    primaryAction: { label: "Nova venda" },
  },
  {
    id: "sales-mercado-livre",
    paths: ["/app/sales/mercado-livre"],
    group: "vendas",
    title: "Vendas no Mercado Livre",
    idea: "A mesma tela de vendas, mostrando só os pedidos do Mercado Livre.",
    purpose: [
      "Acompanhar o desempenho do Mercado Livre separado dos outros canais.",
      "Ver o lucro real depois das taxas da plataforma.",
    ],
    steps: [
      {
        title: "Registre o pedido",
        detail: "Clique em “Nova venda” com o canal Mercado Livre e as peças do pedido.",
      },
      {
        title: "Acompanhe as etapas",
        detail: "Use as visualizações Tabela, Kanban ou Timeline, como na visão geral.",
      },
    ],
    tip: "As taxas do Mercado Livre configuradas em Produtos → Canais entram no cálculo do lucro.",
    notice: {
      kind: "integration",
      text: "Ainda não há sincronização automática com o Mercado Livre. Os pedidos são registrados manualmente aqui.",
    },
    primaryAction: { label: "Nova venda" },
  },
  {
    id: "sales-facebook",
    paths: ["/app/sales/facebook"],
    group: "vendas",
    title: "Vendas no Facebook",
    idea: "A mesma tela de vendas, mostrando só os pedidos que vieram do Facebook.",
    purpose: [
      "Acompanhar as vendas do Facebook separadas dos outros canais.",
      "Comparar com os marketplaces para saber onde vale investir.",
    ],
    steps: [
      {
        title: "Registre o pedido",
        detail: "Clique em “Nova venda” com o canal Facebook e as peças do pedido.",
      },
      {
        title: "Acompanhe as etapas",
        detail: "Use as visualizações Tabela, Kanban ou Timeline, como na visão geral.",
      },
    ],
    tip: "Compare o lucro por canal em Relatórios para decidir onde anunciar mais.",
    notice: {
      kind: "integration",
      text: "Ainda não há sincronização automática com o Facebook. Os pedidos são registrados manualmente aqui.",
    },
    primaryAction: { label: "Nova venda" },
  },
  {
    id: "products",
    paths: ["/app/products"],
    group: "vendas",
    title: "Produtos",
    idea: "O catálogo das suas peças com o custo real e o lucro em cada canal de venda.",
    purpose: [
      "Saber quanto cada peça custa de verdade para produzir.",
      "Comparar o lucro entre Shopee, Mercado Livre, Facebook e venda direta.",
      "Montar a vitrine e gerar o catálogo em PDF.",
    ],
    steps: [
      {
        title: "Cadastre a peça",
        detail: "Clique em “Nova peça” e dê nome, foto e categoria.",
      },
      {
        title: "Monte o custo",
        detail: "Na aba Custo, informe filamento, tempo de impressão e acabamento.",
      },
      {
        title: "Defina os preços por canal",
        detail: "Na aba Canais, coloque o preço de cada canal e veja o lucro depois das taxas.",
      },
      {
        title: "Publique e compartilhe",
        detail: "Use Vitrine e Mídia para a loja e gere o catálogo em PDF quando quiser divulgar.",
      },
    ],
    tabsTitle: "Abas da ficha da peça",
    tabs: [
      { name: "Custo", detail: "Material, tempo e acabamento da peça." },
      { name: "Canais", detail: "Preço e lucro em cada canal." },
      { name: "Vitrine", detail: "Como a peça aparece na loja." },
      { name: "Mídia", detail: "Fotos e vídeos da peça." },
      { name: "Links", detail: "Arquivos e anúncios ligados à peça." },
      { name: "Interno", detail: "Anotações que só a equipe vê." },
    ],
    tip: "O catálogo em PDF fica em Produtos → Catálogo e usa as fotos e preços que você cadastrou.",
    primaryAction: { label: "Nova peça" },
  },
  {
    id: "new-product",
    paths: ["/app/sales/new-product"],
    group: "vendas",
    title: "Cadastro de produto",
    idea: "Atalho para cadastrar uma peça: ele leva você direto para Produtos.",
    purpose: ["Chegar rápido ao cadastro de peças a partir do menu de Vendas."],
    steps: [
      {
        title: "Abra Produtos",
        detail: "O atalho abre a tela Produtos. Lá, clique em “Nova peça”.",
      },
      {
        title: "Preencha a ficha",
        detail: "Siga as abas Custo, Canais, Vitrine, Mídia, Links e Interno.",
      },
    ],
    tip: "Toda venda precisa de uma peça cadastrada. Comece por aqui se ainda não tem nenhuma.",
    autoOpen: false,
    primaryAction: { label: "Ir para Produtos", href: "/app/products" },
  },

  // ── Financeiro ────────────────────────────────────────────────────────────
  {
    id: "control",
    paths: ["/app/control"],
    group: "financeiro",
    title: "Controle",
    idea: "Sua planilha financeira dentro do CRM: entradas, saídas e o resultado do mês.",
    purpose: [
      "Registrar receitas e despesas do negócio.",
      "Ver gráficos do caixa sem montar planilha.",
      "Trazer vendas e compras dos outros módulos com um clique.",
    ],
    steps: [
      {
        title: "Traga os dados",
        detail: "Clique em “Sincronizar” para puxar vendas e compras registradas nos outros módulos.",
      },
      {
        title: "Lance o que faltar",
        detail: "Na aba Lançamentos, adicione despesas avulsas como aluguel, energia e embalagens.",
      },
      {
        title: "Classifique",
        detail: "Escolha a categoria de cada lançamento para os gráficos ficarem corretos.",
      },
      {
        title: "Veja o resultado",
        detail: "A aba Dashboard resume entradas, saídas e lucro.",
      },
    ],
    tabs: [
      { name: "Dashboard", detail: "Gráficos e resumo do caixa." },
      { name: "Lançamentos", detail: "A planilha com cada entrada e saída." },
      { name: "Abas personalizadas", detail: "Abas extras que você cria para organizar." },
    ],
    tip: "Sincronize antes de fechar o mês para não esquecer nenhuma venda.",
    notice: {
      kind: "info",
      text: "As abas personalizadas ainda não ficam salvas: somem ao recarregar a página. Dashboard e Lançamentos são salvos normalmente.",
    },
    primaryAction: { label: "Sincronizar" },
  },
  {
    id: "reports",
    paths: ["/app/reports"],
    group: "financeiro",
    title: "Relatórios",
    idea: "Os números do negócio já analisados, para decidir com base em dados.",
    purpose: [
      "Ver o desempenho comercial por canal e por período.",
      "Receber sugestões de decisão a partir dos seus números.",
      "Medir a produtividade das impressoras.",
      "Exportar para o contador ou para uma planilha.",
    ],
    steps: [
      {
        title: "Escolha o período",
        detail: "Selecione 30 Dias, 3 Meses ou Anual.",
      },
      {
        title: "Investigue um número",
        detail: "Clique numa fatia ou barra do gráfico para abrir o detalhamento com os pedidos por trás dela.",
      },
      {
        title: "Exporte",
        detail: "Baixe em CSV, XLSX ou imprima em PDF.",
      },
    ],
    tabsTitle: "Seções desta tela",
    tabs: [
      { name: "Desempenho Comercial", detail: "Faturamento e vendas por canal." },
      { name: "Decisões Recomendadas", detail: "Sugestões com base nos seus dados." },
      { name: "Detalhamento", detail: "As linhas por trás de cada gráfico." },
      { name: "Farm de Impressão", detail: "Horas de máquina e filamento usado." },
    ],
    tip: "Relatórios só leem dados. Se algo parece errado, corrija na tela de origem (Vendas, OS ou Impressoras).",
  },

  // ── Clientes ──────────────────────────────────────────────────────────────
  {
    id: "inbox",
    paths: ["/app/inbox"],
    group: "clientes",
    title: "Inbox",
    idea: "As conversas do WhatsApp do negócio, organizadas para a equipe responder.",
    purpose: [
      "Responder clientes sem usar o celular pessoal.",
      "Dividir o atendimento entre as pessoas da equipe.",
      "Ver o histórico do cliente junto com a conversa.",
    ],
    steps: [
      {
        title: "Escolha uma conversa",
        detail: "A lista mostra as conversas mais recentes primeiro.",
      },
      {
        title: "Assuma o atendimento",
        detail: "Clique em “Assumir” para pegar a conversa. Assim ninguém responde em dobro.",
      },
      {
        title: "Responda",
        detail: "Escreva no campo de mensagem e envie.",
      },
    ],
    tip: "Quem fala com você pelo WhatsApp vira contato automaticamente em Contatos.",
    notice: {
      kind: "integration",
      text: "Exige o WhatsApp conectado em Conexões. Envio de anexos pelo Inbox chega em breve.",
    },
    primaryAction: { label: "Abrir Conexões", href: "/app/connections" },
  },
  {
    id: "connections",
    paths: ["/app/connections"],
    group: "clientes",
    title: "Conexões",
    idea: "Liga o WhatsApp do negócio ao CRM para as conversas chegarem no Inbox.",
    purpose: [
      "Conectar o número do WhatsApp lendo um QR code.",
      "Acompanhar se a conexão está ativa.",
    ],
    steps: [
      {
        title: "Inicie a conexão",
        detail: "Clique em “Conectar novo WhatsApp” para gerar o QR code.",
      },
      {
        title: "Leia o QR code",
        detail: "No celular, abra WhatsApp → Aparelhos conectados → Conectar aparelho e aponte para a tela.",
      },
      {
        title: "Confira o status",
        detail: "Com a conexão ativa, o ponto ao lado de Conexões no menu fica verde.",
      },
    ],
    tip: "Use o número comercial. Mensagens em massa podem levar a bloqueio pelo WhatsApp.",
    notice: {
      kind: "integration",
      text: "Só administradores conectam números, e a integração de WhatsApp precisa estar habilitada na sua conta.",
    },
  },
  {
    id: "contacts",
    paths: ["/app/contacts"],
    group: "clientes",
    title: "Contatos",
    idea: "A ficha de cada cliente, com tudo o que já aconteceu com ele.",
    purpose: [
      "Guardar dados de clientes e interessados.",
      "Acompanhar quem está em negociação no funil.",
      "Ver o histórico completo de cada cliente.",
    ],
    steps: [
      {
        title: "Cadastre",
        detail: "Clique em “Novo contato” e informe nome, telefone e e-mail.",
      },
      {
        title: "Escolha a visualização",
        detail: "Lista para buscar e filtrar, Funil para ver a etapa de negociação.",
      },
      {
        title: "Abra a ficha",
        detail: "Clique no contato para ver Visão Geral, Timeline e LGPD.",
      },
    ],
    tabsTitle: "Abas da ficha do contato",
    tabs: [
      { name: "Visão Geral", detail: "Dados principais do contato." },
      { name: "Timeline", detail: "Tudo o que aconteceu, em ordem." },
      { name: "LGPD", detail: "Pedidos do titular sobre os próprios dados." },
    ],
    tip: "Contatos do WhatsApp entram sozinhos. Você só precisa completar os dados.",
    primaryAction: { label: "Novo contato" },
  },
  {
    id: "team",
    paths: ["/app/team"],
    group: "clientes",
    title: "Equipe",
    idea: "Quem tem acesso ao CRM e o que cada pessoa pode fazer.",
    purpose: [
      "Convidar pessoas para trabalhar com você.",
      "Definir o nível de acesso de cada uma.",
      "Remover o acesso de quem saiu.",
    ],
    steps: [
      {
        title: "Convide",
        detail: "Clique em “Convidar membros”, cole até 20 e-mails (um por linha) e escolha o papel. Cada pessoa recebe o convite.",
      },
      {
        title: "Escolha o papel",
        detail: "viewer só consulta; agent atende e registra o dia a dia; manager cria e configura; admin controla tudo, inclusive a equipe.",
      },
      {
        title: "Revogue quando preciso",
        detail: "No menu de ações do membro, use “Revogar acesso” para quem não faz mais parte da equipe.",
      },
    ],
    tip: "Dê o menor acesso que resolve. É mais fácil subir o papel depois do que desfazer um erro.",
    primaryAction: { label: "Convidar membros" },
  },
  {
    id: "lgpd",
    paths: ["/app/lgpd/requests", "/app/lgpd"],
    group: "clientes",
    title: "LGPD",
    idea: "Atende os pedidos dos clientes sobre os próprios dados, dentro do prazo da lei.",
    purpose: [
      "Receber pedidos de cópia ou de exclusão de dados.",
      "Aprovar e executar cada pedido com registro.",
      "Cumprir os prazos sem depender de memória.",
    ],
    steps: [
      {
        title: "Receba o pedido",
        detail: "Pedidos chegam pela aba LGPD da ficha do contato ou pelas integrações.",
      },
      {
        title: "Analise",
        detail: "Abra o pedido, confira quem pediu e o que foi pedido.",
      },
      {
        title: "Aprove e execute",
        detail: "Cópia dos dados: até 7 dias. Exclusão (anonimização): até 15 dias.",
      },
    ],
    tip: "A anonimização não pode ser desfeita. O cliente vira “Cliente Anonimizado” e o histórico perde os dados pessoais.",
    notice: { kind: "info", text: "Restrito a administradores. Toda ação fica registrada para auditoria." },
  },
  {
    id: "ai-agents",
    paths: ["/app/ai/agents", "/app/ai"],
    group: "clientes",
    title: "Agentes IA",
    idea: "Um assistente que responde clientes no WhatsApp seguindo as regras que você definir.",
    purpose: [
      "Responder dúvidas frequentes fora do horário.",
      "Passar a conversa para uma pessoa quando necessário.",
      "Ver o que o agente respondeu e por quê.",
    ],
    steps: [
      {
        title: "Crie o agente",
        detail: "Clique em “Novo agente”, escolha o modelo de IA e escreva as instruções.",
      },
      {
        title: "Teste antes",
        detail: "Na aba Testar, converse com o agente como se fosse um cliente.",
      },
      {
        title: "Publique",
        detail: "Quando estiver bom, publique. As mudanças ficam guardadas no Histórico.",
      },
      {
        title: "Acompanhe",
        detail: "Em Execuções, veja cada resposta dada aos clientes.",
      },
    ],
    tabsTitle: "Abas do agente",
    tabs: [
      { name: "Configuração", detail: "Modelo, instruções e palavras que passam para humano." },
      { name: "Testar", detail: "Conversa de teste com o agente." },
      { name: "Execuções", detail: "Respostas reais dadas aos clientes." },
      { name: "Histórico", detail: "Versões publicadas do agente." },
    ],
    tip: "Defina palavras de transferência, como “atendente” ou “humano”, para o cliente sempre conseguir falar com alguém.",
    notice: {
      kind: "integration",
      text: "Exige uma chave de IA cadastrada e o WhatsApp conectado. Sem a chave, o teste pode ser apenas simulado.",
    },
    primaryAction: { label: "Novo agente" },
  },
  {
    id: "pipelines",
    paths: ["/app/pipelines", "/app/kanban"],
    group: "clientes",
    title: "Funil de leads",
    idea: "Um quadro com as etapas de negociação para acompanhar cada oportunidade.",
    purpose: [
      "Ver em que etapa está cada negociação.",
      "Não deixar nenhum interessado esquecido.",
    ],
    steps: [
      {
        title: "Abra o funil",
        detail: "Cada coluna é uma etapa da negociação.",
      },
      {
        title: "Mova os cartões",
        detail: "Arraste o cartão para a próxima etapa conforme a conversa avança.",
      },
      {
        title: "Ajuste as etapas",
        detail: "Nomes e etapas do funil ficam em Configurações → Pipelines.",
      },
    ],
    tip: "Para pedidos, o Kanban da tela Vendas costuma ser mais prático.",
  },

  // ── Suprimentos ───────────────────────────────────────────────────────────
  {
    id: "inventory",
    paths: ["/app/inventory"],
    group: "suprimentos",
    title: "Inventário",
    idea: "Tudo o que a oficina tem: equipamentos e materiais que acabam.",
    purpose: [
      "Registrar impressoras, ferramentas e móveis.",
      "Controlar consumíveis como filamentos e resinas.",
      "Saber quanto foi investido na oficina.",
    ],
    steps: [
      {
        title: "Cadastre um ativo",
        detail: "Clique em “Novo ativo” e informe nome, valor e data de compra.",
      },
      {
        title: "Controle os consumíveis",
        detail: "Na aba Consumíveis, acompanhe o que está acabando.",
      },
    ],
    tabs: [
      { name: "Ativos", detail: "Equipamentos e bens da oficina." },
      { name: "Consumíveis", detail: "Materiais que se gastam com o uso." },
    ],
    tip: "Ativos bem cadastrados ajudam a calcular o desgaste das máquinas no custo das peças.",
    primaryAction: { label: "Novo ativo" },
  },
  {
    id: "suppliers",
    paths: ["/app/suppliers"],
    group: "suprimentos",
    title: "Fornecedores",
    idea: "Seus fornecedores e o histórico de compras, para comprar melhor.",
    purpose: [
      "Guardar os contatos de quem vende para você.",
      "Comparar o custo por grama do filamento entre fornecedores.",
      "Registrar o que foi comprado e quanto custou.",
    ],
    steps: [
      {
        title: "Cadastre o fornecedor",
        detail: "Clique em “Novo Fornecedor” e informe nome e contato.",
      },
      {
        title: "Registre as compras",
        detail: "Use “Registrar Compra” a cada pedido feito.",
      },
      {
        title: "Compare os preços",
        detail: "A matriz de custo por grama mostra quem tem o filamento mais barato.",
      },
    ],
    tabsTitle: "Seções desta tela",
    tabs: [
      { name: "Diretório de Fornecedores", detail: "Todos os seus fornecedores." },
      { name: "Matriz de Custo/g", detail: "Preço por grama de cada filamento." },
      { name: "Histórico de Compras", detail: "Compras registradas, com busca." },
    ],
    tip: "As compras registradas aqui podem entrar no Controle financeiro pelo botão “Sincronizar”.",
    primaryAction: { label: "Novo Fornecedor" },
  },

  // ── Ferramentas ───────────────────────────────────────────────────────────
  {
    id: "assistant",
    paths: ["/app/assistant"],
    group: "ferramentas",
    title: "Assistente IA",
    idea: "Atalho para os agentes de IA que atendem seus clientes.",
    purpose: ["Chegar rápido à configuração dos Agentes IA."],
    steps: [
      {
        title: "Abra Agentes IA",
        detail: "O atalho leva você para a tela Agentes IA.",
      },
      {
        title: "Crie ou ajuste um agente",
        detail: "Lá você cria, testa e publica os agentes.",
      },
    ],
    autoOpen: false,
    notice: {
      kind: "integration",
      text: "Os agentes exigem uma chave de IA cadastrada e o WhatsApp conectado.",
    },
    primaryAction: { label: "Ir para Agentes IA", href: "/app/ai/agents" },
  },
  {
    id: "automations",
    paths: ["/automations", "/app/automations"],
    group: "ferramentas",
    title: "Automações",
    idea: "Uma prévia de como vai ser automatizar tarefas repetitivas entre os módulos.",
    purpose: [
      "Conhecer o tipo de automação que está a caminho.",
      "Pensar em quais tarefas do dia a dia você quer automatizar.",
    ],
    steps: [
      {
        title: "Explore",
        detail: "Navegue pela tela para entender como os fluxos serão montados.",
      },
      {
        title: "Anote suas ideias",
        detail: "Liste as tarefas que mais tomam seu tempo. Elas são boas candidatas a automação.",
      },
    ],
    notice: {
      kind: "demo",
      text: "Demonstração: nenhuma automação é executada ainda. Nada do que você fizer aqui afeta seus dados.",
    },
  },
  {
    id: "content-studio",
    paths: ["/content-studio"],
    group: "ferramentas",
    title: "Criação de Conteúdo",
    idea: "Uma prévia do estúdio para criar vídeos e posts das suas peças.",
    purpose: [
      "Conhecer as ferramentas de edição que estão a caminho.",
      "Testar ideias de conteúdo para as redes sociais.",
    ],
    steps: [
      {
        title: "Explore o editor",
        detail: "Experimente a linha do tempo e as ferramentas de edição.",
      },
      {
        title: "Planeje",
        detail: "Pense em quais peças merecem vídeo: as mais vendidas costumam render mais.",
      },
    ],
    notice: {
      kind: "demo",
      text: "Demonstração: nada é publicado nas redes sociais a partir desta tela.",
    },
  },
  {
    id: "landing-edit",
    paths: ["/app/landing-edit"],
    group: "ferramentas",
    title: "Landing Edit",
    idea: "Edita a vitrine pública da loja sem precisar mexer em código.",
    purpose: [
      "Escolher a ordem dos produtos e o pódio dos destaques.",
      "Organizar nichos, textos e links da página.",
      "Ajustar as comissões exibidas.",
    ],
    steps: [
      {
        title: "Escolha a seção",
        detail: "Ordem, pódio, nichos, textos, links ou comissões.",
      },
      {
        title: "Edite",
        detail: "Faça as alterações e salve.",
      },
      {
        title: "Confira no site",
        detail: "Abra a vitrine pública para ver o resultado.",
      },
    ],
    tip: "Os produtos da vitrine vêm de Produtos → aba Vitrine.",
    notice: {
      kind: "info",
      text: "Por enquanto só o site da própria loja está no ar. Para outras organizações, as edições ficam guardadas, mas não aparecem publicamente.",
    },
  },

  // ── Conta e configurações ─────────────────────────────────────────────────
  {
    id: "settings",
    paths: ["/app/settings"],
    group: "conta",
    title: "Configurações",
    idea: "O painel com todos os ajustes da sua conta e da organização.",
    purpose: [
      "Encontrar rápido o ajuste que você procura.",
      "Separar o que é seu (perfil, segurança) do que é da empresa.",
    ],
    steps: [
      {
        title: "Escolha o cartão",
        detail: "Cada cartão abre uma área: Perfil, Segurança, Organização, Pipelines, Conexões WhatsApp, Billing e outras.",
      },
      {
        title: "Ajuste e salve",
        detail: "Cada área tem o próprio botão de salvar.",
      },
    ],
    tip: "Alguns cartões só aparecem para gerentes ou administradores.",
  },
  {
    id: "settings-profile",
    paths: ["/app/settings/profile"],
    group: "conta",
    title: "Perfil",
    idea: "Seus dados pessoais dentro do CRM.",
    purpose: ["Atualizar nome, idioma, fuso horário e foto."],
    steps: [
      { title: "Edite seus dados", detail: "Altere nome, idioma, fuso e avatar." },
      { title: "Salve", detail: "As mudanças aparecem para toda a equipe." },
    ],
    tip: "O fuso horário certo evita confusão nos prazos do Calendário.",
  },
  {
    id: "settings-security",
    paths: ["/app/settings/security"],
    group: "conta",
    title: "Segurança",
    idea: "Proteja o acesso à sua conta com uma segunda etapa de login.",
    purpose: [
      "Ativar a verificação em duas etapas (MFA).",
      "Guardar códigos de recuperação.",
      "Ver dispositivos confiáveis e sessões abertas.",
    ],
    steps: [
      {
        title: "Ative o MFA",
        detail: "Leia o QR code com um app autenticador e digite o código de 6 dígitos.",
      },
      {
        title: "Guarde os códigos de recuperação",
        detail: "Anote em lugar seguro. Eles salvam você se perder o celular.",
      },
      {
        title: "Revise os acessos",
        detail: "Encerre sessões e remova dispositivos que você não reconhece.",
      },
    ],
    tip: "Para administradores o MFA é obrigatório.",
  },
  {
    id: "settings-billing",
    paths: ["/app/settings/billing"],
    group: "conta",
    title: "Plano e cobrança",
    idea: "Seu plano, o tempo de trial e como destravar os módulos PRO.",
    purpose: [
      "Ver o plano atual e quantos dias restam do trial.",
      "Pagar via Pix para liberar o PRO.",
    ],
    steps: [
      { title: "Confira o plano", detail: "Veja se você está no trial, no PRO ou com acesso pausado." },
      { title: "Pague via Pix", detail: "Use os dados de Pix mostrados na tela." },
      { title: "Aguarde a aprovação", detail: "O pagamento é conferido manualmente e o acesso é liberado em seguida." },
    ],
    tip: "Com o acesso pausado, seus dados continuam guardados. Nada é apagado.",
    autoOpen: false,
  },
];

const BY_ID = new Map(GUIDES.map((g) => [g.id, g]));

export function guideById(id: string): GuideEntry | null {
  return BY_ID.get(id) ?? null;
}

/** Strips query string, hash and trailing slash. */
export function normalizePath(pathname: string): string {
  const clean = pathname.split(/[?#]/, 1)[0] ?? "";
  if (clean.length > 1 && clean.endsWith("/")) return clean.replace(/\/+$/, "");
  return clean;
}

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Resolves the guide for a route. The most specific (longest) matching prefix
 * wins, so `/app/models/fatiar` beats `/app/models` and `/app/contacts/<id>`
 * falls back to the contacts guide. Returns `null` when no guide matches.
 */
export function guideForPath(pathname: string | null | undefined): GuideEntry | null {
  if (!pathname) return null;
  const path = normalizePath(pathname);
  let best: GuideEntry | null = null;
  let bestLength = -1;
  for (const guide of GUIDES) {
    for (const prefix of guide.paths) {
      if (prefix.length > bestLength && matches(path, prefix)) {
        best = guide;
        bestLength = prefix.length;
      }
    }
  }
  return best;
}

/** Link the guide center uses to take the user to the screen. */
export function guideHref(guide: GuideEntry): string {
  return guide.href ?? guide.paths[0] ?? "/app/dashboard";
}

/**
 * Which guide should open by itself on this route, given what the user has
 * already seen. Pure, so the first-visit rules are unit tested:
 * - Screens marked `autoOpen: false` never open anything (not even the welcome),
 *   because they redirect or already show their own message.
 * - The welcome guide comes first, once. The screen guide waits for the next
 *   navigation instead of stacking right after it (the provider only re-runs
 *   this on route changes).
 * - Otherwise the screen guide opens if it was not seen yet.
 */
export function autoGuideFor(
  pathname: string | null | undefined,
  seen: ReadonlySet<string>,
): GuideEntry | null {
  const screen = guideForPath(pathname);
  if (screen?.autoOpen === false) return null;
  if (!seen.has(WELCOME_GUIDE_ID)) return WELCOME_GUIDE;
  if (!screen || seen.has(screen.id)) return null;
  return screen;
}
