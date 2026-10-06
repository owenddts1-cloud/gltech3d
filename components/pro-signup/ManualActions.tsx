"use client";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * O caminho manual, de um clique: copiar o link e avisar no WhatsApp.
 *
 * Usado na tela de aprovação do painel e na página /aprovar/<token> (aprovação
 * pelo e-mail). Aparece SEMPRE, não só quando o e-mail falha: mandar o link no
 * WhatsApp acelera a ativação mesmo com o e-mail entregue.
 *
 * O botão do WhatsApp some quando o telefone não serve para montar o link, em
 * vez de oferecer uma ação que abre o app num número inexistente.
 */
export function ManualActions({
  link,
  whatsappUrl,
  linkLabel,
}: {
  link: string;
  whatsappUrl: string | null;
  linkLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard bloqueado (contexto inseguro). O campo continua selecionável.
      toast.error("Não consegui copiar. Selecione o texto do campo.");
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">{linkLabel}</Label>
      <Input readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
          {copied ? "Copiado" : "Copiar link"}
        </Button>
        {whatsappUrl ? (
          <Button asChild size="sm" variant="outline">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              Avisar no WhatsApp
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
