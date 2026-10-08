import { listFilaments } from "@/app/actions/filament-catalog/actions";
import { getStoreWhatsapp } from "@/lib/landing/whatsapp";
import { formatWhatsappDisplay } from "@/lib/landing/whatsapp-number";
import { FilamentsClient } from "./_components/FilamentsClient";

export const metadata = { title: "Filamentos" };
export const dynamic = "force-dynamic";

export default async function FilamentosPage() {
  const [r, storeWhatsapp] = await Promise.all([listFilaments(), getStoreWhatsapp()]);
  return (
    <FilamentsClient
      initialFilaments={r.ok ? r.filaments : []}
      materials={r.ok ? r.materials : []}
      loadError={r.ok ? null : r.error}
      defaultPdfWhatsapp={formatWhatsappDisplay(storeWhatsapp)}
    />
  );
}
