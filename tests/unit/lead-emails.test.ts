import { describe, it, expect } from 'vitest';
import { buildLeadNotifyEmail } from '@/lib/email/templates/lead-notify';
import { buildLeadWelcomeEmail } from '@/lib/email/templates/lead-welcome';

describe('lead emails (notify and welcome)', () => {
  it('builds directorate notification with ficha técnica and 1-click WhatsApp link', () => {
    const notify = buildLeadNotifyEmail({
      type: 'lead',
      name: 'Carlos Oliveira',
      email: 'carlos@empresa.com',
      phone: '(31) 98765-4321',
      projectType: 'Prototipagem Industrial',
      message: 'Gostaria de cotar 10 peças em PETG Cinza.',
      createdAt: new Date(),
    });

    expect(notify.subject).toContain('[Novo Lead Orçamento] Carlos Oliveira — Prototipagem Industrial');
    expect(notify.html).toContain('Ficha Técnica');
    expect(notify.html).toContain('Carlos Oliveira');
    expect(notify.html).toContain('carlos@empresa.com');
    expect(notify.html).toContain('https://wa.me/5531987654321');
    expect(notify.html).toContain('Chamar no WhatsApp em 1 Clique');
    expect(notify.text).toContain('WhatsApp Direto');
  });

  it('builds warm customer welcome email with estimated response time', () => {
    const welcome = buildLeadWelcomeEmail({
      name: 'Carlos Oliveira',
      projectType: 'Prototipagem Industrial',
    });

    expect(welcome.subject).toBe('Recebemos sua solicitação de orçamento — GLTech3D');
    expect(welcome.html).toContain('Olá, Carlos!');
    expect(welcome.html).toContain('Prototipagem Industrial');
    expect(welcome.html).toContain('2 horas úteis');
    expect(welcome.text).toContain('2 horas úteis');
  });
});
