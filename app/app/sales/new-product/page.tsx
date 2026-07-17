import { redirect } from "next/navigation";

// Cadastro de produto já existe em /app/products (catálogo real com custo 3D).
// Esta rota antiga vira atalho para lá.
export default function NewProductRedirect() {
  redirect("/app/products");
}
