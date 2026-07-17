"use client";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProfile } from "@/app/actions/settings/updateProfile";
import { updateEmail } from "@/app/actions/settings/updateEmail";
import { createAvatarUploadUrl } from "@/app/actions/settings/avatarUpload";
import { createClient } from "@/lib/supabase/browser";
import { AVATARS_BUCKET, AVATARS_ACCEPT } from "@/lib/settings/avatar-config";
import { profileSchema, type Locale } from "@/lib/schemas/settings";

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Recife",
  "America/Fortaleza",
  "UTC",
];

interface Props {
  email: string;
  initialFullName: string | null;
  initialAvatarUrl: string | null;
}

export function ProfileForm({ email, initialFullName, initialAvatarUrl }: Props) {
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [locale, setLocale] = useState<Locale>("pt-BR");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [isPending, startTransition] = useTransition();

  const [newEmail, setNewEmail] = useState("");
  const [emailPending, startEmailTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  function handleEmailChange() {
    if (!newEmail.trim()) return;
    startEmailTransition(async () => {
      const r = await updateEmail({ email: newEmail.trim() });
      if (r.ok) {
        toast.success("Enviamos um link de confirmação para o novo email. Clique nele para concluir.");
        setNewEmail("");
      } else {
        toast.error(r.error);
      }
    });
  }

  async function handleAvatarFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const signed = await createAvatarUploadUrl({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      if (!signed.ok) {
        toast.error(signed.error);
        return;
      }
      const supabase = createClient();
      const up = await supabase.storage
        .from(AVATARS_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file);
      if (up.error) {
        toast.error(up.error.message);
        return;
      }
      // Grava a URL pública no perfil na hora.
      const saved = await updateProfile(
        profileSchema.parse({
          full_name: fullName || null,
          locale,
          timezone,
          avatar_url: signed.publicUrl,
        }),
      );
      if (!saved.ok) {
        toast.error(`Erro: ${saved.error}`);
        return;
      }
      setAvatarUrl(signed.publicUrl);
      toast.success("Avatar atualizado.");
    } finally {
      setUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse({
      full_name: fullName || null,
      locale,
      timezone,
      avatar_url: avatarUrl || null,
    });
    if (!parsed.success) {
      toast.error("Dados inválidos.");
      return;
    }
    startTransition(async () => {
      const r = await updateProfile(parsed.data);
      if (r.ok) toast.success("Perfil atualizado.");
      else toast.error(`Erro: ${r.error}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <Card className="space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email atual</Label>
          <Input id="email" value={email} disabled />
          <div className="flex gap-2 pt-1">
            <Input
              id="new_email"
              type="email"
              placeholder="Novo email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={emailPending || !newEmail.trim()}
              onClick={handleEmailChange}
            >
              {emailPending ? "Enviando…" : "Trocar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Enviamos um link de confirmação para o novo endereço. O email só muda depois que você
            clicar nele.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="full_name">Nome completo</Label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="locale">Idioma</Label>
            <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
              <SelectTrigger id="locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-BR">Português (BR)</SelectItem>
                <SelectItem value="en-US">English (US)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Fuso horário</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Avatar</Label>
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-14 w-14 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground">
                sem foto
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => avatarInputRef.current?.click()}
              >
                {uploading ? "Enviando…" : "Enviar imagem"}
              </Button>
              <span className="text-[11px] text-muted-foreground">PNG, JPG ou WebP, até 5 MB.</span>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept={AVATARS_ACCEPT}
              className="hidden"
              onChange={(e) => void handleAvatarFile(e.target.files?.[0])}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="avatar_url">Ou cole uma URL de avatar</Label>
          <Input
            id="avatar_url"
            type="url"
            placeholder="https://…"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
