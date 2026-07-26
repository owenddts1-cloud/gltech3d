/**
 * Automatic client-side image background removal utility.
 * Attempts AI background removal using `@imgly/background-removal` when available,
 * and falls back to a high-precision HTML5 Canvas color-distance cutout algorithm.
 */

export async function removeBackgroundAuto(imageSource: File | Blob | string): Promise<string> {
  // 1. Try @imgly/background-removal AI model
  try {
    const pkg = "@imgly/background-removal";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgly: any = await import(pkg);
    const removeBgFn = imgly.default || imgly.removeBackground;
    if (typeof removeBgFn === "function") {
      const blob = await removeBgFn(imageSource);
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn("[BackgroundRemoval] AI module skipped or failed, using Canvas algorithm:", err);
  }

  // 2. Client-side canvas chroma-key / corner sampling background removal fallback
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    let objectUrlToRevoke: string | null = null;
    if (typeof imageSource === "string") {
      img.src = imageSource;
    } else {
      objectUrlToRevoke = URL.createObjectURL(imageSource);
      img.src = objectUrlToRevoke;
    }

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const width = img.naturalWidth || img.width || 400;
        const height = img.naturalHeight || img.height || 400;
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(img.src);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Sample top-left corner color as primary background reference
        const bgR = data[0] ?? 255;
        const bgG = data[1] ?? 255;
        const bgB = data[2] ?? 255;

        // Color distance threshold
        const threshold = 38;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 255;
          const g = data[i + 1] ?? 255;
          const b = data[i + 2] ?? 255;

          // Distance from corner color
          const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
          
          // Also check for pure white / near-white studio backgrounds
          const isWhiteBg = r > 240 && g > 240 && b > 240;

          if (dist < threshold || isWhiteBg) {
            data[i + 3] = 0; // Transparent
          }
        }

        ctx.putImageData(imgData, 0, 0);

        canvas.toBlob((blob) => {
          if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            resolve(canvas.toDataURL("image/png"));
          }
        }, "image/png");
      } catch (e) {
        console.error("[BackgroundRemoval] Canvas processing error:", e);
        resolve(img.src);
      }
    };

    img.onerror = () => {
      resolve(typeof imageSource === "string" ? imageSource : URL.createObjectURL(imageSource));
    };
  });
}
