"use client";

/**
 * Lucro por canal — a tela que faltava para o cadastro de comissões servir.
 *
 * ATÉ AQUI, `platform_commissions` era escrita pela tela de Landing Edit e lida
 * por ninguém: `computeChannelPrices` não era chamada em lugar algum do sistema.
 * Digitar 20% na Shopee não mudava número nenhum, e o CRM seguia exibindo
 * "margem 100%" — que é o que se obtém dividindo por custo zero.
 *
 * O QUE A TELA RESPONDE, e são duas perguntas diferentes:
 *   "por quanto eu DEVERIA vender para sobrar X?"     → preço sugerido
 *   "o que sobra do preço que está no anúncio HOJE?"  → resultado atual
 *
 * A segunda é como se descobre que um item passou a dar prejuízo sem ninguém ter
 * mudado nada.
 *
 * O AVISO DE COMISSÃO ZERADA não é decoração. Medido no Acoplamento: com os
 * canais em 0%, o preço sugerido para 30% de margem sai R$ 6,46; com as
 * comissões reais, R$ 19,36. Três vezes. Sem o aviso, a tela apenas repetiria a
 * mentira antiga com mais dígitos.
 */

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowsClockwise, Warning } from "@/lib/ui/icons";
import { brlFromReais } from "@/lib/format/money";
import { parseDecimal } from "@/lib/format/decimal";
import { analyzeProductChannels, type ChannelAnalysis } from "@/app/actions/pricing/channels";

interface Props {
  /** Custo unitário de produção, em reais — o que a aba Custo já calcula. */
  unitCost: number;
  /** Preço praticado hoje, em reais. 0 = ainda não precificado. */
  sellingPrice: number;
  /** Alíquota do Simples vinda de `organizations.settings`. 0 = não configurada. */
  simplesTaxPct: number;
}

export function ChannelMargins({ unitCost, sellingPrice, simplesTaxPct }: Props) {
  const [margemAlvo, setMargemAlvo] = useState("30");
  const [analise, setAnalise] = useState<ChannelAnalysis | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alvo = parseDecimal(margemAlvo) || 0;

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro(null);

    void analyzeProductChannels({
      unitCost,
      sellingPrice,
      targetMarginPct: alvo,
      simplesTaxPct,
    }).then((r) => {
      if (cancelado) return;
      if (r.ok) setAnalise(r.analysis);
      else setErro(r.error);
      setCarregando(false);
    });

    return () => {
      cancelado = true;
    };
  }, [unitCost, sellingPrice, alvo, simplesTaxPct]);

  if (unitCost <= 0) {
    return (
      <p className="flex gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs leading-snug text-warning-fg">
        <Warning size={15} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          <strong>Sem custo não há margem.</strong> Preencha gramas e tempo na aba Custo — ou
          vincule o STL e use <em>Estimar pelo STL</em>. Enquanto o custo for zero, qualquer
          percentual que o sistema mostrasse seria ficção.
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="p-margem" className="text-xs">
            Margem líquida alvo (%)
          </Label>
          <Input
            id="p-margem"
            inputMode="decimal"
            value={margemAlvo}
            onChange={(e) => setMargemAlvo(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Custo unitário</Label>
          <p className="flex h-9 items-center text-sm font-semibold tabular-nums">
            {brlFromReais(unitCost)}
          </p>
        </div>
      </div>

      {analise?.comissoesZeradas && (
        <p className="flex gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs leading-snug text-warning-fg">
          <Warning size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <strong>As comissões estão todas em 0%.</strong> Os números abaixo são otimistas: não
            descontam o que o marketplace retém. Preencha em{" "}
            <a href="/app/landing-edit" className="underline underline-offset-2">
              Landing Edit → Comissões
            </a>
            .
          </span>
        </p>
      )}

      {simplesTaxPct === 0 && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Alíquota do Simples não configurada — entra como 0%. O imposto real reduz a margem.
        </p>
      )}

      {erro && <p className="text-xs text-danger-fg">{erro}</p>}

      {carregando && !analise ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowsClockwise size={13} className="animate-spin" /> Calculando…
        </p>
      ) : analise && analise.sugerido.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum canal cadastrado. Os canais vêm de Landing Edit → Comissões.
        </p>
      ) : (
        analise && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-2 font-semibold">Canal</th>
                  <th className="py-2 pr-2 text-right font-semibold">Preço p/ {alvo}%</th>
                  <th className="py-2 pr-2 text-right font-semibold">Hoje</th>
                  <th className="py-2 text-right font-semibold">Sobra hoje</th>
                </tr>
              </thead>
              <tbody>
                {analise.sugerido.map((s) => {
                  const hoje = analise.atual.find((a) => a.channel === s.channel);
                  const prejuizo = hoje !== undefined && hoje.netProfit < 0;
                  return (
                    <tr key={s.channel} className="border-b border-border/60">
                      <td className="py-2 pr-2">
                        <span className="font-medium">{s.channel}</span>
                        {s.commissionMissing && (
                          <Badge variant="secondary" className="ml-1.5 text-[9px]">
                            0%
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {brlFromReais(s.suggestedPrice)}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                        {hoje ? brlFromReais(hoje.suggestedPrice) : "—"}
                      </td>
                      <td
                        className={`py-2 text-right font-semibold tabular-nums ${
                          prejuizo ? "text-danger-fg" : ""
                        }`}
                      >
                        {hoje ? `${brlFromReais(hoje.netProfit)} · ${hoje.netMarginPct}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {analise && analise.canaisNoPrejuizo.length > 0 && (
        <p className="flex gap-2 rounded-lg border border-danger/40 bg-danger/5 p-3 text-xs leading-snug text-danger-fg">
          <Warning size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            No preço de hoje esta peça dá <strong>prejuízo</strong> em:{" "}
            {analise.canaisNoPrejuizo.join(", ")}.
          </span>
        </p>
      )}

      {sellingPrice <= 0 && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Sem preço de venda preenchido, a coluna &ldquo;hoje&rdquo; fica vazia — só o sugerido é
          calculável.
        </p>
      )}
    </div>
  );
}
