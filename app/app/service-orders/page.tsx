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
  const saleChannels = result.ok ? result.saleChannels : [];
  const materials = result.ok ? result.materials : [];
  return (
    <ServiceOrdersBoard
      initialOrders={orders}
      contacts={contacts}
      saleChannels={saleChannels}
      materials={materials}
      openOsId={sp.os}
    />
  );
}
