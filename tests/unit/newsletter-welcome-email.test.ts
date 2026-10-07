import { describe, it, expect } from 'vitest';
import { buildNewsletterWelcomeEmail } from '@/lib/email/templates/newsletter-welcome';

describe('newsletter welcome email template', () => {
  it('builds welcome email with official channels and text version', () => {
    const email = 'novidades@cliente.com';
    const result = buildNewsletterWelcomeEmail({ email });

    expect(result.subject).toContain('GLTech3D');
    expect(result.html).toContain(email);
    expect(result.html).toContain('Inscrição Confirmada');
    expect(result.html).toContain('instagram.com/gltech3d');
    expect(result.text).toContain('GLTech3D');
    expect(result.text).toContain('instagram.com/gltech3d');
  });
});
