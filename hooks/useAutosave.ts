'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Auto-save no padrão que Linear/Notion/Figma usam — e que NÃO é "gravar a cada
 * tecla":
 *
 *  1. Otimista: quem chama já atualizou o estado local; a UI nunca espera a rede.
 *  2. Debounce: patches dentro da janela se fundem numa gravação só.
 *  3. Patch parcial: vai só o campo que sujou, não o objeto inteiro.
 *  4. Flush no blur/unmount/fechar aba: a última edição não se perde.
 *  5. Coalescência: editar durante uma gravação em voo enfileira o próximo
 *     patch em vez de disparar requisições concorrentes fora de ordem.
 *  6. Status observável, para a tela dizer "salvando" / "salvo" / "erro".
 */

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions<TPatch> {
  /** Persiste o patch. Deve rejeitar (ou devolver ok:false) em falha. */
  onSave: (patch: TPatch) => Promise<{ ok: boolean; error?: string }>;
  /** Janela do debounce. 800ms: rápido o bastante pra parecer instantâneo,
   *  longo o bastante pra não gravar cada tecla nem poluir o audit log. */
  delay?: number;
}

interface UseAutosaveResult<TPatch> {
  status: SaveStatus;
  error: string | null;
  lastSavedAt: Date | null;
  /** Enfileira um patch parcial. Chame a cada alteração de campo. */
  queue: (patch: TPatch) => void;
  /** Grava agora o que estiver pendente (ex.: onBlur). */
  flush: () => Promise<void>;
}

export function useAutosave<TPatch extends object>({
  onSave,
  delay = 800,
}: UseAutosaveOptions<TPatch>): UseAutosaveResult<TPatch> {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const pending = useRef<Partial<TPatch>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  // Ref para o onSave: se ele mudar de identidade a cada render (arrow inline),
  // não queremos recriar `queue`/`flush` nem reagendar o timer.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const send = useCallback(async () => {
    if (inFlight.current) return; // o próximo ciclo pega o que ficou pendente
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;

    pending.current = {};
    inFlight.current = true;
    if (mounted.current) setStatus('saving');

    try {
      const result = await onSaveRef.current(patch as TPatch);
      if (!result.ok) throw new Error(result.error ?? 'Falha ao salvar');

      if (mounted.current) {
        setError(null);
        setLastSavedAt(new Date());
        // Sujou de novo durante a gravação? Continua sujo, não "salvo".
        setStatus(Object.keys(pending.current).length > 0 ? 'dirty' : 'saved');
      }
    } catch (e) {
      // Devolve o patch pra fila: um flush/retry posterior reaproveita a edição
      // em vez de descartá-la silenciosamente.
      pending.current = { ...patch, ...pending.current };
      if (mounted.current) {
        setError(e instanceof Error ? e.message : 'Falha ao salvar');
        setStatus('error');
      }
    } finally {
      inFlight.current = false;
      if (mounted.current && Object.keys(pending.current).length > 0) {
        timer.current = setTimeout(() => void send(), delay);
      }
    }
  }, [delay]);

  const queue = useCallback(
    (patch: TPatch) => {
      pending.current = { ...pending.current, ...patch };
      setStatus('dirty');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void send(), delay);
    },
    [delay, send],
  );

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await send();
  }, [send]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      // Última tentativa ao desmontar. Não dá pra aguardar aqui, mas a Server
      // Action já saiu — o navegador a completa.
      if (Object.keys(pending.current).length > 0 && !inFlight.current) {
        void onSaveRef.current(pending.current as TPatch).catch(() => {
          // Sem UI pra mostrar erro depois do unmount; o Sentry pega no server.
        });
      }
    };
  }, []);

  // Avisa antes de fechar a aba com edição pendente.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (Object.keys(pending.current).length === 0 && !inFlight.current) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return { status, error, lastSavedAt, queue, flush };
}
