import { describe, it, expect } from 'vitest';
import { buildNewsletterCampaignEmail } from '@/lib/email/templates/newsletter-campaign';

describe('newsletter campaign email template', () => {
  it('builds modular campaign email with highlights, material of the week and opt-out', () => {
    const result = buildNewsletterCampaignEmail({
      subject: 'Novidades da Semana: Peças em Alta e Filamento PETG Carbono — GLTech3D',
      recipientEmail: 'cliente@teste.com',
      products: [
        { name: 'Vaso Origami Geométrico', price: 'R$ 79,90', url: 'https://gltech3d.vercel.app/product/vaso-origami' },
        { name: 'Suporte Articulado para Fones', price: 'R$ 49,90', url: 'https://gltech3d.vercel.app/product/suporte-fones' },
        { name: 'Action Figure Samurai Low Poly', price: 'R$ 119,00', url: 'https://gltech3d.vercel.app/product/samurai-lowpoly' },
      ],
      materialOfTheWeek: {
        name: 'PETG Carbon Fiber',
        description: 'Reforçado com fibras de carbono para máxima rigidez mecânica e acabamento fosco requintado.',
        colorHex: '#2E3440',
        badge: 'Engenharia Avançada',
      },
      unsubscribeUrl: 'https://gltech3d.vercel.app/api/newsletter/unsubscribe?email=cliente@teste.com',
    });

    // Validar Assunto
    expect(result.subject).toContain('Novidades da Semana');

    // Validar Bloco 1: Destaques de Produtos
    expect(result.html).toContain('Vaso Origami Geométrico');
    expect(result.html).toContain('R$ 79,90');
    expect(result.html).toContain('Action Figure Samurai Low Poly');

    // Validar Bloco 2: Material da Semana
    expect(result.html).toContain('PETG Carbon Fiber');
    expect(result.html).toContain('Engenharia Avançada');

    // Validar Bloco 3: CTA Projeto Personalizado
    expect(result.html).toContain('Tem um projeto personalizado?');
    expect(result.html).toContain('Envie seu arquivo STL');

    // Validar Footer: WhatsApp oficial e Opt-out
    expect(result.html).toContain('(31) 99928-4834');
    expect(result.html).toContain('https://instagram.com/gltech3d');
    expect(result.html).toContain('cancelar sua inscrição');

    // Validar Texto puro
    expect(result.text).toContain('Vaso Origami Geométrico');
    expect(result.text).toContain('PETG Carbon Fiber');
    expect(result.text).toContain('(31) 99928-4834');
    expect(result.text).toContain('cancelar sua inscrição');
  });
});
