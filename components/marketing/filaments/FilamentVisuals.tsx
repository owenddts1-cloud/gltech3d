/**
 * Small visual atoms of the filament storefront: the spool swatch (used when a
 * filament has no photo, in the cart and in filter chips) and the availability
 * badge. Server-safe (no hooks), so pages and client components share them.
 */
import type { FilamentAvailability } from '@/lib/filament-catalog/schemas';

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * A filament spool seen from the side: colored windings around a hub. Pure CSS
 * (radial + repeating gradients) so it scales from a 16px chip to a card hero.
 */
export function SpoolSwatch({
  hex,
  label,
  size = 48,
  className = '',
}: {
  hex: string | null;
  label: string;
  size?: number;
  className?: string;
}) {
  const color = hex && HEX.test(hex) ? hex : '#C8BEB2';
  return (
    <span
      role="img"
      aria-label={label}
      className={`relative inline-block shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 50%, #F9F7F2 0 17%, #2B2622 17% 21%, transparent 21%),
          repeating-radial-gradient(circle at 50% 50%, ${color} 0 2px, color-mix(in srgb, ${color} 82%, #000) 2px 3px),
          ${color}`,
        boxShadow: `inset 0 0 0 ${Math.max(2, size / 14)}px #2B2622, 0 6px 18px -8px rgba(43,38,34,0.45)`,
      }}
    />
  );
}

const BADGE_STYLE: Record<FilamentAvailability, string> = {
  em_estoque: 'bg-[#EEF1E6] text-[#4B5A33] border-[#D6DEC4]',
  ultimas_unidades: 'bg-[#FBEFD9] text-[#7A4E12] border-[#EED6A8]',
  sob_encomenda: 'bg-[#EFEAE1] text-[#7A5C3E] border-[#E0D6C6]',
  esgotado: 'bg-[#F3E6E2] text-[#8A3B2B] border-[#E7CFC8]',
};

const DOT_STYLE: Record<FilamentAvailability, string> = {
  em_estoque: 'bg-[#6F7F52]',
  ultimas_unidades: 'bg-[#C98A2B] animate-pulse motion-reduce:animate-none',
  sob_encomenda: 'bg-[#A6815C]',
  esgotado: 'bg-[#B4553F]',
};

/** The label comes from the server (`availabilityLabel`) — real data only. */
export function AvailabilityBadge({
  availability,
  label,
  className = '',
}: {
  availability: FilamentAvailability;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${BADGE_STYLE[availability]} ${className}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT_STYLE[availability]}`} />
      {label}
    </span>
  );
}
