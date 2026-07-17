import { fetchServiceOrdersData } from "@/app/actions/service-orders/actions";
import { fetchCalendarEvents, fetchSalesDates } from "@/app/actions/calendar/actions";
import { CalendarClient } from "./_components/CalendarClient";

export const metadata = { title: "Calendário" };
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [ordersRes, eventsRes, salesRes] = await Promise.all([
    fetchServiceOrdersData(),
    fetchCalendarEvents(),
    fetchSalesDates(),
  ]);
  const orders = ordersRes.ok ? ordersRes.orders : [];
  const events = eventsRes.ok ? eventsRes.events : [];
  const sales = salesRes.ok ? salesRes.sales : [];

  return <CalendarClient initialOrders={orders} initialEvents={events} initialSales={sales} />;
}
