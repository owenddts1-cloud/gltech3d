# Especificação Técnica de Arquitetura: Sistema Autônomo de Agentes de IA & Orquestração para Impressão 3D (FDM/FFF)

## 1. Escopo e Objetivos
Transformar o CRM/ERP `gltech3d` em um ecossistema autônomo orientado a eventos (EDA) operado por 4 agentes de IA especializados em Manufatura Aditiva Industrial.

## 2. Agentes Cognitivos & Ferramentas (Tool Calling)
1. **`PricingEngineAgent`**:
   - Ferramentas: `calculate_material_consumption`, `compute_machine_operating_cost`, `estimate_bench_labor_cost`.
   - Executa a precificação paramétrica sem densidade volumétrica, focando puramente em massa em gramas ($g$) e custo por massa ($R\$/kg$).
2. **`FarmOrchestratorAgent`**:
   - Ferramentas: `match_optimal_machine`, `dispatch_production_job`.
   - Seleciona a melhor impressora da farm por diâmetro de bico, necessidade de enclosure (ABS/ASA), unidade multi-material e menor fila.
3. **`InventorySentinelAgent`**:
   - Ferramentas: `reserve_and_deduct_spool_mass`, `evaluate_inventory_runout_risk`.
   - Gerencia dedução atômica de massa no carretel e alerta para resíduos $< 50g$.
4. **`CXPumpAgent`**:
   - Ferramentas: `generate_technical_proposal`, `dispatch_customer_update`.
   - Notifica o cliente em marcos de produção (ex: fatiado, em produção, QC com fotos, enviado).

## 3. Modelo Matemático de Custos
- **Custo Matéria-Prima**:
  $$M_{total} = M_{net} + M_{supp} + (N_{switches} \cdot M_{purge})$$
  $$C_{mat} = [M_{total} \times (1 + \alpha_{waste})] \times (P_{spool} / 1000)$$
- **Custo Operacional de Máquina**:
  $$C_{op} = T_{print} \times (D_{mach} + M_{prev} + E_{cost})$$
  onde $E_{cost} = (\bar{P}_{thermal} / 1000) \times \text{Tarifa}_{kWh}$.
- **Coeficiente de Risco**:
  $$F_{risk} = 1 + (k_{mat} + k_{geom} + k_{time})$$
- **Mão de Obra de Bancada**:
  $$C_{labor} = T_{labor\_total} \times (\text{Taxa}_{labor} / 60)$$
- **Preço de Venda**:
  $$PV = \frac{C_{fab} + C_{fixo\_indireto}}{1 - (MC + T_{tax})}$$

## 4. Estrutura de Dados & Supabase Migration (`0089_ai_agents_farm_system.sql`)
- `tenants` (configurações tarifárias)
- `machines` (inventário de impressoras)
- `spools_inventory` (carretéis com massa em gramas e check `>= 0`)
- `orders` & `order_items` (pedidos com telemetria e decomposição de custos)
- `production_jobs` (OS de produção com G-code, máquina, carretel e status QC)
- RLS Policies isolando tenants por `organization_id`.

## 5. Webhooks & Pipeline de Eventos
- Rota API `/api/v1/webhooks/ai-orchestrator` processando a esteira end-to-end de 6 etapas.
