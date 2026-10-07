import { describe, it, expect } from 'vitest';
import { buildPasswordResetEmail } from '@/lib/email/templates/password-reset';
import { signPasswordResetToken, verifyPasswordResetToken } from '@/lib/auth/password-reset-token';

describe('password reset email and token flow', () => {
  it('builds email with dark tech branding, reset link and text version', () => {
    const expiresAt = new Date(Date.now() + 3600 * 1000);
    const resetUrl = 'https://gltech3d.vercel.app/redefinir-senha?token=abc-xyz-token';
    const email = buildPasswordResetEmail({ resetUrl, expiresAt });

    expect(email.subject).toContain('Redefinição de Senha — GLTech3D');
    expect(email.html).toContain(resetUrl);
    expect(email.html).toContain('#12100E'); // Dark background
    expect(email.html).toContain('GLTECH');
    expect(email.text).toContain(resetUrl);
    expect(email.text).toContain('1 hora');
  });

  it('signs and verifies a password reset token round-trip', () => {
    const payload = { userId: 'user-uuid-123', email: 'cliente@exemplo.com' };
    const token = signPasswordResetToken(payload);

    expect(token).toBeTruthy();
    const verified = verifyPasswordResetToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(payload.userId);
    expect(verified?.email).toBe(payload.email);
  });
});
