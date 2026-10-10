import { getBotStatus, getBotOffers, getBotConfig, getBotHistory } from "@/lib/bot-engine/client";
import { BotOfertasClient } from "./_components/BotOfertasClient";

export const metadata = {
  title: "Bot de Ofertas & Afiliados — GLTECH CRM",
  description: "Disparos automáticos e programados de ofertas para grupos de WhatsApp e Telegram.",
};

export const dynamic = "force-dynamic";

export default async function BotOfertasPage() {
  const [status, offers, config, history] = await Promise.all([
    getBotStatus(),
    getBotOffers(),
    getBotConfig(),
    getBotHistory(),
  ]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <BotOfertasClient
        initialStatus={status}
        initialOffers={offers}
        initialConfig={config}
        initialHistory={history}
      />
    </div>
  );
}
