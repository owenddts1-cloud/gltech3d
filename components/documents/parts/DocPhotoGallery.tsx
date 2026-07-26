import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";

const CIRCLE_NUMBERS = ["❶", "❷", "❸", "❹", "❺", "❻", "❼", "❽", "❾", "❿"];

export function DocPhotoGallery({ snapshot }: { snapshot: DocumentSnapshot }) {
  const { items, options } = snapshot;
  const mode = options.photoDisplayMode ?? "table";

  // Só exibe a galeria do rodapé se o modo for "gallery" ou "both"
  if (mode !== "gallery" && mode !== "both") return null;

  const itemsWithPhotos = items.filter((item) => item.imageUrl && item.imageUrl.trim().length > 0);
  if (itemsWithPhotos.length === 0) return null;

  return (
    <div className="doc-gallery-wrap">
      <div className="doc-gallery-title">Galeria Visual de Itens e Produção</div>
      <div className="doc-gallery-grid">
        {itemsWithPhotos.map((item, idx) => {
          const itemIndex = items.findIndex((i) => i === item);
          const badge = CIRCLE_NUMBERS[itemIndex] || `(${itemIndex + 1})`;
          return (
            <div key={`${item.name}-${idx}`} className="doc-gallery-card">
              <div className="doc-gallery-image-box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl!} alt={item.name} className="doc-gallery-img" />
                <span className="doc-gallery-badge">{badge}</span>
              </div>
              <p className="doc-gallery-name">{item.name}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
