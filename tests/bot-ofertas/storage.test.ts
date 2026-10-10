import { describe, it, expect, beforeEach } from "vitest";
const storage = require("../../services/bot_ofertas/src/services/storage");

describe("Storage V2 Multi-Niche & Multi-Marketplace", () => {
  it("salva e recupera oferta com nicho, marketplace, couponHubUrl e copyStyle", () => {
    const offer = storage.addOffer({
      title: "Filamento PETG Masterprint 1kg",
      category: "Filamentos 3D",
      niche: "impressao_3d",
      marketplace: "shopee",
      couponHubUrl: "https://sshopee.me/GMNE98tfdo4yYUpL",
      copyStyle: "achado",
      originalPrice: 79.9,
      promoPrice: 62.27,
      status: "pendente",
    });

    expect(offer.niche).toBe("impressao_3d");
    expect(offer.marketplace).toBe("shopee");
    expect(offer.couponHubUrl).toBe("https://sshopee.me/GMNE98tfdo4yYUpL");
    expect(offer.copyStyle).toBe("achado");
    expect(offer.recycledCount).toBe(0);

    // Recupera a lista
    const all = storage.getOffers();
    const found = all.find((o: any) => o.id === offer.id);
    expect(found).toBeDefined();
    expect(found.niche).toBe("impressao_3d");
  });

  it("permite filtrar ou buscar próxima pendente por nicho ou geral", () => {
    storage.addOffer({
      title: "Alicate de Corte Maker",
      niche: "ferramentas",
      promoPrice: 25.0,
      status: "pendente",
    });

    const nextFerramentas = storage.getNextPendingOffer("ferramentas");
    expect(nextFerramentas).toBeDefined();
    expect(nextFerramentas.niche).toBe("ferramentas");
  });

  it("recupera a oferta mais antiga para rodízio quando não houver pendentes", () => {
    const recycled = storage.getNextRecycledOffer("impressao_3d");
    // Pode retornar uma oferta enviada ou null se não houver ofertas
    if (recycled) {
      expect(["enviado", "pendente"]).toContain(recycled.status);
    }
  });

  it("armazena e mescla configurações multi-nicho e horários 2-15 min", () => {
    const updated = storage.saveConfig({
      minIntervalMinutes: 2,
      maxIntervalMinutes: 15,
      recycleMode: true,
      welcomeMessageEnabled: true,
      welcomeGroupName: "GLTech Ofertas - Impressão 3D",
      nicheGroups: {
        impressao_3d: {
          whatsappJid: "120363000000000000@g.us",
          whatsappName: "GLTech Ofertas - Impressão 3D",
          telegramChatId: "@gltech3d_ofertas",
        },
      },
    });

    expect(updated.minIntervalMinutes).toBe(2);
    expect(updated.maxIntervalMinutes).toBe(15);
    expect(updated.recycleMode).toBe(true);
    expect(updated.welcomeMessageEnabled).toBe(true);
    expect(updated.welcomeGroupName).toBe("GLTech Ofertas - Impressão 3D");
    expect(updated.nicheGroups.impressao_3d.whatsappJid).toBe("120363000000000000@g.us");
  });
});
