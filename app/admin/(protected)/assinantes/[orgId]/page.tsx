import { SubscriberDetailClient } from "./_client";

export const metadata = { title: "Assinante — Admin Plataforma" };

export default async function AdminSubscriberPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <SubscriberDetailClient orgId={orgId} />;
}
