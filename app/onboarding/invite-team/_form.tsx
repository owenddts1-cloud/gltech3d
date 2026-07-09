"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendOnboardingInvites } from "@/app/actions/onboarding/sendOnboardingInvites";
import { ROLES, type Role } from "@/lib/schemas/team";

export function InviteTeamForm() {
  const [emailsRaw, setEmailsRaw] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [pending, startTransition] = useTransition();

  const submit = (skip: boolean) => {
    startTransition(async () => {
      if (skip) {
        const res = await sendOnboardingInvites({ invitations: [], skip: true });
        if (res && !res.ok) toast.error(`Falha: ${res.error}`);
        return;
      }
      const emails = Array.from(
        new Set(
          emailsRaw
            .split(/[\n,;]/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        ),
      );
      if (emails.length === 0) {
        toast.error("Adicione ao menos um email ou clique em Pular.");
        return;
      }
      if (emails.length > 20) {
        toast.error("Máximo 20 emails por convite.");
        return;
      }
      const res = await sendOnboardingInvites({
        invitations: emails.map((email) => ({ email, role })),
      });
      if (res && !res.ok) {
        toast.error(`Falha: ${res.error}`);
        return;
      }
      if (res && res.ok) {
        toast.success(`${res.sent} convite(s) enviado(s)${res.failed ? `, ${res.failed} falha(s).` : "."}`);
      }
    });
  };

  return (
    <div className="space-y-4 rounded-lg border bg-background p-6">
      <div className="space-y-2">
        <Label htmlFor="emails">Emails</Label>
        <Textarea
          id="emails"
          value={emailsRaw}
          onChange={(e) => setEmailsRaw(e.target.value)}
          rows={6}
          placeholder={"alice@empresa.com\nbob@empresa.com"}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger id="role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-between gap-2 pt-2">
        <Button type="button" variant="ghost" disabled={pending} onClick={() => submit(true)}>
          Pular por enquanto
        </Button>
        <Button type="button" disabled={pending} onClick={() => submit(false)}>
          {pending ? "Enviando..." : "Enviar convites"}
        </Button>
      </div>
    </div>
  );
}
