"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MfaEnrollModal } from "@/components/auth/MfaEnrollModal";

/**
 * Cartão de MFA em /app/settings/security, com enrolamento voluntário.
 *
 * Antes esta tela era só leitura e dizia "Faça login novamente para iniciar o
 * enrolamento" — o enroll só disparava pelo `MfaEnrollGate`, que o layout
 * renderiza quando o MFA é OBRIGATÓRIO. Resultado: quem não era forçado não
 * tinha como ativar TOTP de jeito nenhum.
 *
 * Isso virou bloqueante quando o MFA passou a ser exigido só de plano pago: o
 * usuário em trial precisa de um lugar para ativar por vontade própria.
 *
 * Zero backend novo — `MfaEnrollModal` é autossuficiente: chama as server
 * actions `enrollMfa`/`confirmMfaEnroll` e recarrega a página no fim, para o
 * layout reavaliar o gate.
 */
export function MfaEnrollCard({ enrolled }: { enrolled: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="space-y-3 p-6">
      <h2 className="text-sm font-semibold">MFA (TOTP)</h2>
      <p className="text-sm">
        {enrolled ? (
          <span className="text-green-600">Ativado.</span>
        ) : (
          <span className="text-amber-600">Não ativado.</span>
        )}
      </p>

      {enrolled ? (
        <p className="text-xs text-muted-foreground">
          Todo login pede o código de 6 dígitos do seu aplicativo autenticador.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Recomendado. Com plano pago, o TOTP passa a ser obrigatório — ativar agora evita a
            interrupção no próximo login.
          </p>
          <Button size="sm" onClick={() => setOpen(true)}>
            Ativar agora
          </Button>
        </>
      )}

      {open && !enrolled ? <MfaEnrollModal /> : null}
    </Card>
  );
}
