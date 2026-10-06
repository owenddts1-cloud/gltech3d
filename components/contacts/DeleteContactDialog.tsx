"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Trash } from "@/lib/ui/icons";
import { isContactHasHistoryError, useDeleteContact } from "@/hooks/contacts/useDeleteContact";

interface Props {
  contactId: string;
  displayName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Opens the LGPD anonymization flow. Absent when the user cannot anonymize (admin-only). */
  onGoToLgpd?: () => void;
}

/**
 * Confirm + hard delete of a contact. Only contacts WITHOUT history can be
 * deleted (the API answers 409 `contact_has_history` otherwise); for those the
 * dialog explains why and points to the LGPD anonymization.
 */
export function DeleteContactDialog({ contactId, displayName, open, onOpenChange, onGoToLgpd }: Props) {
  const router = useRouter();
  const del = useDeleteContact();
  const [hasHistory, setHasHistory] = useState(false);

  function handleOpenChange(v: boolean) {
    if (!v) setHasHistory(false);
    onOpenChange(v);
  }

  async function handleDelete() {
    try {
      await del.mutateAsync(contactId);
      toast.success("Contato excluído.");
      handleOpenChange(false);
      router.push("/app/contacts");
    } catch (err) {
      // Other errors were already toasted by the hook; only the conflict is shown inline.
      if (isContactHasHistoryError(err)) setHasHistory(true);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        {hasHistory ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Não é possível excluir</AlertDialogTitle>
              <AlertDialogDescription>
                Este contato tem histórico (conversas, O.S. ou vendas). Para remover os dados
                pessoais, use Anonimizar (LGPD).
              </AlertDialogDescription>
            </AlertDialogHeader>
            {!onGoToLgpd && (
              <p className="text-xs text-muted-foreground">
                A anonimização é feita por um administrador da organização.
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Fechar</AlertDialogCancel>
              {onGoToLgpd && (
                <Button
                  variant="destructive"
                  className="gap-1.5"
                  onClick={() => {
                    handleOpenChange(false);
                    onGoToLgpd();
                  }}
                >
                  <ShieldCheck size={14} aria-hidden />
                  Ir para Anonimizar (LGPD)
                </Button>
              )}
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong className="text-foreground">{displayName}</strong> será removido
                definitivamente. Só é possível excluir contatos sem conversas, O.S. ou vendas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={del.isPending}>Cancelar</AlertDialogCancel>
              <Button
                variant="destructive"
                className="gap-1.5"
                onClick={handleDelete}
                disabled={del.isPending}
              >
                <Trash size={14} aria-hidden />
                {del.isPending ? "Excluindo..." : "Excluir contato"}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
