/**
 * Regra de senha, em um lugar só.
 *
 * O mínimo vivia cravado em `activateAccount.ts`. Com auto-cadastro, ativação e
 * redefinição de senha pedindo a mesma coisa, três cópias divergiriam — e a
 * divergência que importa é a silenciosa: o formulário aceita 8 caracteres, o
 * servidor exige 10, e o usuário vê "erro inesperado" sem saber o que fazer.
 */

export const MIN_PASSWORD_LENGTH = 10;

export type PasswordProblem = "too_short";

/** `null` quando a senha serve. */
export function validatePassword(password: string): PasswordProblem | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "too_short";
  return null;
}

/** Mensagem em pt-BR para a UI e para a resposta da API. */
export function passwordProblemMessage(problem: PasswordProblem): string {
  switch (problem) {
    case "too_short":
      return `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
}
