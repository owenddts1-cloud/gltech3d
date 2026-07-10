"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileText } from "@/lib/ui/icons";
import type { CalculatorInputs, CalculatorOutputs } from "@/hooks/calculator/useCalculator";

interface ContactOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputs: CalculatorInputs;
  outputs: CalculatorOutputs;
  contacts: ContactOption[];
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function QuotePdfModal({ open, onOpenChange, inputs, outputs, contacts }: Props) {
  const [selectedContactId, setSelectedContactId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  const generatePdf = useCallback(async () => {
    setIsGenerating(true);

    try {
      // Dynamic import to keep bundle lean
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF("p", "mm", "a4");
      const W = 210;
      const margin = 18;
      const cw = W - margin * 2;
      let y = 20;

      // ── Header ─────────────────────────────────────────────
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, W, 42, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text("GLTECH", margin, y + 8);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text("Orçamento de Impressão 3D", margin, y + 16);
      doc.setFontSize(9);
      doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, W - margin, y + 8, { align: "right" });
      doc.text(`Ref: ORC-${Date.now().toString(36).toUpperCase()}`, W - margin, y + 14, { align: "right" });

      y = 50;

      // ── Client Info ────────────────────────────────────────
      if (selectedContact) {
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(margin, y, cw, 22, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text("CLIENTE", margin + 4, y + 7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(selectedContact.name, margin + 4, y + 14);
        if (selectedContact.email) {
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(selectedContact.email, margin + 4, y + 19);
        }
        if (selectedContact.phone) {
          doc.text(selectedContact.phone, cw - 10, y + 14, { align: "right" });
        }
        y += 28;
      }

      if (projectName) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(`Projeto: ${projectName}`, margin, y + 4);
        y += 12;
      }

      // ── Cost Breakdown Table ───────────────────────────────
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, y, cw, 10, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text("ANATOMIA DO CUSTO", margin + 4, y + 7);
      y += 14;

      const rows: [string, string, string][] = [
        ["Filamento", `${inputs.pesoPeca}g × R$ ${inputs.precoFilamento}/kg`, `R$ ${fmt(outputs.custoFilamento)}`],
        ["Energia", `${inputs.tempoImpressao}h × ${inputs.potenciaMedia}W`, `R$ ${fmt(outputs.custoEnergia)}`],
        ["Depreciação", `${inputs.tempoImpressao}h × R$ ${fmt(inputs.valorMaquina / inputs.vidaUtil)}/h`, `R$ ${fmt(outputs.custoDepreciacao)}`],
        ["Mão de obra", `${inputs.horasManuais}h × R$ ${inputs.horaTrabalho}/h`, `R$ ${fmt(outputs.custoTrabalho)}`],
        ["Risco falha", `${inputs.riscoFalha}% sobre custo base`, `R$ ${fmt(outputs.custoFalha)}`],
      ];

      rows.forEach(([label, desc, value], i) => {
        if (i % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 3, cw, 10, "F");
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(label, margin + 4, y + 3);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.text(desc, margin + 50, y + 3);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(9);
        doc.text(value, W - margin - 4, y + 3, { align: "right" });
        y += 10;
      });

      // Totals
      y += 2;
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y, W - margin, y);
      y += 8;

      const totals: [string, string][] = [
        ["Custo Total Unitário", `R$ ${fmt(outputs.custoTotalUnitario)}`],
        [`Margem de Lucro (${inputs.margemLucro}%)`, `R$ ${fmt(outputs.lucroUnitario)}`],
        ["PREÇO UNITÁRIO", `R$ ${fmt(outputs.precoSugerido)}`],
      ];

      totals.forEach(([label, value], i) => {
        const isLast = i === totals.length - 1;
        if (isLast) {
          doc.setFillColor(16, 185, 129);
          doc.roundedRect(margin, y - 4, cw, 14, 2, 2, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(11);
        } else {
          doc.setTextColor(30, 41, 59);
          doc.setFontSize(9);
        }
        doc.setFont("helvetica", "bold");
        doc.text(label, margin + 4, y + 4);
        doc.text(value, W - margin - 4, y + 4, { align: "right" });
        y += isLast ? 18 : 10;
      });

      // Lot summary
      if (inputs.quantidade > 1) {
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(margin, y, cw, 18, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(`LOTE DE ${inputs.quantidade} UNIDADES`, margin + 4, y + 7);
        doc.setFont("helvetica", "normal");
        doc.text(`Custo: R$ ${fmt(outputs.custoLote)}`, margin + 4, y + 14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(16, 185, 129);
        doc.text(`Preço Total: R$ ${fmt(outputs.precoLote)}`, W - margin - 4, y + 10, { align: "right" });
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "normal");
        doc.text(`Lucro: R$ ${fmt(outputs.lucroLote)}`, W - margin - 4, y + 16, { align: "right" });
        y += 24;
      }

      // Footer
      y = 270;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, W - margin, y);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.setFont("helvetica", "normal");
      doc.text("GLTECH CRM — Orçamento gerado automaticamente pelo motor de precificação.", margin, y + 5);
      doc.text("Este documento não possui valor fiscal.", margin, y + 9);

      // Save
      const filename = projectName
        ? `GLTECH_Orcamento_${projectName.replace(/\s+/g, "_")}.pdf`
        : `GLTECH_Orcamento_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);

      onOpenChange(false);
      const { toast: showToast } = await import("sonner");
      showToast.success("PDF gerado com sucesso!");
    } catch {
      const { toast: showToast } = await import("sonner");
      showToast.error("Erro ao gerar PDF.");
    } finally {
      setIsGenerating(false);
    }
  }, [inputs, outputs, selectedContact, projectName, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} weight="duotone" className="text-emerald-500" />
            Gerar Orçamento PDF
          </DialogTitle>
          <DialogDescription>
            Selecione um cliente e nomeie o projeto para gerar o documento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="quote_client">Cliente</Label>
            <select
              id="quote_client"
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm
                         focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
            >
              <option value="">Sem cliente (orçamento genérico)</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.email ? `(${c.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quote_project">Nome do Projeto</Label>
            <Input
              id="quote_project"
              placeholder="Ex: Peça motor foguete GL-1"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          {/* Preview Summary */}
          <div className="rounded-lg bg-neutral-950 p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Custo unitário</span>
              <span className="text-white font-bold">R$ {fmt(outputs.custoTotalUnitario)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Preço unitário</span>
              <span className="text-emerald-400 font-bold">R$ {fmt(outputs.precoSugerido)}</span>
            </div>
            {inputs.quantidade > 1 && (
              <div className="flex justify-between text-xs pt-1 border-t border-white/10">
                <span className="text-neutral-400">Total lote ({inputs.quantidade}un)</span>
                <span className="text-emerald-400 font-bold">R$ {fmt(outputs.precoLote)}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={generatePdf}
            disabled={isGenerating}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
          >
            <FileText size={14} weight="bold" />
            {isGenerating ? "Gerando..." : "Baixar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
