'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogIn, X } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const scrollTo = (id: string) => {
    setIsOpen(false);
    if (pathname !== '/') {
      router.push(`/#${id}`);
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const goHome = () => {
    setIsOpen(false);
    if (pathname !== '/') {
      router.push('/');
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 px-4 py-4 bg-[#F9F7F2]/90 backdrop-blur-md border-b border-[#E8E2D9]">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#A6815C] rounded-lg flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
            </svg>
          </div>
          <span className="text-xl font-bold font-sora tracking-tight">GLTech3D</span>
        </Link>

        <button
          className="p-2 lg:hidden text-[#2D241E] hover:bg-[#E8E2D9] rounded-lg transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Abrir menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-[#6B5E55]">
          <button onClick={goHome} className="hover:text-[#A6815C] transition-colors">Início</button>
          <button onClick={() => scrollTo('categorias')} className="hover:text-[#A6815C] transition-colors">Categorias</button>
          <button onClick={() => scrollTo('produtos')} className="hover:text-[#A6815C] transition-colors">Produtos</button>
          <button onClick={() => scrollTo('contato')} className="hover:text-[#A6815C] transition-colors">Contato</button>
        </div>

        <Link
          href="/login"
          className="hidden lg:flex items-center gap-2 px-5 py-2.5 bg-[#A6815C] hover:bg-[#8E6D4D] transition-colors text-white rounded-xl text-sm font-semibold"
        >
          <LogIn className="h-4 w-4" />
          Entrar
        </Link>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-[#F9F7F2] border-b border-[#E8E2D9] shadow-lg py-4 px-6 flex flex-col gap-4 animate-in slide-in-from-top-2">
          <button onClick={goHome} className="text-left py-2 font-medium text-[#6B5E55] hover:text-[#A6815C]">Início</button>
          <button onClick={() => scrollTo('categorias')} className="text-left py-2 font-medium text-[#6B5E55] hover:text-[#A6815C]">Categorias</button>
          <button onClick={() => scrollTo('produtos')} className="text-left py-2 font-medium text-[#6B5E55] hover:text-[#A6815C]">Produtos</button>
          <button onClick={() => scrollTo('contato')} className="text-left py-2 font-medium text-[#6B5E55] hover:text-[#A6815C]">Contato</button>
          <Link
            href="/login"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-center gap-2 w-full py-3 mt-2 bg-[#A6815C] text-white rounded-xl font-semibold"
          >
            <LogIn className="h-4 w-4" />
            Entrar
          </Link>
        </div>
      )}
    </nav>
  );
}
