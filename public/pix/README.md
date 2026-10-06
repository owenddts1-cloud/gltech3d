# QR Code e copia-e-cola do Pix

- `calc3d-pro-qr.jpeg` — QR Code estático, gerado no app do banco.
- O texto do **copia e cola** fica em `NEXT_PUBLIC_PIX_COPIA_E_COLA` (`.env.local` e Vercel).
- O caminho da imagem está em `lib/pix/config.ts` (`PIX_QR_SRC`).

Os dois têm o **valor gravado dentro** (hoje R$ 89,00). Ao trocar o preço em
`lib/pricing/pro-plans.ts`, regere **os dois** no app do banco.

Proteção: a página confere o valor do copia-e-cola contra o preço do plano e **esconde
o código** se não bater (`lib/pix/brcode.ts`). O QR não tem essa checagem — é imagem, não
dá para ler o valor dela. Então ao mudar o preço, troque também o arquivo.

Se a imagem não existir, ela some sozinha da página; a chave e o copia-e-cola continuam.
