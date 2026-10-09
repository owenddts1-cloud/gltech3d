'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogIn, X, Calculator, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useOptionalCart } from '@/components/marketing/cart/CartProvider';

const LINKS = [
  { id: 'home', label: 'Início' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'filamentos', label: 'Filamentos' },
  { id: 'contato', label: 'Contato' },
];

// Rotas dedicadas (não são âncoras da home).
const ROUTE_LINKS = [
  { href: '/orcamento', label: 'Orçamento' },
  { href: '/tecnologias', label: 'Tecnologias' },
];

// Referência estável: um array literal dentro do componente seria uma
// identidade nova a cada render e o efeito do observer rodaria em laço.
const ANCHOR_IDS = LINKS.filter((l) => l.id !== 'home').map((l) => l.id);

/**
 * Fundo do chip de navegação.
 *
 * No desktop isto vai num `<span>` atrás do rótulo, nunca no próprio `<button>`:
 * a pill animada de hover vive em `-z-10` dentro do botão, então um `bg-*` no
 * elemento a cobriria e a animação sumiria. No drawer não há pill, e a classe é
 * aplicada direto.
 *
 * Os dois tons de repouso existem porque a nav tem dois fundos: sobre o hero
 * (transparente) o chip precisa se destacar para cima, com creme; dentro da
 * cápsula creme precisa se destacar para baixo, com o track rebaixado.
 */
function chipSurface(opts: { active: boolean; scrolled: boolean }): string {
  // Bronze-ink (#7A5C3E), não bronze-deep: o rótulo tem 14px, que não conta como
  // "large text", logo exige 4.5:1. Branco sobre #8E6D4D fica no fio; sobre
  // #7A5C3E passa com folga. Ver a tabela de contraste em tailwind.config.ts.
  if (opts.active) return 'bg-[#7A5C3E] shadow-sm';
  return opts.scrolled ? 'bg-[#F9F7F2]' : 'bg-white/55';
}

function chipText(active: boolean): string {
  return active ? 'text-white' : 'text-[#6B5E55] hover:text-[#2D241E]';
}

/**
 * Qual seção da home está em vista.
 *
 * `enabled` existe por causa do rodapé: `Footer.tsx` é dono do id `contato` e
 * renderiza em /orcamento, /tecnologias e /calc3d-pro. Sem a guarda, rolar até
 * o fim de qualquer página acenderia "Contato" na barra.
 */
function useActiveSection(enabled: boolean): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setActiveId(null);
      return;
    }
    const targets = ANCHOR_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (targets.length === 0) return;

    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let best: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        setActiveId(bestRatio > 0 ? best : null);
      },
      // O topo é descontado da altura da própria nav; o rodapé só conta quando
      // entra de verdade na tela, não de raspão.
      { rootMargin: '-96px 0px -45% 0px', threshold: [0, 0.15, 0.4, 0.75] },
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [enabled]);

  return activeId;
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const cart = useOptionalCart();

  const isHome = pathname === '/';
  const activeSection = useActiveSection(isHome);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (id: string) => {
    setIsOpen(false);
    if (id === 'home') {
      if (pathname !== '/') return void router.push('/');
      return window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (pathname !== '/') return void router.push(`/#${id}`);
    const target = document.getElementById(id);
    // The filament section is hidden when nothing is published: send to the catalog page.
    if (!target && id === 'filamentos') return void router.push('/filamentos');
    target?.scrollIntoView({ behavior: 'smooth' });
  };

  // "Início" acende quando estamos na home e nenhuma seção reivindicou a vista.
  // On /filamentos and its pages the "Filamentos" chip is the active one.
  const onFilamentPages = pathname?.startsWith('/filamentos') ?? false;
  const isAnchorActive = (id: string) =>
    (id === 'filamentos' && onFilamentPages) ||
    (isHome && (id === 'home' ? activeSection === null : activeSection === id));
  const isRouteActive = (href: string) => pathname === href;

  return (
    <header className="fixed top-3 sm:top-4 inset-x-0 z-50 pointer-events-none px-3 sm:px-6 md:px-8 transition-all duration-300">
      <div className="mx-auto max-w-[1536px] flex items-center justify-between gap-3 relative">
        {/* Espaçador de balanço em telas ultra-wide para centralização geométrica perfeita */}
        <div className="hidden 2xl:block w-[220px] shrink-0 pointer-events-none" aria-hidden="true" />

        {/* Barra Superior Central (Cápsula Flutuante) */}
        <div className="flex-1 flex justify-start lg:justify-center min-w-0">
          <nav
            className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 rounded-full border border-[#E8E2D9] bg-[#F9F7F2]/95 backdrop-blur-xl shadow-[0_12px_40px_-10px_rgba(43,38,34,0.12)] py-1.5 pl-3 sm:pl-4 pr-2 sm:pr-2.5 transition-all duration-300"
          >
            {/* Logo GLTech3D */}
            <button
              onClick={() => go('home')}
              className="group flex items-center gap-2 shrink-0 pr-1.5 sm:pr-2 border-r border-[#E8E2D9]/60"
              aria-label="Início"
            >
              <span className="w-7 h-7 bg-[#8E6D4D] rounded-lg flex items-center justify-center text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-md group-hover:shadow-[#A6815C]/35">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                </svg>
              </span>
              <span className="text-base sm:text-lg font-black font-sora tracking-tight text-[#2D241E]">GLTech3D</span>
            </button>

            {/* Links Centrais (Desktop) */}
            <div className="relative isolate hidden lg:flex items-center gap-0.5 rounded-full p-0.5 bg-[#EFEAE1]/75 border border-[#E8E2D9]/60">
              {LINKS.map((l) => {
                const active = isAnchorActive(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => go(l.id)}
                    onMouseEnter={() => setHoveredId(l.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    aria-current={active ? 'location' : undefined}
                    className={`relative px-2.5 xl:px-3.5 py-1.5 text-xs xl:text-sm font-semibold rounded-full transition-colors ${chipText(active)}`}
                  >
                    <span
                      aria-hidden
                      className={`absolute inset-0 rounded-full -z-20 transition-colors ${chipSurface({ active, scrolled })}`}
                    />
                    <AnimatePresence>
                      {hoveredId === l.id && !active && (
                        <motion.span
                          layoutId="nav-hover-pill"
                          className="absolute inset-0 bg-[#A6815C]/18 rounded-full -z-10"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                    </AnimatePresence>
                    {l.label}
                  </button>
                );
              })}
              {ROUTE_LINKS.map((l) => {
                const active = isRouteActive(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onMouseEnter={() => setHoveredId(l.href)}
                    onMouseLeave={() => setHoveredId(null)}
                    aria-current={active ? 'page' : undefined}
                    className={`relative px-2.5 xl:px-3.5 py-1.5 text-xs xl:text-sm font-semibold rounded-full transition-colors ${chipText(active)}`}
                  >
                    <span
                      aria-hidden
                      className={`absolute inset-0 rounded-full -z-20 transition-colors ${chipSurface({ active, scrolled })}`}
                    />
                    <AnimatePresence>
                      {hoveredId === l.href && !active && (
                        <motion.span
                          layoutId="nav-hover-pill"
                          className="absolute inset-0 bg-[#A6815C]/18 rounded-full -z-10"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                    </AnimatePresence>
                    {l.label}
                  </Link>
                );
              })}
            </div>

            {/* Botão Carrinho na Extrema Direita da Barra Central */}
            {cart !== null ? (
              <button
                type="button"
                onClick={() => cart.setOpen(true)}
                aria-label={`Abrir carrinho (${cart.count} itens)`}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#2D241E] border border-[#E8E2D9] bg-white/85 shadow-xs transition-all duration-300 hover:bg-white hover:border-[#A6815C] hover:shadow hover:scale-105 shrink-0 ml-0.5"
              >
                <ShoppingBag className="h-3.5 w-3.5 text-[#A6815C] shrink-0" />
                <span className="hidden sm:inline">Carrinho</span>
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#A6815C] px-1 text-[10px] font-black text-white">
                  {cart.count}
                </span>
              </button>
            ) : null}

            {/* Menu Hamburguer em telas menores */}
            <button
              className="p-1.5 lg:hidden text-[#2D241E] hover:bg-[#E8E2D9]/60 rounded-full transition-colors shrink-0"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Abrir menu"
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </nav>
        </div>

        {/* Ações no Canto Superior Direito (FORA da Barra Central) */}
        <div className="pointer-events-auto hidden md:flex items-center gap-2 shrink-0 ml-auto 2xl:w-[220px] 2xl:justify-end">
          <Link
            href="/calc3d-pro"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#8E6D4D] to-[#A6815C] shadow-md shadow-[#A6815C]/25 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#A6815C]/35 shrink-0"
          >
            <Calculator className="h-4 w-4 shrink-0" />
            <span>Calc3D</span>
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-black tracking-[0.15em] uppercase">PRO</span>
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold text-[#2D241E] border border-[#E8E2D9] bg-[#F9F7F2]/90 backdrop-blur-md shadow-sm transition-all duration-300 hover:bg-white hover:border-[#D5CDC0] hover:shadow hover:scale-[1.02] shrink-0"
          >
            <LogIn className="h-4 w-4 shrink-0" />
            <span>Entrar</span>
          </Link>
        </div>
      </div>

      {/* Drawer Mobile (quando aberto em telas menores) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="pointer-events-auto lg:hidden w-full max-w-sm mx-auto mt-2 overflow-hidden flex flex-col gap-1.5 p-4 rounded-2xl border border-[#E8E2D9] bg-[#F9F7F2]/95 backdrop-blur-xl shadow-xl"
          >
            {LINKS.map((l) => {
              const active = isAnchorActive(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => go(l.id)}
                  aria-current={active ? 'location' : undefined}
                  className={`text-left py-2.5 px-4 font-semibold rounded-xl border border-[#E8E2D9] transition-all ${chipSurface({ active, scrolled: true })} ${chipText(active)}`}
                >
                  {l.label}
                </button>
              );
            })}
            {ROUTE_LINKS.map((l) => {
              const active = isRouteActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setIsOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`text-left py-2.5 px-4 font-semibold rounded-xl border border-[#E8E2D9] transition-all ${chipSurface({ active, scrolled: true })} ${chipText(active)}`}
                >
                  {l.label}
                </Link>
              );
            })}
            {cart !== null ? (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  cart.setOpen(true);
                }}
                className="flex items-center justify-center gap-2 w-full py-2.5 mt-2 rounded-xl font-bold text-[#2D241E] border border-[#E8E2D9] bg-white transition-colors hover:bg-[#E8E2D9]/60"
              >
                <ShoppingBag className="h-4 w-4 text-[#A6815C]" />
                <span>Carrinho</span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#A6815C] px-1.5 text-[10px] font-black text-white">
                  {cart.count}
                </span>
              </button>
            ) : null}
            <Link
              href="/calc3d-pro"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-[#8E6D4D] to-[#A6815C] shadow-md shadow-[#A6815C]/25 transition-colors"
            >
              <Calculator className="h-4 w-4" />
              Calc3D
              <span className="rounded bg-white/20 px-1.5 text-[10px] font-black tracking-[0.15em]">PRO</span>
            </Link>
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-[#2D241E] border border-[#E8E2D9] bg-white transition-colors hover:bg-[#E8E2D9]/60"
            >
              <LogIn className="h-4 w-4" />
              Entrar
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
