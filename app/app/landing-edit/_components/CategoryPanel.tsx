'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Check, X, ArrowRightLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { renameCategory, reassignCategory } from '@/app/actions/landing/actions';
import type { LandingProductAdmin } from '@/app/actions/landing/actions';

/**
 * Gestão de nichos.
 *
 * Não existe tabela de categorias: nicho é a coluna `products.category`. Então
 * "renomear" é update em massa e "excluir" é reatribuir as peças. Nunca apaga
 * produto — perder peça por causa de um rótulo seria desastroso.
 */
export default function CategoryPanel({
  products,
  onRenamed,
  onReassigned,
}: {
  products: LandingProductAdmin[];
  onRenamed: (from: string, to: string) => void;
  onReassigned: (from: string, to: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [moving, setMoving] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [busy, setBusy] = useState(false);

  const categories = useMemo(() => {
    const map = new Map<string, { total: number; published: number }>();
    for (const p of products) {
      const key = p.category?.trim();
      if (!key) continue;
      const cur = map.get(key) ?? { total: 0, published: 0 };
      cur.total += 1;
      if (p.isPublished) cur.published += 1;
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const withoutCategory = products.filter((p) => !p.category?.trim()).length;

  async function commitRename(from: string) {
    const to = draft.trim();
    if (!to || to === from) {
      setEditing(null);
      return;
    }
    setBusy(true);
    const r = await renameCategory({ from, to });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    onRenamed(from, to);
    setEditing(null);
    toast.success(`${r.updated} ${r.updated === 1 ? 'peça movida' : 'peças movidas'} para "${to}"`);
  }

  async function commitMove(from: string) {
    setBusy(true);
    const r = await reassignCategory({ from, to: moveTo });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    onReassigned(from, moveTo);
    setMoving(null);
    setMoveTo('');
    toast.success(
      moveTo
        ? `${r.moved} ${r.moved === 1 ? 'peça movida' : 'peças movidas'} para "${moveTo}"`
        : `${r.moved} ${r.moved === 1 ? 'peça ficou' : 'peças ficaram'} sem nicho`,
    );
  }

  return (
    <div>
      <p className="mb-4 text-xs text-muted-foreground">
        Os nichos saem das peças do catálogo. Renomear aqui atualiza todas as peças de uma vez. Para
        criar um nicho novo, basta digitá-lo no campo Categoria de qualquer peça.
      </p>

      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.name} className="rounded-lg border border-border p-3">
            {editing === cat.name ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={draft}
                  disabled={busy}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitRename(cat.name);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                  className="h-8"
                />
                <Button size="sm" disabled={busy} onClick={() => void commitRename(cat.name)}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : moving === cat.name ? (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  Mover as {cat.total} {cat.total === 1 ? 'peça' : 'peças'} de &quot;{cat.name}&quot;
                  para:
                </p>
                <div className="flex items-center gap-2">
                  <Select value={moveTo || '__none'} onValueChange={(v) => setMoveTo(v === '__none' ? '' : v)}>
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue placeholder="Escolha o destino" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sem nicho</SelectItem>
                      {categories
                        .filter((c) => c.name !== cat.name)
                        .map((c) => (
                          <SelectItem key={c.name} value={c.name}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" disabled={busy} onClick={() => void commitMove(cat.name)}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMoving(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{cat.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {cat.total} {cat.total === 1 ? 'peça' : 'peças'} · {cat.published} no ar
                  </div>
                </div>
                <button
                  type="button"
                  title="Renomear nicho"
                  onClick={() => {
                    setDraft(cat.name);
                    setEditing(cat.name);
                  }}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Mover peças para outro nicho"
                  onClick={() => {
                    setMoveTo('');
                    setMoving(cat.name);
                  }}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}

        {withoutCategory > 0 && (
          <div className="rounded-lg border border-dashed border-border p-3">
            <div className="text-xs font-medium text-muted-foreground">Sem nicho</div>
            <div className="text-[11px] text-muted-foreground">
              {withoutCategory} {withoutCategory === 1 ? 'peça' : 'peças'} — aparecem como
              &quot;Outros&quot; na landing
            </div>
          </div>
        )}

        {categories.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Nenhum nicho ainda. Defina a categoria de uma peça para criar o primeiro.
          </p>
        )}
      </div>
    </div>
  );
}
