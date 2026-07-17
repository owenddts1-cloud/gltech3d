"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { saveFinancialRecords, deleteFinancialRecord, type FinancialRecord } from "@/app/actions/control/actions";
import { syncControlToModules } from "@/app/actions/control/sync";
import { SpreadsheetGrid, type ColumnDef, parseToISODate } from "./SpreadsheetGrid";
import { ControlDashboard } from "./ControlDashboard";
import { exportCSV, exportXLSX, exportPDF } from "../_lib/export";
import {
  commit, undo as undoHistory, redo as redoHistory, type HistoryState
} from "../_lib/history";
import { Plus, Check, AlertTriangle, FileSpreadsheet, Loader2, Save, Trash2, Download, RefreshCw, Undo2, Redo2, FileText, FileSpreadsheet as FileXlsx, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

interface ControlClientProps {
  initialRecords: FinancialRecord[];
}

interface SheetTab {
  id: string;
  name: string;
  isCustom?: boolean;
}

/** Rótulos iniciais de Categoria. Absorveu a antiga coluna Venda/Insumo — daí Venda e Insumo
 *  estarem aqui. O usuário edita este conjunto pelo menu do cabeçalho. */
const DEFAULT_CATEGORY_LABELS = ["Venda", "Insumo", "Filamentos", "Ferramentas", "Outros"];

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Data", width: "w-28", align: "center", type: "date" },
  { key: "month", label: "Mês", width: "w-16", align: "center", type: "text" },
  { key: "quantity", label: "Quantidade", width: "w-20", align: "center", type: "number" },
  { key: "description", label: "Descrição", width: "w-60", align: "left", type: "text" },
  { key: "type", label: "Tipo", width: "w-28", align: "center", type: "select", options: ["Receita", "Despesa"] },
  { key: "category", label: "Categoria", width: "w-44", align: "left", type: "select", options: DEFAULT_CATEGORY_LABELS },
  { key: "platform", label: "Plataforma", width: "w-36", align: "center", type: "select", options: ["B2B", "Shopee", "Facebook", "Mercado Livre", "TikTok Shop", "Olx", ""] },
  { key: "revenue", label: "Receita (R$)", width: "w-28", align: "right", type: "number" },
  { key: "expense", label: "Despesa (R$)", width: "w-28", align: "right", type: "number" },
  { key: "installments", label: "Parcelas", width: "w-20", align: "center", type: "text" }
];

/** Intervalo do salvamento automático. */
const AUTOSAVE_MS = 2 * 60 * 1000;
/** Teto da pilha de undo — o suficiente para desfazer uma sessão de edição sem inchar a memória. */
const HISTORY_LIMIT = 100;

export function ControlClient({ initialRecords }: ControlClientProps) {
  // setRecordsRaw moves the grid without touching history — used by DB syncs, undo and redo.
  // User edits must go through commitRecords() instead, so they land on the undo stack.
  const [records, setRecordsRaw] = useState<FinancialRecord[]>(initialRecords);
  const [past, setPast] = useState<FinancialRecord[][]>([]);
  const [future, setFuture] = useState<FinancialRecord[][]>([]);
  const [dbRecords, setDbRecords] = useState<FinancialRecord[]>(initialRecords);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [tabs, setTabs] = useState<SheetTab[]>([
    { id: "dashboard", name: "Dashboard" },
    { id: "lancamentos", name: "Lançamentos" }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  // Autosave silencioso: indicador discreto, sem desabilitar a barra nem trocar o banner
  // de status — é o que fazia a planilha "travar" a cada gravação.
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Espelhos em ref para o autosave assíncrono ler sempre o estado mais recente:
  // se o usuário continua editando durante a gravação, essas refs evitam que a
  // conclusão de um save antigo reverta as edições novas.
  const recordsRef = useRef(records);
  const dbRecordsRef = useRef(dbRecords);
  const isDirtyRef = useRef(isDirty);
  useEffect(() => { recordsRef.current = records; }, [records]);
  useEffect(() => { dbRecordsRef.current = dbRecords; }, [dbRecords]);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // Dynamic columns state loaded/saved to localStorage
  const [columns, setColumns] = useState<ColumnDef[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("gltech3d-control-columns");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error("Erro ao carregar colunas do localStorage:", e);
      }
    }
    return DEFAULT_COLUMNS;
  });

  useEffect(() => {
    try {
      localStorage.setItem("gltech3d-control-columns", JSON.stringify(columns));
    } catch (e) {
      console.error("Erro ao salvar colunas no localStorage:", e);
    }
  }, [columns]);

  // Sync state with props and normalize dates to standard ISO strings.
  // Guard: só absorve o estado do servidor quando NÃO há edições locais pendentes.
  // Sem isso, qualquer novo `initialRecords` (ex.: um revalidate disparado por outro
  // fluxo) sobrescreveria o grid e apagaria alterações ainda não salvas — era o que
  // fazia "sumir informações de algumas colunas" ao excluir uma linha.
  useEffect(() => {
    if (isDirtyRef.current) return;
    const normalized = initialRecords.map(r => {
      const isoDate = parseToISODate(r.date);
      if (isoDate && isoDate !== r.date) {
        return { ...r, date: isoDate };
      }
      return r;
    });
    setRecordsRaw(normalized);
    setDbRecords(normalized);
    setIsDirty(false);
  }, [initialRecords]);

  // ─── Undo / Redo ──────────────────────────────────────────────
  // Stack logic lives in _lib/history.ts as pure functions (tested there). Here we only
  // fan the resulting snapshot back into the three pieces of state — each setter gets a
  // plain value, never a nested updater, since StrictMode invokes updaters twice.
  const applyHistory = useCallback((next: HistoryState<FinancialRecord[]>) => {
    setRecordsRaw(next.present);
    setPast(next.past);
    setFuture(next.future);
  }, []);

  const commitRecords = useCallback((next: FinancialRecord[]) => {
    applyHistory(commit({ present: records, past, future }, next, HISTORY_LIMIT));
  }, [records, past, future, applyHistory]);

  const undo = useCallback(() => {
    applyHistory(undoHistory({ present: records, past, future }));
  }, [records, past, future, applyHistory]);

  const redo = useCallback(() => {
    applyHistory(redoHistory({ present: records, past, future }, HISTORY_LIMIT));
  }, [records, past, future, applyHistory]);

  // Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z). Ignored while typing in a cell editor, otherwise
  // undo would fight the input's own native undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Fecha o menu de exportação ao clicar fora dele.
  useEffect(() => {
    if (!exportMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as Element;
      if (!el.closest(".export-menu-pop") && !el.closest(".export-menu-btn")) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [exportMenuOpen]);

  // Ribbon menus
  const [activeMenuTab, setActiveMenuTab] = useState<string>("inicio");

  // Custom sheet data state: sheetId -> 2D grid array of strings
  const [customSheetsData, setCustomSheetsData] = useState<Record<string, string[][]>>({});

  // Detect dirty state
  useEffect(() => {
    const hasChanges = JSON.stringify(records) !== JSON.stringify(dbRecords);
    setIsDirty(hasChanges);
  }, [records, dbRecords]);

  // Save changes to database.
  // `silent` (autosave) não desabilita a UI nem mostra o banner de "Salvando" —
  // grava em segundo plano com um indicador discreto. Só as linhas que mudaram
  // (diff contra o snapshot do banco) sobem, deixando a gravação leve e imperceptível.
  const handleSave = async (customRecords?: FinancialRecord[], opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    const source = customRecords || records;

    // Diff: linhas novas (id temp) ou alteradas em relação ao snapshot do banco.
    const dbById = new Map(dbRecords.map(r => [r.id, JSON.stringify(r)]));
    const dirty = source.filter(r => dbById.get(r.id) !== JSON.stringify(r));
    if (dirty.length === 0) { setIsDirty(false); return; }

    const setBusy = silent ? setIsAutosaving : setIsSaving;
    setBusy(true);
    try {
      const recordsToUpsert = dirty.map(r => ({
        id: r.id,
        date: r.date,
        month: r.month,
        quantity: r.quantity,
        description: r.description,
        type: r.type,
        category: r.category,
        revenue: r.revenue,
        expense: r.expense,
        installments: r.installments,
        platform: r.platform || "",
        custom_fields: r.custom_fields || {}
      }));

      const res = await saveFinancialRecords(recordsToUpsert);
      if (res.ok) {
        // Reconciliação contra o estado MAIS RECENTE (via ref), não contra o snapshot
        // capturado no início: se o usuário editou durante a gravação, essas edições
        // ficam em recordsRef e não podem ser revertidas. Só trocamos os ids temporários
        // pelos uuids reais — senão o próximo save reinsere a linha como nova (duplicata).
        const swapId = (id: string) => res.idMap[id] ?? id;
        const latest = recordsRef.current.map(r =>
          res.idMap[r.id] ? { ...r, id: res.idMap[r.id]! } : r
        );
        setRecordsRaw(latest);

        // dbRecords passa a refletir o que foi persistido: snapshot anterior + linhas sujas
        // (com id trocado). Linhas editadas depois continuam divergindo → seguem "sujas" e
        // entram no próximo ciclo de autosave.
        const persistedDirty = new Map(dirty.map(r => [swapId(r.id), { ...r, id: swapId(r.id) }]));
        const mergedDb = new Map(dbRecordsRef.current.map(r => [r.id, r]));
        persistedDirty.forEach((v, k) => mergedDb.set(k, v));
        // Alinha a ordem/composição de dbRecords com `latest` para o cálculo de "sujo".
        const nextDb = latest.map(r => mergedDb.get(r.id) ?? r);
        setDbRecords(nextDb);

        setSelectedRowId(prev => (prev ? swapId(prev) : null));
        if (!silent) toast.success("Planilha salva com sucesso!");
      } else {
        toast.error("Erro ao salvar planilha: " + res.error);
      }
    } catch (err) {
      toast.error("Erro ao salvar: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  // ─── Autosave ─────────────────────────────────────────────────
  // Kept behind a ref so the timer always calls the current closure: handleSave reads
  // `records`, and a captured stale copy would silently persist outdated rows.
  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });

  useEffect(() => {
    if (!isDirty || isSaving || isAutosaving) return;
    const timer = setTimeout(() => { void handleSaveRef.current(undefined, { silent: true }); }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [isDirty, isSaving, isAutosaving]);

  // Add a new row to the table
  const handleAddRow = () => {
    const today = new Date();
    const months = ["JAN.", "FEV.", "MAR.", "ABR.", "MAI.", "JUN.", "JUL.", "AGO.", "SET.", "OUT.", "NOV.", "DEZ."];
    const curMonth = months[today.getMonth()];
    // Local date, not toISOString(): in UTC-3 that returns tomorrow after 21:00 and would
    // disagree with curMonth (local) at a month boundary.
    const curDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const newRecord: FinancialRecord = {
      id: `temp-${Date.now()}`,
      date: curDateStr || "",
      month: curMonth || "",
      quantity: 1,
      description: "Novo lançamento",
      type: "Despesa",
      category: "Outros",
      revenue: 0,
      expense: 0,
      installments: "1",
      platform: "",
      custom_fields: {}
    };

    const updated = [newRecord, ...records];
    commitRecords(updated);
    // Switch to launches tab to let the user see it
    setActiveTab("lancamentos");
    setSelectedRowId(newRecord.id);
    toast.success("Nova linha adicionada!");
  };

  // Delete the selected row
  const handleDeleteRow = async () => {
    if (!selectedRowId) {
      toast.error("Selecione um lançamento (linha) primeiro clicando nele.");
      return;
    }

    const recordToDelete = records.find(r => r.id === selectedRowId);
    if (!recordToDelete) return;

    if (recordToDelete.id.startsWith("temp-")) {
      // Just local delete
      commitRecords(records.filter(r => r.id !== selectedRowId));
      setSelectedRowId(null);
      toast.success("Lançamento removido localmente.");
      return;
    }

    if (!confirm(`Deseja realmente excluir o lançamento "${recordToDelete.description}"?`)) {
      return;
    }

    setIsSaving(true);
    try {
      const res = await deleteFinancialRecord(recordToDelete.id);
      if (res.ok) {
        const updated = records.filter(r => r.id !== selectedRowId);
        setRecordsRaw(updated);
        setDbRecords(dbRecords.filter(r => r.id !== selectedRowId));
        setSelectedRowId(null);
        toast.success("Lançamento excluído com sucesso.");
      } else {
        toast.error("Erro ao excluir: " + res.error);
      }
    } catch (err) {
      toast.error("Erro na exclusão: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  // Revert changes
  const handleRevert = () => {
    if (confirm("Deseja descartar as alterações não salvas?")) {
      commitRecords(dbRecords);
      toast.success("Alterações descartadas.");
    }
  };

  // Add custom sheet
  const handleAddTab = () => {
    const name = prompt("Digite o nome da nova aba:");
    if (!name || !name.trim()) return;

    const id = `sheet-${Date.now()}`;
    const newTab: SheetTab = { id, name: name.trim(), isCustom: true };
    setTabs([...tabs, newTab]);
    
    // Initialize 50x10 empty grid for this sheet
    const emptyGrid = Array.from({ length: 50 }, () => Array(10).fill(""));
    setCustomSheetsData(prev => ({
      ...prev,
      [id]: emptyGrid
    }));
    
    setActiveTab(id);
    toast.success(`Aba "${name}" criada!`);
  };

  // Add column action
  const handleAddColumn = () => {
    const label = prompt("Digite o nome da nova coluna:");
    if (!label || !label.trim()) return;

    const typeChoice = prompt("Escolha o tipo da coluna (1 para Texto, 2 para Número, 3 para Data):", "1");
    let type: "text" | "number" | "date" = "text";
    if (typeChoice === "2") type = "number";
    if (typeChoice === "3") type = "date";

    const key = `custom_${Date.now()}`;
    const newCol: ColumnDef = {
      key,
      label: label.trim(),
      width: "w-36",
      align: type === "number" ? "right" : (type === "date" ? "center" : "left"),
      type,
      isCustom: true
    };

    setColumns([...columns, newCol]);
    toast.success(`Coluna "${label}" adicionada!`);
  };

  // Export in CSV / XLSX / PDF using the active columns configuration.
  // As libs pesadas (exceljs/jspdf) entram por import din\u00E2mico dentro de _lib/export.
  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    setExportMenuOpen(false);
    try {
      if (format === "csv") {
        exportCSV(records, columns);
        toast.success("CSV exportado com sucesso!");
      } else if (format === "xlsx") {
        await exportXLSX(records, columns);
        toast.success("Planilha XLSX exportada com sucesso!");
      } else {
        await exportPDF(records, columns);
        toast.success("PDF gerado com sucesso!");
      }
    } catch (err) {
      toast.error("Erro ao exportar: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Sincroniza a planilha com os módulos (Vendas, Contatos, O.S., Inventário, Consumíveis).
  // É idempotente no servidor; ainda assim confirmamos porque cria registros em vários módulos.
  const handleSync = async () => {
    if (isDirty && !confirm("Há alterações não salvas. Elas não entram na sincronização até você salvar. Sincronizar mesmo assim?")) return;
    if (!confirm("Criar/atualizar Vendas, Contatos, O.S., Ferramentas (inventário) e Consumíveis a partir das linhas da planilha? Rodar de novo não duplica.")) return;
    setIsSyncing(true);
    try {
      const res = await syncControlToModules();
      if (!res.ok) { toast.error("Erro ao sincronizar: " + res.error); return; }
      const r = res.result;
      const osTotal = r.osCreated + r.osUpdated;
      const parts = [
        r.salesCreated ? `${r.salesCreated} venda(s) nova(s)` : null,
        r.salesUpdated ? `${r.salesUpdated} venda(s) atualizada(s)` : null,
        r.contactsCreated ? `${r.contactsCreated} contato(s)` : null,
        osTotal ? `${osTotal} O.S.` : null,
        r.toolsCreated ? `${r.toolsCreated} ferramenta(s)` : null,
        r.consumablesCreated ? `${r.consumablesCreated} consumível(is)` : null,
      ].filter(Boolean);
      toast.success(parts.length ? `Sincronizado: ${parts.join(", ")}.` : "Nada novo para sincronizar.");
    } catch (err) {
      toast.error("Erro ao sincronizar: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.8rem)] bg-zinc-200 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden rounded-lg shadow-sm border border-zinc-400 dark:border-zinc-800 transition-all">
      
      {/* Title & Status Bar */}
      <div className="flex items-center justify-between border-b border-zinc-400 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="text-emerald-500 h-5 w-5" />
          <h1 className="text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-200">GLTech3D - Controle Financeiro.xlsx</h1>
          {isDirty && !isAutosaving && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
              <AlertTriangle size={10} />
              Pendências não salvas
            </span>
          )}
          {/* Autosave silencioso: indicador discreto, sem banner escuro nem UI travada. */}
          {isAutosaving && !isSaving && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
              <Loader2 size={10} className="animate-spin" />
              Salvando…
            </span>
          )}
          {!isDirty && !isSaving && !isAutosaving && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              <Check size={10} />
              Salvo na Nuvem
            </span>
          )}
          {isSaving && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded">
              <Loader2 size={10} className="animate-spin" />
              Salvando no banco...
            </span>
          )}
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 rounded bg-cyan-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-cyan-500 disabled:opacity-40"
            title="Criar Vendas, Contatos, O.S., Ferramentas e Consumíveis a partir da planilha"
          >
            {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            <span>{isSyncing ? "Sincronizando…" : "Sincronizar"}</span>
          </button>
          <button
            onClick={() => handleSave()}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-1.5 rounded bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-40"
            title="Salvar alterações no banco de dados"
          >
            <Save size={12} />
            <span>Salvar</span>
          </button>
          {isDirty && (
            <button
              onClick={handleRevert}
              disabled={isSaving}
              className="flex items-center gap-1 rounded bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors border border-zinc-300 dark:border-zinc-700"
            >
              Descartar
            </button>
          )}
        </div>
      </div>

      {/* Excel Ribbon Menu */}
      <div className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-400 dark:border-zinc-800 select-none shrink-0">
        {/* Ribbon Tabs */}
        <div className="flex bg-zinc-200 dark:bg-zinc-950 text-xs border-b border-zinc-400 dark:border-zinc-800 px-2">
          {["inicio", "inserir", "dados", "ajuda"].map((tabId) => {
            const labels: Record<string, string> = {
              inicio: "Página Inicial",
              inserir: "Inserir",
              dados: "Dados",
              ajuda: "Ajuda"
            };
            const active = activeMenuTab === tabId;
            return (
              <button
                key={tabId}
                onClick={() => setActiveMenuTab(tabId)}
                className={`px-4 py-1.5 font-medium transition-colors border-t-2 ${
                  active
                    ? "bg-zinc-100 dark:bg-zinc-900 text-orange-600 dark:text-orange-500 border-orange-500 font-semibold"
                    : "text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {labels[tabId]}
              </button>
            );
          })}
        </div>

        {/* Ribbon Actions Panel */}
        <div className="p-2 h-14 flex items-center gap-6 text-zinc-600 dark:text-zinc-300 text-xs">
          {activeMenuTab === "inicio" && (
            <>
              {/* Group: Histórico */}
              <div className="flex items-center gap-2 border-r border-zinc-300 dark:border-zinc-800 pr-4">
                <button
                  onClick={undo}
                  disabled={past.length === 0}
                  className="flex flex-col items-center justify-center p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors w-16 disabled:opacity-40 disabled:hover:bg-transparent"
                  title="Desfazer (Ctrl+Z)"
                >
                  <Undo2 size={14} className="text-zinc-600 dark:text-zinc-400" />
                  <span className="text-[10px] mt-0.5">Desfazer</span>
                </button>
                <button
                  onClick={redo}
                  disabled={future.length === 0}
                  className="flex flex-col items-center justify-center p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors w-16 disabled:opacity-40 disabled:hover:bg-transparent"
                  title="Refazer (Ctrl+Y)"
                >
                  <Redo2 size={14} className="text-zinc-600 dark:text-zinc-400" />
                  <span className="text-[10px] mt-0.5">Refazer</span>
                </button>
              </div>

              {/* Group: Ações Rápidas */}
              <div className="flex items-center gap-2 border-r border-zinc-300 dark:border-zinc-800 pr-4">
                <button
                  onClick={handleAddRow}
                  className="flex flex-col items-center justify-center p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors w-16"
                  title="Inserir nova linha na tabela"
                >
                  <Plus size={14} className="text-emerald-600 dark:text-emerald-500" />
                  <span className="text-[10px] mt-0.5">Nova Linha</span>
                </button>

                <button
                  onClick={handleDeleteRow}
                  disabled={!selectedRowId}
                  className="flex flex-col items-center justify-center p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors w-16 disabled:opacity-40 disabled:hover:bg-transparent"
                  title="Excluir linha selecionada"
                >
                  <Trash2 size={14} className="text-rose-600 dark:text-red-500" />
                  <span className="text-[10px] mt-0.5">Excluir Linha</span>
                </button>
              </div>

              {/* Group: Exportar (o antigo "Salvar DB" saiu — o salvamento fica só no
                  botão do topo + autosave). Agora é um menu com CSV / XLSX / PDF. */}
              <div className="flex items-center gap-2 border-r border-zinc-300 dark:border-zinc-800 pr-4">
                <div className="relative">
                  <button
                    onClick={() => setExportMenuOpen(o => !o)}
                    className="export-menu-btn flex flex-col items-center justify-center p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors w-16"
                    title="Exportar a planilha (CSV, Excel ou PDF)"
                  >
                    <Download size={14} className="text-blue-500 dark:text-blue-400" />
                    <span className="text-[10px] mt-0.5 flex items-center gap-0.5">Exportar<ChevronDown size={9} /></span>
                  </button>
                  {exportMenuOpen && (
                    <div className="export-menu-pop absolute left-0 top-full mt-1 z-50 w-44 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl py-1 text-left">
                      <button
                        onClick={() => handleExport("pdf")}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <FileText size={13} className="text-red-500" />
                        <span>PDF (2 páginas)</span>
                      </button>
                      <button
                        onClick={() => handleExport("xlsx")}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <FileXlsx size={13} className="text-emerald-600" />
                        <span>Excel (.xlsx)</span>
                      </button>
                      <button
                        onClick={() => handleExport("csv")}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <Download size={13} className="text-blue-500" />
                        <span>CSV</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Grid status helper */}
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex flex-col justify-center font-medium">
                <span>Dica: Clique duas vezes em qualquer célula para editá-la.</span>
                <span>Use setas, Tab ou Enter para navegar.</span>
              </div>
            </>
          )}

          {activeMenuTab === "inserir" && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddTab}
                className="flex items-center gap-1.5 px-3 py-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-xs text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-800"
              >
                <Plus size={14} className="text-emerald-500" />
                <span>Criar Nova Planilha (Aba)</span>
              </button>
              <button
                onClick={handleAddColumn}
                className="flex items-center gap-1.5 px-3 py-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-xs text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-800"
              >
                <Plus size={14} className="text-blue-500" />
                <span>Adicionar Coluna</span>
              </button>
            </div>
          )}

          {activeMenuTab === "dados" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport("pdf")}
                className="flex items-center gap-1.5 px-3 py-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-xs text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-800"
              >
                <FileText size={14} className="text-red-500" />
                <span>Exportar PDF</span>
              </button>
              <button
                onClick={() => handleExport("xlsx")}
                className="flex items-center gap-1.5 px-3 py-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-xs text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-800"
              >
                <FileXlsx size={14} className="text-emerald-600" />
                <span>Exportar Excel</span>
              </button>
              <button
                onClick={() => handleExport("csv")}
                className="flex items-center gap-1.5 px-3 py-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-xs text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-800"
              >
                <Download size={14} className="text-blue-400" />
                <span>Exportar CSV</span>
              </button>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-xs text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-800 disabled:opacity-40"
              >
                <RefreshCw size={14} className={`text-cyan-500 ${isSyncing ? "animate-spin" : ""}`} />
                <span>Sincronizar módulos</span>
              </button>
            </div>
          )}

          {activeMenuTab === "ajuda" && (
            <div className="flex items-center gap-4 text-[11px] text-zinc-400">
              <p>
                <strong>Planilha Financeira:</strong> Lançamentos alimentam os gráficos e painéis da aba <strong>Dashboard</strong>.
              </p>
              <p>
                Para classificar vendas e insumos, selecione a coluna correspondente na tabela de Lançamentos.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Spreadsheet Tabs Selector (Excel Style but positioned at the TOP for quick accessibility) */}
      <div className="flex items-center justify-between border-b border-zinc-400 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/90 px-2 py-1 select-none text-xs shrink-0">
        <div className="flex items-center overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-1 border-r border-zinc-400 dark:border-zinc-800 font-medium transition-all flex items-center gap-1.5 ${
                  active
                    ? "bg-white dark:bg-zinc-950 text-orange-600 dark:text-orange-500 font-semibold border-b-2 border-b-orange-500 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <span className="truncate">{tab.name}</span>
              </button>
            );
          })}

          <button
            onClick={handleAddTab}
            className="p-1.5 ml-1 text-zinc-500 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
            title="Criar nova aba de planilha"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="w-full h-full overflow-y-auto"
            >
              <ControlDashboard records={records} />
            </motion.div>
          )}

          {activeTab === "lancamentos" && (
            <motion.div
              key="lancamentos"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="w-full h-full"
            >
              <SpreadsheetGrid
                records={records}
                setRecords={commitRecords}
                selectedRowId={selectedRowId}
                setSelectedRowId={setSelectedRowId}
                columns={columns}
                setColumns={setColumns}
              />
            </motion.div>
          )}

          {/* Render custom sheet */}
          {tabs.find(t => t.id === activeTab)?.isCustom && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="w-full h-full"
            >
              <div className="w-full h-full flex flex-col p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-zinc-400">
                    Aba de rascunho local: <strong>{tabs.find(t => t.id === activeTab)?.name}</strong>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm("Deseja realmente remover esta aba?")) {
                        const updatedTabs = tabs.filter(t => t.id !== activeTab);
                        setTabs(updatedTabs);
                        setActiveTab("lancamentos");
                        toast.success("Aba removida.");
                      }
                    }}
                    className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition-colors bg-red-950/20 px-2 py-1 rounded border border-red-900/35"
                  >
                    <Trash2 size={12} />
                    <span>Remover Aba</span>
                  </button>
                </div>
                {/* Render a simple custom layout */}
                <div className="flex-1 overflow-auto border border-zinc-300 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900/50">
                  <table className="min-w-full divide-y divide-zinc-300 dark:divide-zinc-800 text-[11px]">
                    <thead className="bg-zinc-100 dark:bg-zinc-950 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-1.5 text-center text-zinc-400 dark:text-zinc-500 font-bold border-r border-zinc-300 dark:border-zinc-800 w-10 bg-zinc-100 dark:bg-zinc-950"></th>
                        {Array.from({ length: 10 }).map((_, i) => (
                          <th key={i} className="px-3 py-1.5 text-center font-semibold text-zinc-600 dark:text-zinc-400 border-r border-zinc-300 dark:border-zinc-800 uppercase w-32">
                            {String.fromCharCode(65 + i)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-400 dark:divide-zinc-800">
                      {Array.from({ length: 50 }).map((_, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/25 bg-white dark:bg-transparent">
                          <td className="px-2 py-1 text-center font-semibold text-zinc-500 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-950 border-r border-zinc-400 dark:border-zinc-800 select-none">
                            {rowIndex + 1}
                          </td>
                          {Array.from({ length: 10 }).map((_, colIndex) => {
                            const grid = customSheetsData[activeTab] || [];
                            const val = grid[rowIndex]?.[colIndex] || "";
                            return (
                              <td key={colIndex} className="p-0 border-r border-zinc-400 dark:border-zinc-800 relative">
                                <input
                                  type="text"
                                  value={val}
                                  onChange={(e) => {
                                    const updatedGrid = [...grid];
                                    if (!updatedGrid[rowIndex]) {
                                      updatedGrid[rowIndex] = Array(10).fill("");
                                    }
                                    updatedGrid[rowIndex][colIndex] = e.target.value;
                                    setCustomSheetsData(prev => ({
                                      ...prev,
                                      [activeTab]: updatedGrid
                                    }));
                                  }}
                                  className="w-full bg-transparent px-2 py-1 text-zinc-800 dark:text-zinc-200 outline-none focus:bg-zinc-50 dark:focus:bg-zinc-950 focus:ring-1 focus:ring-orange-500"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
 
      {/* Status Bar Footer */}
      <div className="flex items-center justify-end border-t border-zinc-400 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-4 py-1.5 select-none text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0 font-medium">
        <span>Total de lançamentos: {records.length}</span>
      </div>

    </div>
  );
}
