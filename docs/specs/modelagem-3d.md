# Spec — Módulo de Modelagem 3D no DeskcommCRM

> Documento de especificação para agente de código. Escrito a partir do
> **inventário real deste repositório** em 10/08/2026, não de um projeto
> hipotético. Cole como contexto e siga o roadmap na ordem.

---

## 0. Leia isto antes de escrever qualquer linha

Você é um engenheiro fullstack sênior com experiência em geometria
computacional e WebGL. Vai construir o módulo de Modelagem 3D **dentro do
DeskcommCRM** — não num monorepo novo, não num app separado.

Regras que valem do começo ao fim:

1. **Leia o `CLAUDE.md` da raiz primeiro.** Ele tem a doutrina do repo:
   multi-tenancy com RLS, migrations versionadas, Definition of Done. Nada aqui
   substitui aquilo.
2. **Não quebre `/app/models`.** O repositório de modelos está em uso, com
   arquivos reais no bucket. Toda refatoração mantém a tela funcionando.
3. **Nunca copie código GPL/AGPL** (Blender, Meshmixer, PrusaSlicer,
   CuraEngine, Slic3r). Reimplemente a partir da descrição matemática, ou use
   biblioteca com licença permissiva. Ver §7.
4. **Processamento pesado roda em Web Worker.** A main thread não pode travar.
   O padrão já existe neste repo — ver §2.4.
5. **Geometria sem teste não entra.** Toda operação de malha tem teste com
   fixture e verificação de invariante. O repo já tem 605 testes passando; o
   número não pode cair.
6. **TypeScript estrito.** `any` e `@ts-ignore` são proibidos pelo CLAUDE.md.
   Se precisar, pare e pergunte.
7. **Antes de mudar arquitetura**, escreva um ADR curto em `docs/adr/` e pare
   para confirmação.
8. Código em inglês; UI em PT-BR; comentários em PT-BR explicando **por quê**,
   não o quê.

---

## 1. O que JÁ EXISTE (não reescreva)

Esta é a parte que um spec genérico erra. Levantado arquivo por arquivo.

### 1.1 Banco (aplicado em produção)

**`models_3d`** — migration 0045, expandida pela 0049:

```
id uuid, organization_id uuid, name text, file_path text, size_kb integer,
triangles integer, volume_cm3 numeric, bounding_box jsonb, thumbnail_url text,
created_by uuid, created_at timestamptz, updated_at timestamptz,
folder_id uuid, mime_type text, kind text, sort_order numeric
```

**`model_folders`** — migration 0049, árvore com `parent_id`:

```
id uuid, organization_id uuid, parent_id uuid, name text, icon text,
color text, contact_id uuid, sort_order numeric,
created_by uuid, created_at timestamptz, updated_at timestamptz
```

RLS por `fn_user_org_ids()` nas duas. `contact_id` liga a pasta a um cliente do
CRM — pense nisso ao modelar "projetos".

**Bucket `models-3d`**: privado, teto de 100 MB, caminho `<orgId>/<uuid>-<nome>`,
policies comparando `split_part(name,'/',1)::uuid` com as orgs do usuário.

Buckets existentes, para não criar um sétimo sem motivo:

| Bucket | Público | Teto |
|---|---|---|
| `models-3d` | não | 100 MB |
| `landing-media` | sim | 50 MB |
| `ai-policy` | não | 20 MB |
| `lgpd-exports` | não | 50 MB |
| `avatars` | sim | 5 MB |
| `orcamentos-public` | sim | — |

**Última migration: `0073`.** A próxima é `0074`.

### 1.2 Código pronto e testado

| Arquivo | O que é | Estado |
|---|---|---|
| `lib/models/stl.ts` | Parser STL **binário e ASCII** + `signedMeshVolume` | 18 testes |
| `lib/models/viewer-presets.ts` | Modos de visualização, materiais, poses de câmera | 19 testes |
| `lib/models/tree.ts` | Árvore de pastas + `wouldCreateCycle` | 8 testes |
| `lib/models/config.ts` | Bucket, limites, `kindFromFilename`, tipos de linha | — |
| `app/app/models/_components/stl.worker.ts` | Worker bundleado que importa o parser | — |
| `app/app/models/_components/ThreeViewer.tsx` | Viewer: 5 modos, 6 materiais, modo Estúdio, captura PNG | — |
| `app/actions/models/actions.ts` | `fetchModels`, upload assinado, `saveModel`, `createModelDownloadUrl`, `moveFile`, `renameFile`, `deleteModel` | — |
| `app/actions/models/folders.ts` | `fetchTree`, `createFolder`, `renameFolder`, `setFolderIcon`, `moveFolder`, `deleteFolder` | **sem UI** |

**Código morto que você deve LIGAR, não reescrever:** todas as 6 actions de
`folders.ts`, mais `lib/models/tree.ts` e `lib/models/folder-icons.ts`. A árvore
de pastas existe no banco, na action e na lógica pura — falta só a interface.

### 1.3 Stack instalada

`next ^15` · `react ^18.3` · `typescript ^5.6` · `three ^0.185` +
`@types/three` · `zod ^3.23` · `tailwindcss ^3.4` · `vitest ^2.1` ·
`@playwright/test ^1.59` · `@hello-pangea/dnd ^17` (drag-and-drop, já usado no
kanban e na ordenação da vitrine).

**Não instalado ainda** — cada um exige justificativa de uma linha (CLAUDE.md):
`manifold-3d`, `three-mesh-bvh`, `meshoptimizer`, `clipper2`, `earcut`,
`fflate`, `comlink`, `opencascade.js`, `zustand`.

### 1.4 Padrões do repo que você DEVE reusar

- **Server Actions** em `app/actions/<dominio>/actions.ts`, com `requireCtx()`
  resolvendo org, e Zod em todo input externo.
- **Mapper puro** camelCase→snake_case em módulo separado e testado — ver
  `lib/products/patch.ts`. Não espalhe tradução de campo pelas actions.
- **Índice fracionário** para ordenação: `lib/kanban/fractional-indexing.ts`
  (`midpoint`). `sort_order` já é `numeric` nas duas tabelas de modelos.
- **Fila de eventos**: `emit_event()` grava em `event_log`; um worker consome.
  **Trigger Postgres nunca faz HTTP** — regra dura do CLAUDE.md.
- **Migrations**: arquivo versionado **+** apêndice idempotente em
  `supabase/baseline.sql` **+** linha no `MANIFEST.md`. Os três, sempre.

### 1.5 A armadilha que já custou caro aqui

**Leitura autenticada não pode sair do cliente do browser.** O cookie de sessão
é `httpOnly`, e o cliente Supabase do browser lê de `document.cookie` — ele
**nunca tem sessão**, e toda chamada sai como `anon`. Com RLS ativa isso não dá
erro: dá lista vazia, em silêncio.

Isso já quebrou o repositório 3D (arquivo em bucket privado que não abria em
outro dispositivo) e ainda afeta duas telas. Leia
`docs/runbooks/sessao-do-browser.md` **antes** de escrever qualquer acesso a
dado no cliente.

O padrão correto, para arquivo privado:

```ts
// servidor (Server Action)
const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
// browser
const res = await fetch(data.signedUrl);   // sem sessão, a assinatura vai na URL
```

Referência funcionando: `createModelDownloadUrl` em `app/actions/models/actions.ts`.

`uploadToSignedUrl` e Realtime (`.channel()`) continuam válidos no browser.

---

## 2. Arquitetura alvo

### 2.1 Onde vive

Tudo dentro do CRM. Três rotas sob o item **Modelagem** da sidebar (Produção):

| Rota | Papel |
|---|---|
| `/app/models` | **Repositório** — árvore de pastas, upload, inspetor, foto de produto |
| `/app/models/editor` | **Modelador** — malha e paramétrico |
| `/app/models/cortes` | **Mesh Cut** — SmartCut, corte por plano, AutoCut, encaixes |

Não crie monorepo. Não crie um segundo deploy. O CRM já tem auth, org, Storage,
RLS e auditoria — reusar isso é a maior economia deste projeto.

**Custo a assumir:** `three` e os WASM engordam o bundle do CRM. Mitigação
obrigatória: as três rotas carregam tudo por `next/dynamic` com `ssr: false`,
como `ThreeViewer` já faz. Nenhuma dependência 3D pode entrar no bundle de quem
só abre o Dashboard.

### 2.2 Camadas

```
app/app/models/**            UI (client components, dynamic import)
app/actions/models/**        Server Actions — auth, org, Zod, Storage
lib/models/**                PURO: parsers, geometria, presets, árvore
app/app/models/_workers/**   Web Workers bundleados (importam lib/models)
supabase/migrations/**       schema versionado
```

**Regra que decide onde o código mora:** se depende de `window`, `three` ou
`self`, não entra em `lib/models/**`. O que está lá tem de rodar no Vitest sem
jsdom. Foi o que permitiu testar o parser de STL — quando ele morava em
`public/`, era intestável, e a ausência de suporte a ASCII passou despercebida.

### 2.3 Representação interna

```ts
export interface MeshData {
  positions: Float32Array;   // xyz por vértice
  indices?: Uint32Array;     // opcional: STL vem sem índice
  normals?: Float32Array;
  bounds: { min: [number,number,number]; max: [number,number,number] };
}
```

- **Unidade interna é sempre milímetro.** Conversão só na borda (import/export/UI).
  O banco já guarda `volume_cm3` — a conversão acontece na escrita.
- Malha entre worker e main thread vai como **transferable**. Nunca
  `structuredClone` de um Float32Array de 26 MB.
- Acima de ~2M triângulos, gere um LOD decimado para o viewport e mantenha a
  malha original para operações e export.

### 2.4 Workers

O padrão já está estabelecido em `app/app/models/_components/stl.worker.ts`:

```ts
const worker = new Worker(new URL("./x.worker.ts", import.meta.url), { type: "module" });
```

Worker bundleado, importando de `lib/models`. **Não** volte a colocar worker em
`public/` — é o que impede o teste.

Cuidado de tipagem: o tsconfig carrega a lib DOM, então `self` vem tipado como
`Window`. Declare um escopo mínimo (`interface WorkerScope`) e faça
`self as unknown as WorkerScope` — sem `any`.

---

## 3. Escopo, em ordem de entrega

Cada fase entrega algo usável e verificável. Não pule.

### FASE 1 — Repositório completo (a base)

O que falta para a tela atual ficar completa:

- **Árvore de pastas na UI** — as 6 actions e `tree.ts` já existem. Arrastar
  arquivo entre pastas com `@hello-pangea/dnd`; `wouldCreateCycle` antes de todo
  move de pasta.
- **Ordenar** por nome, data, tamanho, triângulos; posição manual em
  `sort_order` com `midpoint()`.
- **Miniatura no Storage.** Hoje é data URL de até 200 KB numa coluna `text`,
  trafegada no HTML a cada carga. Com 50 modelos vira 10 MB de HTML. Migre para
  arquivo + URL assinada, mantendo a data URL como fallback.
- **Import 3MF** (`fflate` + parser XML). É o formato correto para impressão:
  unidade explícita, cor, múltiplos objetos.

**Aceite:** subir um 3MF de 20 MB, organizar em pastas, recarregar em outro
dispositivo e ver o mesmo estado.

### FASE 2 — Operações de malha

- `three-mesh-bvh` para raycast e seleção
- Seleção: vértice, aresta, face, ilha, por ângulo, caixa, laço
- Booleanos com `manifold-3d` (garante manifold na saída)
- Modificadores: mirror, array, subdivide, decimate, remesh, smooth, offset,
  hollow com furos de drenagem
- **Análise e reparo**: non-manifold, faces invertidas, buracos, componentes
  soltos, vértices duplicados — com relatório "pronto para impressão"

**Aceite:** malha não-manifold com buracos entra e sai watertight, com relatório
antes/depois.

### FASE 3 — Cortes

- Corte por plano com medida e trava de eixo
- **SmartCut**: BVH acha o triângulo semente; flood-fill na half-edge aceitando
  o vizinho quando o ângulo diedro < sensibilidade
- **AutoCut**: extrair fronteira da seleção, costurar loops, suavizar
  (Laplaciano reprojetado na malha via BVH), construir superfície de corte,
  boolean
- **Encaixes**: pino cilíndrico, dovetail, puzzle, bolso de ímã — com folga
  paramétrica (FDM 0,20 mm no raio; resina 0,08 mm) e boolean automático nas
  duas partes
- **Cut to fit**: dividir para caber no volume da impressora, com bin-packing

**Aceite:** modelo maior que a mesa é dividido em N partes com encaixe, todas
cabem, exporta 3MF multi-objeto.

### FASE 4 — Paramétrico

`opencascade.js` (OCCT WASM): sketch com restrições, extrude, revolve, loft,
sweep, fillet, chamfer, shell, hole, pattern. Feature tree com recomputação
incremental. Import/export STEP e IGES.

**O problema difícil desta fase é o naming persistente**: não referencie face ou
aresta por índice — o índice muda quando a feature anterior recalcula. Gere um
nome estável (hash de feature de origem + tipo de superfície + centroide e área
quantizados) e resolva por melhor correspondência. Documente em
`docs/algorithms/persistent-naming.md`.

### FASE 5 — Fatiador — **IMPLEMENTADA**

Feita fora de ordem, antes das fases 3 e 4. Vive em `lib/slicer/` (puro e
testado) + `/app/models/fatiar` (tela). **Nada vem de CuraEngine, PrusaSlicer,
Slic3r ou OrcaSlicer** — ver §12.

| Módulo | O quê |
|---|---|
| `slice.ts` | plano × triângulo → contornos fechados; costura por hash de grade com consulta às 9 células vizinhas |
| `perimeters.ts` | N paredes compensadas por `lineWidth`, booleanos 2D. Usa **`clipper-lib`** (BSL), não `clipper2-js` — ver a nota no arquivo |
| `infill.ts` | varredura; grade, linhas, triângulo; respeita furo |
| `pipeline.ts` | topo/base sólidos por interseção das `n` camadas vizinhas |
| `supports.ts` | balanço por ângulo; a camada 0 apoia na mesa |
| `adhesion.ts` | skirt e brim, só o contorno externo (nada dentro do furo) |
| `seam.ts` | costura: canto / alinhada / atrás / mais próxima / aleatória + **cachecol (scarf)** |
| `combing.ts` | não retrai quando o salto não sai da peça |
| `gcode.ts` | `;TYPE:` por tipo, retração, ventoinha em rampa, estimativas |

**G-code emitido:** `;TYPE:SKIRT`, `BRIM`, `WALL-OUTER`, `WALL-INNER`, `FILL`,
`SUPPORT`; retração com `E` absoluto (`M82`); `M106`/`M107` só quando o valor
muda.

Medido nas peças reais do Storage (Acoplamento 2.602 tri, PAYLOAD 832 tri): 357
e 774 camadas, **0 contornos abertos**, `E` monotônico nas extrusões, sem `NaN`.

**O combing não é opcional.** Sem ele, retração a cada salto de preenchimento:
24.271 retrações no Acoplamento e +47 min de estimativa. Com ele, 537 e +4 min.
Quem mexer em `emitTravel` precisa saber disso — está comentado no código com o
número medido.

**Orientação automática** (`lib/models/orientation.ts`) — os candidatos a "para
baixo" são as normais das próprias faces, agrupadas por direção; cada um recebe
nota de suporte, apoio na mesa e altura. Medido no PAYLOAD: suporte **22,85 →
0,62 cm³ (−97%)**, tempo 4h46 → 3h06, 26,6 g a menos de filamento. No
Acoplamento diz corretamente para NÃO girar — já estava bem posicionado.

A nota de suporte é um PROXY para ordenar candidatos, não o volume real (no
PAYLOAD o proxy dá 178 cm³ contra 22,85 reais). O volume exato sai do
`generateSupports`, que exige o fatiamento inteiro e é caro demais para 60
candidatos.

**Ainda falta:** z-hop, detecção de ponte, raft, altura de camada variável e
ironing.

**Aceite (NÃO cumprido):** G-code gerado imprime numa impressora real da
GLTech3D. Nenhuma peça foi impressa a partir deste código até agora. A validação
é física e não pode ser feita por teste automatizado.

### FASE 6 — Conversão CAD

Ver §6. Fila via `event_log` + worker, como o resto do repo.

---

## 4. Formatos

| Formato | Import | Export | Como |
|---|---|---|---|
| STL bin/ASCII | ✔ | ✔ | `lib/models/stl.ts` — **já pronto** |
| 3MF | ✔ | ✔ | `fflate` + XML. Prioridade: é o formato certo para impressão |
| OBJ / PLY / GLB | ✔ | ✔ | loaders do `three` |
| STEP / IGES | ✔ | ✔ | `opencascade.js` (Fase 4) |
| G-code | — | ✔ | `lib/slicer/gcode.ts` — **já pronto** |

### Sobre IPT, IAM, SLDPRT — a parte que os specs erram

- **`.ipj` não contém geometria.** É o arquivo de *projeto* do Inventor. A peça
  está em `.ipt`, a montagem em `.iam`. Pedir `.ipj` ao usuário não traz modelo
  nenhum.
- **`.ipt`, `.iam`, `.sldprt`, `.sldasm` são binários proprietários fechados.**
  Não existe leitor open source confiável. Qualquer promessa em contrário na UI
  é mentira que vira suporte.

Caminhos, nesta ordem:

1. **Padrão, grátis:** a tela de import detecta a extensão e instrui — *"Exporte
   como STEP (.step/.stp) no seu CAD e importe aqui"*. STEP preserva o sólido
   B-Rep e é lido pelo OCCT.
2. **Pago, opcional:** Autodesk Platform Services (Model Derivative), CAD
   Exchanger SDK ou Datakit. Modele como job assíncrono: upload → `event_log` →
   worker → STEP no Storage → import automático.
3. **Nunca falhe em silêncio.** Diga qual caminho está ativo.

---

## 5. Persistência

Reuse o que existe: `models_3d` + `model_folders` + bucket `models-3d`.

Para o editor, acrescente um formato de projeto **`.n3d`** (container zip via
`fflate`):

```
projeto.n3d
├── manifest.json     versão do schema, unidade, appVersion
├── document.json     parâmetros + feature tree
├── scene.json        partes, transforms, materiais, câmera
├── meshes/<id>.bin   posições/índices quantizados
└── thumbnail.png
```

Versione o schema e escreva migração (`v1_to_v2.ts`) desde o primeiro dia. O
arquivo tem de abrir offline — é autocontido — e é o mesmo objeto salvo no
Storage.

**Nova tabela só se necessário.** `models_3d` já tem `kind`, `folder_id`,
`sort_order` e `bounding_box`. Antes de criar coluna, aplique a doutrina DIRC do
CLAUDE.md: Duplicar, Integrar, Referenciar ou **Calcular**.

---

## 6. Créditos e jobs

**Não existe** sistema de créditos neste repo — não invente um. O que existe é
`event_log` + workers por cron, e é esse o padrão para trabalho pesado
(conversão CAD, slicing server-side, reparo pesado).

Se você for cobrar por operação, isso é decisão de produto e precisa de tabela
nova, migration e ADR. Pergunte antes.

---

## 7. Licenciamento — requisito de negócio

| Software | Licença | Decisão |
|---|---|---|
| Blender, Meshmixer | GPL-3 / proprietário | **Não usar código.** Só inspiração funcional |
| CuraEngine, PrusaSlicer, Slic3r | **AGPL-3** | **Não embutir.** AGPL obriga a abrir o código para qualquer usuário que acesse pela rede — incompatível com SaaS fechado. Por isso o fatiador é próprio |
| `manifold-3d` | Apache-2.0 | OK |
| `three`, `three-mesh-bvh`, `meshoptimizer`, `earcut`, `fflate` | MIT/ISC | OK |
| `clipper2` | BSL-1.0 | OK |
| `opencascade.js` | LGPL-2.1 + exceção | OK como binário **não modificado**, isolado em `vendor/`, com atribuição |

Mantenha `THIRD_PARTY.md` gerado por script. Clonar **funcionalidade** é
legítimo; clonar código, marca ou identidade visual não é.

---

## 8. Performance — alvos que bloqueiam a entrega

| Cenário | Alvo |
|---|---|
| Abrir STL de 30 MB (~600k faces) | < 3 s até o primeiro render |
| SmartCut em 600k faces | < 120 ms |
| Corte por plano em 600k faces | < 800 ms |
| Boolean 500k tri | < 5 s em worker, com progresso |
| Viewport com 2M tri | ≥ 45 FPS em GPU integrada |

Obrigatório: `transferable` em todo `postMessage`; pool de workers dimensionado
por `hardwareConcurrency - 1`; BVH com SAH para malha estática; LOD + frustum
culling; `performance.mark/measure` nas operações de core.

Se usar threads WASM (`SharedArrayBuffer`), COOP/COEP precisam ser ligados — e
**COEP quebra imagens e iframes de terceiros sem CORP**. Aplique só nas rotas do
editor, nunca global; o CRM carrega mídia do Supabase e da landing.

---

## 9. Definition of Done

Além do que o CLAUDE.md já exige:

1. `npm run typecheck && npm run lint && npm run test:unit && npm run build` limpos
2. Cobertura ≥ 80% em `lib/models/**`
3. Benchmarks dentro dos alvos do §8
4. **Nenhuma leitura autenticada saindo do cliente do browser** (§1.5)
5. Mudança de schema com os três artefatos (migration + baseline + MANIFEST)
6. Algoritmo novo documentado em `docs/algorithms/`
7. Nenhuma dependência copyleft forte sem ADR aprovado
8. Sem `console.log` esquecido; erro sempre tratado ou propagado

---

## 10. Primeira tarefa

1. Leia `CLAUDE.md`, `docs/runbooks/sessao-do-browser.md` e os arquivos listados
   em §1.2.
2. Produza `docs/adr/0001-modelagem-3d-no-crm.md` com: o que você vai reusar, o
   que vai escrever, as dependências novas com justificativa de uma linha cada,
   e como vai impedir que o bundle 3D vaze para as outras rotas.
3. **Pare para confirmação.**
4. Aprovado, execute a **Fase 1** numa branch `feat/modelagem-3d-fase-1`, com
   commits atômicos, mantendo `/app/models` funcional a cada commit.

Ao fim de cada fase entregue: o que mudou, como testar à mão, riscos conhecidos
e o que ficou pendente.

---

## 11. Avaliação honesta de prazo

Este documento descreve de 6 a 12 meses de trabalho para uma pessoa
experiente. As fases 4 (paramétrico) e 5 (fatiador) são, cada uma, um produto
por si só — empresas inteiras existem só para fazer o fatiador.

A Fase 1 é entregável em dias e já resolve o que mais dói hoje: organizar,
encontrar e usar os arquivos de qualquer lugar. Comece por ela e reavalie o
resto com o módulo em uso.
