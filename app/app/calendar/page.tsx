import { fetchServiceOrdersData } from "@/app/actions/service-orders/actions";
import { CalendarClient } from "./_components/CalendarClient";

export const metadata = { title: "Calendário" };
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const result = await fetchServiceOrdersData();
  const orders = result.ok ? result.orders : [];

  return <CalendarClient initialOrders={orders} />;
}
