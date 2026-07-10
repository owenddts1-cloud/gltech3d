/**
 * Welcome email sent to new newsletter subscribers. Plain inline-styled HTML.
 */
export interface NewsletterWelcomeOptions {
  email: string;
}

export function buildNewsletterWelcomeEmail(opts: NewsletterWelcomeOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Você está na lista da GLTech3D! 📬🚀";

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
    
    <h1 style="font-size:22px;line-height:1.3;margin:20px 0 12px;color:#2d241e">Inscrição Confirmada! 🎉</h1>
    
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f342c">
      Olá! Que ótimo ter você na lista de novidades da <strong>GLTech3D</strong>. 
      A partir de agora, você receberá em primeira mão nossos lançamentos, promoções exclusivas e atualizações sobre novos projetos e impressões 3D premium.
    </p>

    <!-- O que há de novo -->
    <div style="background:#ffffff;border:1px solid #e8e2d9;border-radius:16px;padding:20px;margin:24px 0">
      <h3 style="margin:0 0 10px;font-size:16px;color:#2d241e;font-weight:700">🚀 O que está rolando na GLTech3D:</h3>
      <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.6;color:#6b5e55">
        <li style="margin-bottom:8px">Novos filamentos com acabamentos foscos e metálicos ultra-realistas.</li>
        <li style="margin-bottom:8px">Expansão de nossa capacidade produtiva para peças de engenharia e prototipagem rápida.</li>
        <li style="margin-bottom:8px">Mais designs incríveis e modelagens exclusivas sendo testadas diariamente.</li>
      </ul>
    </div>

    <!-- Instagram CTA -->
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f342c">
      Acompanhe nossos bastidores e veja os vídeos do nosso foguete e outras impressões incríveis no nosso Instagram:
    </p>
    <p style="margin:16px 0">
      <a href="https://instagram.com/gltech3d" style="display:inline-block;padding:12px 24px;background:#a6815c;color:#ffffff;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">
        Siga @gltech3d no Instagram
      </a>
    </p>

    <!-- Onde nos encontrar -->
    <div style="margin:32px 0 24px;border-top:1px solid #e8e2d9;padding-top:20px">
      <h4 style="margin:0 0 12px;font-size:13px;color:#8e6d4d;text-transform:uppercase;letter-spacing:0.05em">Nossos perfis nas plataformas 3D:</h4>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#6b5e55">
        Também compartilhamos e baixamos designs oficiais nas principais comunidades do mundo. Encontre-nos em:
      </p>
      <div style="margin-top:12px">
        <a href="https://www.printables.com" style="margin-right:15px;color:#a6815c;text-decoration:none;font-weight:600;font-size:13px">Printables</a>
        <a href="https://www.thingiverse.com" style="margin-right:15px;color:#a6815c;text-decoration:none;font-weight:600;font-size:13px">Thingiverse</a>
        <a href="https://cults3d.com" style="color:#a6815c;text-decoration:none;font-weight:600;font-size:13px">Cults3D</a>
      </div>
    </div>

    <!-- Footer -->
    <p style="margin:32px 0 0;font-size:12px;color:#a79a8c;line-height:1.4">
      GLTech3D · Impressão 3D de alta precisão feita no Brasil<br>
      Este e-mail foi enviado para ${escapeHtml(opts.email)}. Se não desejar mais receber nossos e-mails, você pode cancelar a inscrição a qualquer momento.
    </p>
  </div>
</body>
</html>`;

  const text = [
    "Você está na lista da GLTech3D! 📬🚀",
    "",
    "Olá! Que ótimo ter você na lista de novidades da GLTech3D. A partir de agora, você receberá em primeira mão nossos lançamentos, promoções exclusivas e atualizações sobre novos projetos e impressões 3D premium.",
    "",
    "🚀 O que está rolando na GLTech3D:",
    "- Novos filamentos com acabamentos foscos e metálicos ultra-realistas.",
    "- Expansão de nossa capacidade produtiva para peças de engenharia e prototipagem rápida.",
    "- Mais designs incríveis e modelagens exclusivas sendo testadas diariamente.",
    "",
    "Acompanhe nossos bastidores e veja os vídeos do nosso foguete e outras impressões incríveis no nosso Instagram: https://instagram.com/gltech3d",
    "",
    "Nossos perfis nas plataformas 3D:",
    "- Printables: https://www.printables.com",
    "- Thingiverse: https://www.thingiverse.com",
    "- Cults3D: https://cults3d.com",
    "",
    "GLTech3D · Impressão 3D de alta precisão feita no Brasil",
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
