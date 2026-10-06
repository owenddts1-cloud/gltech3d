import { ProSignupDetailClient } from "./_form";

export const metadata = { title: "Pedido Calc3D PRO — Admin Plataforma" };

export default async function AdminProSignupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProSignupDetailClient id={id} />;
}
