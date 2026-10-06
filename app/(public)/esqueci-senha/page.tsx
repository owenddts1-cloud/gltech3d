import type { Metadata } from "next";
import { ForgotPasswordForm } from "./_form";

export const metadata: Metadata = {
  title: "Esqueci minha senha — GLTECH CRM",
  robots: { index: false, follow: false },
};

export default function EsqueciSenhaPage() {
  return <ForgotPasswordForm />;
}
