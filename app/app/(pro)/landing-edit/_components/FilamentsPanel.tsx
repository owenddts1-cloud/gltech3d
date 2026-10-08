'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { FilamentAdmin } from '@/lib/filament-catalog/types';
import { sortForDisplay } from '../_lib/order';
import { FilamentRows } from '@/app/app/(pro)/filamentos/_components/FilamentRows';

/**
 * Quick controls of the filament storefront inside the Landing Edit: order,
 * availability and published. Same component and actions as CRM → Filamentos;
 * the full sheet (specs, price, photos) is edited there.
 *
 * The Live Preview does not render the filament section (it shows the pieces
 * catalog draft); changes here go straight to the site.
 */
export default function FilamentsPanel({ initialFilaments }: { initialFilaments: FilamentAdmin[] }) {
  const [items, setItems] = useState(() => sortForDisplay(initialFilaments));
  const published = items.filter((f) => f.isPublished).length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Filamentos na vitrine</h3>
        <p className="text-xs text-muted-foreground">
          {published} de {items.length} publicados. A seção “Filamentos” da home mostra os 8 primeiros desta ordem e some
          quando nenhum está publicado. Alterações aqui vão direto ao site (não passam pelo preview).
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Nenhum filamento cadastrado.{' '}
          <Link href="/app/filamentos" className="text-accent underline underline-offset-4">
            Cadastrar em Filamentos
          </Link>
        </p>
      ) : (
        <FilamentRows items={items} onItemsChange={setItems} compact />
      )}

      <Link href="/app/filamentos" className="block text-center text-xs font-medium text-accent underline underline-offset-4">
        Editar ficha, preço e fotos em Vendas → Filamentos
      </Link>
    </div>
  );
}
