import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutosave } from "./useAutosave";

/**
 * O auto-save é o que segura a promessa de "não perde edição". As garantias
 * abaixo são as que quebram silenciosamente se alguém mexer no debounce.
 */
describe("useAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const ok = () => Promise.resolve({ ok: true });

  it("não grava antes de a janela do debounce fechar", async () => {
    const onSave = vi.fn(ok);
    const { result } = renderHook(() => useAutosave<{ name?: string }>({ onSave, delay: 800 }));

    act(() => result.current.queue({ name: "a" }));
    expect(result.current.status).toBe("dirty");

    await act(async () => { await vi.advanceTimersByTimeAsync(799); });
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("funde patches da mesma janela numa gravação só (não grava por tecla)", async () => {
    const onSave = vi.fn(ok);
    const { result } = renderHook(() => useAutosave<{ name?: string }>({ onSave, delay: 800 }));

    act(() => result.current.queue({ name: "L" }));
    act(() => result.current.queue({ name: "Lu" }));
    act(() => result.current.queue({ name: "Lum" }));

    await act(async () => { await vi.advanceTimersByTimeAsync(800); });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ name: "Lum" });
  });

  it("manda só os campos que sujaram, fundidos", async () => {
    const onSave = vi.fn(ok);
    const { result } = renderHook(() =>
      useAutosave<{ name?: string; stockQty?: number }>({ onSave, delay: 800 }),
    );

    act(() => result.current.queue({ name: "Vaso" }));
    act(() => result.current.queue({ stockQty: 3 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });

    expect(onSave).toHaveBeenCalledWith({ name: "Vaso", stockQty: 3 });
  });

  it("flush grava na hora, sem esperar o debounce", async () => {
    const onSave = vi.fn(ok);
    const { result } = renderHook(() => useAutosave<{ name?: string }>({ onSave, delay: 800 }));

    act(() => result.current.queue({ name: "x" }));
    await act(async () => { await result.current.flush(); });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("saved");
  });

  it("reenfileira o patch quando a gravação falha, em vez de perder a edição", async () => {
    const onSave = vi
      .fn<(p: { name?: string }) => Promise<{ ok: boolean; error?: string }>>()
      .mockResolvedValueOnce({ ok: false, error: "rede caiu" })
      .mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useAutosave<{ name?: string }>({ onSave, delay: 800 }));

    act(() => result.current.queue({ name: "importante" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("rede caiu");

    // A edição não sumiu: o retry reenvia o mesmo patch.
    await act(async () => { await result.current.flush(); });
    expect(onSave).toHaveBeenLastCalledWith({ name: "importante" });
    expect(result.current.status).toBe("saved");
  });

  it("continua 'dirty' se o usuário editar durante a gravação em voo", async () => {
    let resolveSave: (v: { ok: boolean }) => void = () => {};
    const onSave = vi.fn(
      () => new Promise<{ ok: boolean }>((res) => { resolveSave = res; }),
    );
    const { result } = renderHook(() => useAutosave<{ name?: string }>({ onSave, delay: 800 }));

    act(() => result.current.queue({ name: "a" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(result.current.status).toBe("saving");

    // Edita no meio do voo.
    act(() => result.current.queue({ name: "b" }));
    await act(async () => { resolveSave({ ok: true }); });

    // Não pode dizer "salvo": ainda há coisa pendente.
    expect(result.current.status).toBe("dirty");

    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(onSave).toHaveBeenLastCalledWith({ name: "b" });
  });
});
