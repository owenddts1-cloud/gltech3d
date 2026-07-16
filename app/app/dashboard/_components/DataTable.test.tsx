import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DataTable, { type Column } from "./DataTable";

/**
 * Filtro e ordenação por coluna são o requisito central da tabela. Um sort que
 * ordena número como texto ("100" < "20") não quebra a tela — só mostra a ordem
 * errada com cara de certa.
 */
interface Row {
  id: string;
  cliente: string;
  valor: number;
}

const ROWS: Row[] = [
  { id: "1", cliente: "Carla", valor: 100 },
  { id: "2", cliente: "Ana", valor: 20 },
  { id: "3", cliente: "Bruno", valor: 300 },
];

const COLUMNS: Column<Row>[] = [
  { key: "cliente", header: "Cliente", value: (r) => r.cliente },
  { key: "valor", header: "Valor", value: (r) => r.valor, align: "right" },
];

/** Nomes na ordem em que aparecem no corpo da tabela. */
function clientOrder(): string[] {
  const rows = screen.getAllByRole("row").slice(1); // pula o cabeçalho
  return rows.map((r) => within(r).getAllByRole("cell")[0]?.textContent ?? "");
}

/** Uma instância de userEvent por teste: reusar o mesmo `user` mantém o estado
 *  do ponteiro coerente entre aberturas sucessivas do popover. */
async function openFilter(user: ReturnType<typeof userEvent.setup>, header: string) {
  await user.click(screen.getByRole("button", { name: `Filtrar e ordenar por ${header}` }));
}

describe("DataTable", () => {
  it("mostra as linhas na ordem recebida quando não há ordenação", () => {
    render(<DataTable rows={ROWS} columns={COLUMNS} empty="vazio" />);
    expect(clientOrder()).toEqual(["Carla", "Ana", "Bruno"]);
  });

  it("ordena texto de forma crescente e decrescente", async () => {
    render(<DataTable rows={ROWS} columns={COLUMNS} empty="vazio" />);

    const user = userEvent.setup();
    await openFilter(user, "Cliente");
    await user.click(screen.getByRole("button", { name: /Crescente/ }));
    expect(clientOrder()).toEqual(["Ana", "Bruno", "Carla"]);

    await user.keyboard("{Escape}");
    await openFilter(user, "Cliente");
    await user.click(screen.getByRole("button", { name: /Decrescente/ }));
    expect(clientOrder()).toEqual(["Carla", "Bruno", "Ana"]);
  });

  it("ordena número como número, não como texto", async () => {
    render(<DataTable rows={ROWS} columns={COLUMNS} empty="vazio" />);

    const user = userEvent.setup();
    await openFilter(user, "Valor");
    await user.click(screen.getByRole("button", { name: /Menor para maior/ }));
    // Como texto seria "100" < "20" < "300". Como número: 20, 100, 300.
    expect(clientOrder()).toEqual(["Ana", "Carla", "Bruno"]);

    await user.keyboard("{Escape}");
    await openFilter(user, "Valor");
    await user.click(screen.getByRole("button", { name: /Maior para menor/ }));
    expect(clientOrder()).toEqual(["Bruno", "Carla", "Ana"]);
  });

  it("filtra por termo dentro da coluna", async () => {
    render(<DataTable rows={ROWS} columns={COLUMNS} empty="vazio" />);

    const user = userEvent.setup();
    await openFilter(user, "Cliente");
    await user.type(screen.getByPlaceholderText(/Buscar em cliente/i), "an");

    // "Ana" e "Bruno" não: só "Ana" contém "an". Case-insensitive.
    expect(clientOrder()).toEqual(["Ana"]);
    expect(screen.getByText("1 de 3")).toBeInTheDocument();
  });

  it("limpar filtros devolve todas as linhas", async () => {
    render(<DataTable rows={ROWS} columns={COLUMNS} empty="vazio" />);

    const user = userEvent.setup();
    await openFilter(user, "Cliente");
    await user.type(screen.getByPlaceholderText(/Buscar em cliente/i), "zzz");
    await user.keyboard("{Escape}");
    expect(screen.getByText(/Nada bate com esses filtros/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Limpar filtros/ }));
    expect(clientOrder()).toEqual(["Carla", "Ana", "Bruno"]);
  });

  it("mostra a mensagem de vazio quando não há dado nenhum", () => {
    render(<DataTable rows={[]} columns={COLUMNS} empty="Nenhuma venda no período." />);
    expect(screen.getByText("Nenhuma venda no período.")).toBeInTheDocument();
  });
});
