import { useCallback, useEffect, useRef, useState } from "react";
import { apiError } from "../api/client";

interface ApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * GET genérico con estados loading / error / refetch.
 * `fn` debe devolver una promesa (normalmente api.get(...).then(r => r.data)).
 * `deps` controla cuándo se vuelve a pedir (igual que useEffect).
 */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []): ApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err) => {
        if (alive) setError(apiError(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refetch };
}
