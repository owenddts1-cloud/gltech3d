"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { type FinancialRecord } from "@/app/actions/control/actions";
import { Search, ChevronDown, ArrowUpDown, Filter, X, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ColumnDef {
  key: string;
  label: string;
  width: string;
  align: "left" | "center" | "right";
  type: "text" | "number" | "select" | "date";
  options?: string[];
  isCustom?: boolean;
}

interface SpreadsheetGridProps {
  records: FinancialRecord[];
  setRecords: (records: FinancialRecord[]) => void;
  selectedRowId: string | null;
  setSelectedRowId: (id: string | null) => void;
  columns: ColumnDef[];
  setColumns: (columns: ColumnDef[]) => void;
}

export function parseToISODate(input: string): string | null {
  if (!input) return null;
  const cleaned = input.trim();
  
  // Case 1: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Case 2: DD/MM/YYYY
  const brMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch && brMatch[1] && brMatch[2] && brMatch[3]) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    const year = brMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Case 3: DD-MM-YYYY
  const dashMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch && dashMatch[1] && dashMatch[2] && dashMatch[3]) {
    const day = dashMatch[1].padStart(2, '0');
    const month = dashMatch[2].padStart(2, '0');
    const year = dashMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  // Try fallback Date parsing if possible
  const timestamp = Date.parse(cleaned);
  if (!isNaN(timestamp)) {
    const date = new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  return null;
}

export const isCustomKey = (key: string) => {
  const standardKeys = ["date", "month", "quantity", "description", "type", "category", "revenue", "expense", "installments", "platform"];
  return !standardKeys.includes(key);
};

export function SpreadsheetGrid({ records, setRecords, selectedRowId, setSelectedRowId, columns, setColumns }: SpreadsheetGridProps) {
  // Navigation & Edit States
  const [activeCell, setActiveCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  
  // Filtering & Sorting States
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, { search: string; selectedValues: string[]; sort: "asc" | "desc" | null }>>({});
  
  const gridRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // Focus edit input automatically
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      if (editInputRef.current instanceof HTMLInputElement && editInputRef.current.type !== 'date') {
        editInputRef.current.select();
      }
    }
  }, [editingCell]);

  // Click outside listener for filters
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (openFilterCol && !(event.target as Element).closest(".filter-popover") && !(event.target as Element).closest(".filter-btn")) {
        setOpenFilterCol(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openFilterCol]);

  // Extract unique values for column filters
  const getUniqueValues = (key: string) => {
    const vals = records.map(r => {
      const v = isCustomKey(key) ? (r.custom_fields?.[key] || "") : r[key as keyof FinancialRecord];
      if (key === "revenue" || key === "expense") {
        return v ? Number(v).toFixed(2) : "0,00";
      }
      return v == null ? "" : String(v);
    });
    return Array.from(new Set(vals)).filter(v => v !== "").sort();
  };

  // Keyboard navigation logic
  const handleKeyDown = (e: React.KeyboardEvent, rowId: string, colKey: string, rowIndex: number, colIndex: number) => {
    if (editingCell) {
      if (e.key === "Enter") {
        e.preventDefault();
        saveCellEdit(rowId, colKey);
        setEditingCell(null);
        moveActiveCell(rowIndex + 1, colIndex);
      } else if (e.key === "Tab") {
        e.preventDefault();
        saveCellEdit(rowId, colKey);
        setEditingCell(null);
        if (e.shiftKey) {
          moveActiveCell(rowIndex, colIndex - 1);
        } else {
          moveActiveCell(rowIndex, colIndex + 1);
        }
      } else if (e.key === "Escape") {
        setEditingCell(null);
      } else if (e.key === "ArrowDown") {
        const isSelect = columns[colIndex]?.type === "select";
        if (!isSelect) {
          e.preventDefault();
          saveCellEdit(rowId, colKey);
          setEditingCell(null);
          moveActiveCell(rowIndex + 1, colIndex);
        }
      } else if (e.key === "ArrowUp") {
        const isSelect = columns[colIndex]?.type === "select";
        if (!isSelect) {
          e.preventDefault();
          saveCellEdit(rowId, colKey);
          setEditingCell(null);
          moveActiveCell(rowIndex - 1, colIndex);
        }
      }
      return;
    }

    // Not editing: allow typing a key to start editing instantly (Excel behavior)
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const record = records.find(r => r.id === rowId);
      if (record) {
        setEditingCell({ rowId, colKey });
        setEditValue(e.key);
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      // Enter edit mode
      const record = records.find(r => r.id === rowId);
      if (record) {
        setEditingCell({ rowId, colKey });
        const val = isCustomKey(colKey)
          ? (record.custom_fields?.[colKey] || "")
          : record[colKey as keyof FinancialRecord];
        setEditValue(val == null ? "" : String(val));
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        moveActiveCell(rowIndex, colIndex - 1);
      } else {
        moveActiveCell(rowIndex, colIndex + 1);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActiveCell(rowIndex - 1, colIndex);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActiveCell(rowIndex + 1, colIndex);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveActiveCell(rowIndex, colIndex - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      moveActiveCell(rowIndex, colIndex + 1);
    }
  };

  // Move active cell cursor (with optional auto-edit trigger)
  const moveActiveCell = (newRowIndex: number, newColIndex: number, autoEdit = false) => {
    if (newRowIndex >= 0 && newRowIndex < filteredRecords.length && newColIndex >= 0 && newColIndex < columns.length) {
      const targetRow = filteredRecords[newRowIndex];
      const targetCol = columns[newColIndex];
      if (targetRow && targetCol) {
        setActiveCell({ rowId: targetRow.id, colKey: targetCol.key });
        setSelectedRowId(targetRow.id);
        
        if (autoEdit) {
          const rawVal = isCustomKey(targetCol.key)
            ? (targetRow.custom_fields?.[targetCol.key] || "")
            : targetRow[targetCol.key as keyof FinancialRecord];
          setEditValue(rawVal == null ? "" : String(rawVal));
          setEditingCell({ rowId: targetRow.id, colKey: targetCol.key });
        }
        
        // Auto-scroll cell into view if needed
        setTimeout(() => {
          const cellElement = document.getElementById(`cell-${targetRow.id}-${targetCol.key}`);
          if (cellElement) {
            cellElement.scrollIntoView({ block: "nearest", inline: "nearest" });
          }
        }, 10);
      }
    }
  };

  // Save changes from editor to records
  const saveCellEdit = (rowId: string, colKey: string) => {
    let rawVal: string | number = editValue;

    // Auto format Month when editing date
    const additionalUpdates: Partial<FinancialRecord> = {};
    if (colKey === "date") {
      const isoDate = parseToISODate(editValue);
      if (isoDate) {
        rawVal = isoDate;
        const parsedDate = new Date(isoDate + "T00:00:00");
        if (!isNaN(parsedDate.getTime())) {
          const monthsShort = ["JAN.", "FEV.", "MAR.", "ABR.", "MAI.", "JUN.", "JUL.", "AGO.", "SET.", "OUT.", "NOV.", "DEZ."];
          additionalUpdates.month = monthsShort[parsedDate.getMonth()];
        }
      }
    }

    if (colKey === "quantity") {
      rawVal = parseInt(editValue, 10) || 1;
      if (rawVal < 0) rawVal = 0;
    } else if (colKey === "revenue" || colKey === "expense") {
      rawVal = parseFloat(editValue.replace(",", ".")) || 0;
      if (rawVal < 0) rawVal = 0;
      
      // Auto switch type and balance. Categoria is deliberately NOT touched here: its labels
      // are the user's own, so guessing one would silently overwrite a deliberate choice.
      if (colKey === "revenue" && rawVal > 0) {
        additionalUpdates.type = "Receita";
        additionalUpdates.expense = 0;
      } else if (colKey === "expense" && rawVal > 0) {
        additionalUpdates.type = "Despesa";
        additionalUpdates.revenue = 0;
      }
    } else if (colKey === "type") {
      // If changing type to Receita, move expense value to revenue and vice-versa
      const rec = records.find(r => r.id === rowId);
      if (rec) {
        if (editValue === "Receita") {
          additionalUpdates.revenue = rec.expense || rec.revenue || 0;
          additionalUpdates.expense = 0;
        } else {
          additionalUpdates.expense = rec.revenue || rec.expense || 0;
          additionalUpdates.revenue = 0;
        }
      }
    }

    const updated = records.map(r => {
      if (r.id === rowId) {
        if (isCustomKey(colKey)) {
          const currentCustomFields = r.custom_fields || {};
          return {
            ...r,
            custom_fields: {
              ...currentCustomFields,
              [colKey]: editValue
            }
          };
        }
        
        return {
          ...r,
          [colKey]: rawVal,
          ...additionalUpdates
        };
      }
      return r;
    });

    setRecords(updated);
  };

  // Filter and sort computation
  const filteredRecords = useMemo(() => {
    let result = [...records];

    // 1. Apply column filters
    Object.entries(filters).forEach(([colKey, filterState]) => {
      // Apply search
      if (filterState.search) {
        const query = filterState.search.toLowerCase();
        result = result.filter(r => {
          const val = isCustomKey(colKey)
            ? (r.custom_fields?.[colKey] || "")
            : r[colKey as keyof FinancialRecord];
          return val == null ? false : String(val).toLowerCase().includes(query);
        });
      }
      // Apply checkboxes
      if (filterState.selectedValues && filterState.selectedValues.length > 0) {
        result = result.filter(r => {
          const val = isCustomKey(colKey)
            ? (r.custom_fields?.[colKey] || "")
            : r[colKey as keyof FinancialRecord];
          const valStr = (colKey === "revenue" || colKey === "expense")
            ? (val ? Number(val).toFixed(2) : "0,00")
            : String(val ?? "");
          return filterState.selectedValues.includes(valStr);
        });
      }
    });

    // 2. Apply sorting
    const activeSortCol = Object.entries(filters).find(([_, f]) => f.sort !== null);
    if (activeSortCol) {
      const [colKey, filterState] = activeSortCol;
      const asc = filterState.sort === "asc";

      result.sort((a, b) => {
        const rawA = isCustomKey(colKey) ? (a.custom_fields?.[colKey] || "") : a[colKey as keyof FinancialRecord];
        const rawB = isCustomKey(colKey) ? (b.custom_fields?.[colKey] || "") : b[colKey as keyof FinancialRecord];
        const valA = rawA ?? "";
        const valB = rawB ?? "";

        if (colKey === "revenue" || colKey === "expense" || colKey === "quantity") {
          const numA = valA === "" ? 0 : Number(valA);
          const numB = valB === "" ? 0 : Number(valB);
          return asc ? numA - numB : numB - numA;
        }
        if (colKey === "date") {
          const isoA = parseToISODate(String(valA)) || "";
          const isoB = parseToISODate(String(valB)) || "";
          if (!isoA && !isoB) return 0;
          if (!isoA) return 1;
          if (!isoB) return -1;
          return asc
            ? isoA.localeCompare(isoB)
            : isoB.localeCompare(isoA);
        }
        
        return asc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return result;
  }, [records, filters]);

  // Handle individual filter toggle
  const toggleFilterValue = (colKey: string, value: string) => {
    const colFilter = filters[colKey] || { search: "", selectedValues: [], sort: null };
    const idx = colFilter.selectedValues.indexOf(value);
    const newSelected = [...colFilter.selectedValues];
    if (idx > -1) {
      newSelected.splice(idx, 1);
    } else {
      newSelected.push(value);
    }

    setFilters({
      ...filters,
      [colKey]: { ...colFilter, selectedValues: newSelected }
    });
  };

  // Set sort order for column
  const handleSort = (colKey: string, direction: "asc" | "desc" | null) => {
    const updatedFilters = { ...filters };
    Object.keys(updatedFilters).forEach(k => {
      const current = updatedFilters[k] || { search: "", selectedValues: [], sort: null };
      updatedFilters[k] = { ...current, sort: null };
    });

    const current = updatedFilters[colKey] || { search: "", selectedValues: [], sort: null };
    updatedFilters[colKey] = { ...current, sort: direction };
    setFilters(updatedFilters);
    setOpenFilterCol(null);
  };

  /** Adds a label to a select column's list. Duplicates are rejected case-insensitively. */
  const addLabel = (col: ColumnDef) => {
    const raw = prompt(`Novo rótulo para a coluna "${col.label}":`);
    const label = raw?.trim();
    if (!label) return;

    const current = col.options ?? [];
    if (current.some(o => o.toLowerCase() === label.toLowerCase())) {
      toast.error(`O rótulo "${label}" já existe nesta coluna.`);
      return;
    }
    setColumns(columns.map(c => c.key === col.key ? { ...c, options: [...current, label] } : c));
    toast.success(`Rótulo "${label}" adicionado.`);
  };

  /**
   * Removes a label from a select column's list. Rows already carrying it keep their value —
   * dropping the label must not silently rewrite data — so warn when that will happen.
   */
  const removeLabel = (col: ColumnDef, label: string) => {
    const inUse = records.filter(r => {
      const v = isCustomKey(col.key) ? r.custom_fields?.[col.key] : r[col.key as keyof FinancialRecord];
      return String(v ?? "") === label;
    }).length;

    const aviso = inUse > 0
      ? `\n\n${inUse} lançamento(s) usam "${label}". Eles mantêm o valor, mas o rótulo sai da lista de escolhas.`
      : "";
    if (!confirm(`Apagar o rótulo "${label}" da coluna "${col.label}"?${aviso}`)) return;

    setColumns(columns.map(c =>
      c.key === col.key ? { ...c, options: (c.options ?? []).filter(o => o !== label) } : c
    ));
    toast.success(`Rótulo "${label}" apagado.`);
  };

  // Format currency helper
  const formatCurrency = (val: number | null) => {
    if (val == null || val === 0) return "";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  // Format date input/render helper
  const formatDateString = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    // Excel look: the sheet stays white/black-gridded in both themes, so no dark: variants below.
    <div className="w-full h-full flex flex-col overflow-hidden bg-white" ref={gridRef}>
      
      {/* Filters Summary / Reset */}
      {Object.keys(filters).some(k => {
        const f = filters[k];
        return f ? (f.search || f.selectedValues.length > 0 || f.sort) : false;
      }) && (
        <div className="bg-emerald-50 border-b border-black p-2 flex items-center justify-between text-[11px] shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#217346] font-semibold flex items-center gap-1">
              <Filter size={12} /> Filtros ativos:
            </span>
            {Object.entries(filters).map(([k, f]) => {
              if (!f) return null;
              if (!f.search && f.selectedValues.length === 0 && !f.sort) return null;
              const col = columns.find(c => c.key === k);
              return (
                <div key={k} className="flex items-center gap-1 bg-white border border-black px-2 py-0.5 rounded text-zinc-800 shadow-sm">
                  <span className="font-medium text-zinc-500">{col?.label || k}:</span>
                  <span>{f.sort ? (f.sort === "asc" ? "Ordem Crescente" : "Ordem Decrescente") : ""}</span>
                  {f.search && <span>Busca: &quot;{f.search}&quot;</span>}
                  {f.selectedValues.length > 0 && <span>Checked ({f.selectedValues.length})</span>}
                  <button
                    onClick={() => {
                      const updated = { ...filters };
                      delete updated[k];
                      setFilters(updated);
                    }}
                    className="hover:text-red-400 text-zinc-500 ml-1"
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setFilters({})}
            className="text-[#217346] hover:text-emerald-800 font-semibold flex items-center gap-1"
          >
            Limpar todos
          </button>
        </div>
      )}

      {/* Grid Sheet Container */}
      <div className="flex-1 overflow-auto bg-white">
        {/* border-separate, not border-collapse: collapsed borders vanish from a sticky thead
            while scrolling. Each cell draws its own right/bottom edge; the table draws top/left. */}
        <table className="min-w-full border-separate border-spacing-0 border-t border-l border-black table-fixed select-none text-[11px]">

          {/* Header */}
          <thead className="sticky top-0 z-20">
            <tr>
              {/* Row index column */}
              <th className="w-10 px-2 py-1.5 text-center font-bold border-r border-b border-black bg-[#217346]"></th>

              {/* Data Columns */}
              {columns.map((col, colIdx) => {
                const colFilter = filters[col.key];
                const isFiltered = colFilter ? (colFilter.search || colFilter.selectedValues.length > 0 || colFilter.sort) : false;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      col.width,
                      "px-3 py-2 text-white border-r border-b border-black font-bold text-[11px] relative bg-[#217346] hover:bg-emerald-800 group"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate" title={col.label}>{col.label}</span>

                      {/* Filter/Sort Icon Trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenFilterCol(openFilterCol === col.key ? null : col.key);
                        }}
                        className={cn(
                          "filter-btn p-0.5 rounded text-white/70 hover:text-white transition-colors",
                          isFiltered ? "text-white" : "opacity-0 group-hover:opacity-100"
                        )}
                      >
                        {filters[col.key]?.sort === "asc" ? (
                           <ArrowUp size={12} />
                        ) : filters[col.key]?.sort === "desc" ? (
                           <ArrowDown size={12} />
                        ) : (
                           <ChevronDown size={12} />
                        )}
                      </button>
                    </div>

                    {/* Excel-like filter popup */}
                    {openFilterCol === col.key && (
                      <div className={cn(
                        "filter-popover absolute top-full mt-1 w-64 bg-white border border-black rounded-lg shadow-xl z-50 text-left font-normal text-zinc-800 p-2 max-h-96 overflow-y-auto",
                        colIdx < columns.length / 2 ? "left-0" : "right-0"
                      )}>
                        <div className="text-[11px] font-bold text-zinc-500 pb-1.5 border-b border-zinc-300 mb-1.5 px-1 uppercase flex items-center justify-between">
                          <span>Filtro: {col.label}</span>
                          <button onClick={() => setOpenFilterCol(null)} className="text-zinc-500 hover:text-zinc-800">
                            <X size={12} />
                          </button>
                        </div>

                        {/* Sort buttons */}
                        <div className="space-y-0.5 mb-2">
                          <button
                            onClick={() => handleSort(col.key, "asc")}
                            className="w-full text-left px-2 py-1 rounded hover:bg-emerald-50 text-[11px] flex items-center gap-2 text-zinc-700 transition-colors"
                          >
                            <ArrowUpDown size={12} className="text-[#217346] shrink-0" />
                            <span>Ordem Crescente (A-Z)</span>
                          </button>
                          <button
                            onClick={() => handleSort(col.key, "desc")}
                            className="w-full text-left px-2 py-1 rounded hover:bg-emerald-50 text-[11px] flex items-center gap-2 text-zinc-700 transition-colors"
                          >
                            <ArrowUpDown size={12} className="text-[#217346] rotate-180 shrink-0" />
                            <span>Ordem Decrescente (Z-A)</span>
                          </button>
                          {filters[col.key]?.sort && (
                            <button
                              onClick={() => handleSort(col.key, null)}
                              className="w-full text-left px-2 py-1 rounded hover:bg-emerald-50 text-[11px] flex items-center gap-2 text-zinc-500 hover:text-zinc-800 transition-colors"
                            >
                              <X size={12} className="shrink-0" />
                              <span>Limpar Classificação</span>
                            </button>
                          )}
                        </div>

                        <div className="border-t border-zinc-300 my-1"></div>

                        {/* Search input */}
                        <div className="relative mb-2 mt-1">
                          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-zinc-500" />
                          <input
                            type="text"
                            placeholder="Buscar..."
                            value={filters[col.key]?.search || ""}
                            onChange={(e) => {
                              const current = filters[col.key] || { search: "", selectedValues: [], sort: null };
                              setFilters({
                                ...filters,
                                [col.key]: { ...current, search: e.target.value }
                              });
                            }}
                            className="w-full bg-white border border-zinc-300 rounded px-2 py-1.5 pl-7 text-[11px] outline-none focus:border-[#217346] text-zinc-800"
                          />
                        </div>

                        {/* List of checkboxes for values */}
                        <div className="max-h-40 overflow-y-auto space-y-1 px-1 py-1 border border-zinc-300 rounded bg-zinc-50">
                          {getUniqueValues(col.key).map((val) => {
                            const isChecked = filters[col.key]?.selectedValues.includes(val) ?? false;
                            return (
                              <label key={val} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-emerald-50 text-[11px] cursor-pointer text-zinc-700">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleFilterValue(col.key, val)}
                                  className="rounded border-zinc-400 bg-white text-[#217346] focus:ring-0 w-3.5 h-3.5 shrink-0"
                                />
                                <span className="truncate">{val}</span>
                              </label>
                            );
                          })}
                        </div>

                        {/* Label set management — only for columns whose cells pick from a list */}
                        {col.type === "select" && (
                          <div className="mt-2 pt-2 border-t border-zinc-300">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase px-1 mb-1">
                              Rótulos desta coluna
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-0.5 mb-1">
                              {(col.options ?? []).filter(o => o !== "").map((opt) => (
                                <div key={opt} className="flex items-center justify-between gap-1 px-1.5 py-0.5 rounded hover:bg-zinc-50 text-[11px] text-zinc-700">
                                  <span className="truncate">{opt}</span>
                                  <button
                                    onClick={() => removeLabel(col, opt)}
                                    title={`Apagar o rótulo "${opt}"`}
                                    className="text-zinc-400 hover:text-red-600 shrink-0"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ))}
                              {(col.options ?? []).filter(o => o !== "").length === 0 && (
                                <p className="text-[10px] text-zinc-400 px-1.5 py-1">Nenhum rótulo ainda.</p>
                              )}
                            </div>
                            <button
                              onClick={() => addLabel(col)}
                              className="w-full text-left px-2 py-1 rounded hover:bg-emerald-50 text-[11px] flex items-center gap-2 text-[#217346] font-medium transition-colors"
                            >
                              <span className="shrink-0">+</span>
                              <span>Adicionar rótulo</span>
                            </button>
                          </div>
                        )}

                        {/* Column Management Actions inside header popover */}
                        <div className="space-y-0.5 mt-2 pt-2 border-t border-zinc-300">
                          <button
                            onClick={() => {
                              const newLabel = prompt(`Digite o novo nome para a coluna "${col.label}":`, col.label);
                              if (newLabel && newLabel.trim()) {
                                setColumns(columns.map(c => c.key === col.key ? { ...c, label: newLabel.trim() } : c));
                                setOpenFilterCol(null);
                                toast.success("Coluna renomeada!");
                              }
                            }}
                            className="w-full text-left px-2 py-1 rounded hover:bg-emerald-50 text-[11px] flex items-center gap-2 text-zinc-700 transition-colors"
                          >
                            <span className="shrink-0">✏️</span>
                            <span>Renomear Coluna</span>
                          </button>
                          
                          {/* Protect critical fields from being deleted */}
                          {col.key !== "date" && col.key !== "description" && (
                            <button
                              onClick={() => {
                                if (confirm(`Deseja realmente excluir a coluna "${col.label}"?`)) {
                                  setColumns(columns.filter(c => c.key !== col.key));
                                  setOpenFilterCol(null);
                                  toast.success(`Coluna "${col.label}" excluída!`);
                                }
                              }}
                              className="w-full text-left px-2 py-1 rounded hover:bg-red-50 text-[11px] flex items-center gap-2 text-red-600 transition-colors"
                            >
                              <span className="shrink-0">🗑️</span>
                              <span>Excluir Coluna</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="bg-white">
            {filteredRecords.map((record, rowIndex) => {
              const isSelected = selectedRowId === record.id;
              const isUnsaved = record.id.startsWith("temp-");

              return (
                <tr
                  key={record.id}
                  className="group/row relative transition-colors"
                  onClick={() => setSelectedRowId(record.id)}
                >
                  {/* Row Index */}
                  <td className={cn(
                    "px-2 py-1.5 text-center font-semibold border-r border-b border-black select-none",
                    isSelected ? "bg-[#217346] text-white" : "bg-zinc-100 text-zinc-600",
                    isUnsaved && "border-l-4 border-l-amber-500"
                  )}>
                    {rowIndex + 1}
                  </td>

                  {/* Columns */}
                  {columns.map((col, colIndex) => {
                    const cellKey = col.key;
                    const isActive = activeCell?.rowId === record.id && activeCell?.colKey === cellKey;
                    const isEditing = editingCell?.rowId === record.id && editingCell?.colKey === cellKey;
                    
                    const rawVal = isCustomKey(cellKey)
                      ? (record.custom_fields?.[cellKey] || "")
                      : record[cellKey as keyof FinancialRecord];

                    // Render value mapping
                    let renderedValue: React.ReactNode = "";
                    if (isCustomKey(cellKey)) {
                      renderedValue = String(rawVal);
                    } else if (cellKey === "date") {
                      renderedValue = formatDateString(String(rawVal));
                    } else if (cellKey === "revenue") {
                      renderedValue = formatCurrency(Number(rawVal));
                    } else if (cellKey === "expense") {
                      renderedValue = formatCurrency(Number(rawVal));
                    } else {
                      renderedValue = rawVal == null ? "" : String(rawVal);
                    }

                    // Text colors based on column rules
                    // Darker weights than the old dark-theme palette — these sit on white now.
                    // Categoria has user-defined labels, so it can't be a fixed value->colour map:
                    // it just gets one stable colour derived from the label itself.
                    const textColorClass = cn(
                      cellKey === "type" && rawVal === "Receita" && "text-[#217346] font-semibold",
                      cellKey === "type" && rawVal === "Despesa" && "text-red-700 font-semibold",
                      cellKey === "category" && rawVal && "font-medium",
                      cellKey === "revenue" && Number(rawVal) > 0 && "text-[#217346] font-semibold",
                      cellKey === "expense" && Number(rawVal) > 0 && "text-red-700 font-semibold",
                      cellKey === "platform" && rawVal && "text-blue-700 font-semibold"
                    );

                    return (
                      <td
                        id={`cell-${record.id}-${cellKey}`}
                        key={cellKey}
                        tabIndex={0}
                        onKeyDown={(e) => handleKeyDown(e, record.id, cellKey, rowIndex, colIndex)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveCell({ rowId: record.id, colKey: cellKey });
                          setSelectedRowId(record.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setActiveCell({ rowId: record.id, colKey: cellKey });
                          setSelectedRowId(record.id);
                          setEditingCell({ rowId: record.id, colKey: cellKey });
                          setEditValue(rawVal == null ? "" : String(rawVal));
                        }}
                        className={cn(
                          "px-3 py-1.5 border-r border-b border-black relative truncate font-mono h-8 cursor-cell text-zinc-900",
                          isSelected ? "bg-emerald-50" : "bg-white group-hover/row:bg-emerald-50/40",
                          col.align === "left" && "text-left",
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right",
                          isActive && "ring-2 ring-inset ring-[#217346] z-10",
                          isEditing && "p-0 z-20"
                        )}
                      >
                        {isEditing ? (
                          col.type === "select" ? (
                            <select
                              ref={(el) => { editInputRef.current = el; }}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => {
                                saveCellEdit(record.id, cellKey);
                                setEditingCell(null);
                              }}
                              className="w-full h-full bg-white text-zinc-900 px-2 outline-none text-[11px] focus:ring-2 focus:ring-inset focus:ring-[#217346] border-none"
                            >
                              {(col.options ?? []).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              ref={(el) => { editInputRef.current = el; }}
                              type={col.type === "number" ? "text" : col.type}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => {
                                saveCellEdit(record.id, cellKey);
                                setEditingCell(null);
                              }}
                              className="w-full h-full bg-white text-zinc-900 px-2 outline-none text-[11px] focus:ring-2 focus:ring-inset focus:ring-[#217346] border-none"
                            />
                          )
                        ) : (
                          <span className={textColorClass}>{renderedValue}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

        </table>
        
        {filteredRecords.length === 0 && (
          <div className="text-center py-10 bg-white text-zinc-500 text-xs">
            Nenhum lançamento corresponde aos filtros ativos.
          </div>
        )}
      </div>

    </div>
  );
}
