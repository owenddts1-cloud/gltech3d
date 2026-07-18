import { fetchServiceOrdersData } from "@/app/actions/service-orders/actions";
import { ServiceOrdersBoard } from "./_components/ServiceOrdersBoard";

export const metadata = { title: "Ordens de Serviço" };
export const dynamic = "force-dynamic";

export default async function ServiceOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ os?: string }>;
}) {
  const [result, sp] = await Promise.all([fetchServiceOrdersData(), searchParams]);
  const orders = result.ok ? result.orders : [];
  const contacts = result.ok ? result.contacts : [];
  return <ServiceOrdersBoard initialOrders={orders} contacts={contacts} openOsId={sp.os} />;
}
