/**
 * Email template sent to newsletter subscribers when a new Instagram post is made.
 */
export interface InstagramPostOptions {
  postUrl: string;
  imageUrl?: string | null;
  caption: string;
}

export function buildInstagramPostEmail(opts: InstagramPostOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Novidade da GLTech3D no Instagram! 📸🚀";

  // Clean the caption to show first lines or full caption
  const shortCaption = opts.caption.length > 300 
    ? opts.caption.slice(0, 300) + "..." 
    : opts.caption;

  const imageTag = opts.imageUrl 
    ? `<div style="margin:20px 0;text-align:center;">
        <a href="${opts.postUrl}" target="_blank">
          <img src="${opts.imageUrl}" alt="Nova postagem no Instagram" style="max-width:100%;height:auto;border-radius:12px;border:1px solid #e8e2d9;box-shadow:0 4px 12px rgba(166,129,92,0.1);" />
        </a>
       </div>`
    : "";

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f9f7f2;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#2d241e">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <!-- Header -->
    <div style="display:inline-block;width:40px;height:40px;background:#a6815c;border-radius:10px;text-align:center;line-height:40px;color:#fff;font-weight:700;font-size:18px">G</div>
    
    <h1 style="font-size:22px;line-height:1.3;margin:20px 0 12px;color:#2d241e">Acabou de sair no Instagram! 📸</h1>
    
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f342c">
      Olá! Acabamos de postar uma novidade quentinha no nosso perfil. Veja os bastidores da produção, novos modelos e o andamento dos nossos lançamentos.
    </p>

    <!-- Post Preview Box -->
    <div style="background:#ffffff;border:1px solid #e8e2d9;border-radius:16px;padding:24px;margin:24px 0">
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#2d241e;font-style:italic">
        "${escapeHtml(shortCaption)}"
      </p>

      ${imageTag}

      <div style="text-align:center;margin-top:20px">
        <a href="${opts.postUrl}" target="_blank" style="display:inline-block;padding:12px 24px;background:#a6815c;color:#ffffff;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">
          Ver postagem completa
        </a>
      </div>
    </div>

    <!-- Instagram CTA -->
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f342c">
      Siga a gente no Instagram para não perder nenhuma impressão 3D incrível!
    </p>

    <!-- Footer -->
    <div style="margin:32px 0 0;border-top:1px solid #e8e2d9;padding-top:20px">
      <p style="margin:0;font-size:12px;color:#a79a8c;line-height:1.4">
        GLTech3D · Impressão 3D de alta precisão feita no Brasil<br>
        @gltech3d · <a href="https://instagram.com/gltech3d" style="color:#a6815c;text-decoration:none">Instagram</a><br><br>
        Você está recebendo este e-mail porque se inscreveu em nossa lista de novidades. Se não desejar mais recebê-los, pode cancelar a inscrição a qualquer momento.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = [
    "Acabou de sair no Instagram da GLTech3D! 📸🚀",
    "",
    "Olá! Acabamos de publicar uma nova atualização nos nossos canais:",
    "",
    `"${opts.caption}"`,
    "",
    `Confira o post completo em: ${opts.postUrl}`,
    "",
    "GLTech3D · Impressão 3D de alta precisão feita no Brasil · @gltech3d",
  ].join("\n");

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
