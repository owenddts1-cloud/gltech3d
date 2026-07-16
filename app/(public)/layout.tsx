import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-6">
      <div className="absolute top-4 left-4 md:top-6 md:left-6">
        <Button variant="outline" asChild className="gap-2 border-border/80 hover:border-accent hover:text-accent">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar ao site</span>
          </Link>
        </Button>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
