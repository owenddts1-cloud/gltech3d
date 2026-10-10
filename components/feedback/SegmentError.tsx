"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface SegmentErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  segment?: string;
}

export function SegmentError({ error, reset, segment }: SegmentErrorProps) {
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error(`[SegmentError] (${segment ?? "root"}):`, error);
    const id = Sentry.captureException(error, {
      tags: segment ? { segment } : undefined,
    });
    setEventId(id);
  }, [error, segment]);

  const displayId = eventId ?? error.digest ?? "—";

  function copyId() {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(displayId)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          fallbackCopy();
        });
    } else {
      fallbackCopy();
    }
  }

  function fallbackCopy() {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = displayId;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignored if user browser completely forbids copying
    }
  }

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-md p-6 md:p-8 text-center shadow-lg">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente novamente em instantes. Se persistir, contate o suporte com o ID abaixo.
        </p>
        <div className="mt-4 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
          ID: {displayId}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={copyId}>
            {copied ? "Copiado!" : "Copiar ID"}
          </Button>
          <Button type="button" onClick={() => reset()}>
            Tentar de novo
          </Button>
          <Button type="button" variant="ghost" asChild>
            <a href="/login">Ir para o Login</a>
          </Button>
        </div>
      </Card>
    </main>
  );
}
