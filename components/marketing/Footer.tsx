import { MessageCircle, Instagram, ShoppingCart, Package, Clock, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer id="contato" className="bg-[#2D241E] text-[#F9F7F2] py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-[#A6815C] rounded-lg flex items-center justify-center transition-transform duration-300 hover:scale-110 hover:rotate-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                </svg>
              </div>
              <span className="text-xl font-bold font-sora tracking-tight">GLTech3D</span>
            </div>
            <p className="text-sm text-[#F9F7F2]/60 leading-relaxed">
              Produtos únicos de impressão 3D feitos com amor e precisão. Do arquivo ao objeto real.
            </p>
          </div>

          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#A6815C] mb-6">Fale Conosco</h4>
            <ul className="space-y-4 text-sm">
              <li>
                <a href="https://wa.me/5531999284834" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 transition-transform hover:translate-x-1">
                  <span className="w-6 h-6 rounded bg-white/5 flex items-center justify-center transition-colors group-hover:bg-[#A6815C]"><MessageCircle className="w-4 h-4" /></span>
                  <span className="transition-colors group-hover:text-white">WhatsApp <br /><small className="text-white/40">(31) 99928-4834</small></span>
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/gltech3d/" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 transition-transform hover:translate-x-1">
                  <span className="w-6 h-6 rounded bg-white/5 flex items-center justify-center transition-colors group-hover:bg-[#A6815C]"><Instagram className="w-4 h-4" /></span>
                  <span className="transition-colors group-hover:text-white">Instagram <br /><small className="text-white/40">@gltech3d</small></span>
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#A6815C] mb-6">Onde Comprar</h4>
            <ul className="space-y-4 text-sm">
              <li>
                <a href="https://shopee.com.br/gltech3d" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 transition-transform hover:translate-x-1">
                  <span className="w-6 h-6 rounded bg-white/5 flex items-center justify-center transition-colors group-hover:bg-[#A6815C]"><ShoppingCart className="w-4 h-4" /></span>
                  <span className="transition-colors group-hover:text-white">Shopee <br /><small className="text-white/40">Loja Oficial</small></span>
                </a>
              </li>
              <li>
                <a href="https://www.mercadolivre.com.br" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 transition-transform hover:translate-x-1">
                  <span className="w-6 h-6 rounded bg-white/5 flex items-center justify-center transition-colors group-hover:bg-[#A6815C]"><Package className="w-4 h-4" /></span>
                  <span className="transition-colors group-hover:text-white">Mercado Livre <br /><small className="text-white/40">Loja Oficial</small></span>
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#A6815C] mb-6">Informações</h4>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded bg-white/5 flex items-center justify-center mt-1"><Clock className="w-4 h-4" /></span>
                <span>Atendimento <br /><small className="text-white/40">Seg - Sab</small></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded bg-white/5 flex items-center justify-center mt-1"><MapPin className="w-4 h-4" /></span>
                <span>Localização <br /><small className="text-white/40">Minas Gerais - MG</small></span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-white/30 uppercase tracking-widest font-bold">
          <span>© 2026 GLTech3D Store. Todos os direitos reservados.</span>
          <span>Feito com ❤️ no Brasil</span>
        </div>
      </div>
    </footer>
  );
}
