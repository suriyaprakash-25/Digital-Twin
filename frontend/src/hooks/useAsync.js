import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../utils/api';

/**
 * Runs an async loader and tracks `{ data, error, loading, refreshing }`.
 *
 * - `loading` is true while a foreground load runs (first load, retry).
 * - `refetch({ silent: true })` sets `refreshing` instead and keeps the current data
 *   on screen, so polling never flickers; a failed silent refresh keeps the last
 *   good data and does not replace it with an error.
 * - Responses from superseded calls, or arriving after unmount, are ignored.
 * - `deps` re-run the loader; pass `immediate: false` to only run on demand.
 */
export function useAsync(loader, deps = [], { immediate = true, initialData = null, onError } = {}) {
  const [state, setState] = useState({ data: initialData, error: null, loading: immediate, refreshing: false });
  const loaderRef = useRef(loader);
  const onErrorRef = useRef(onError);
  const hasDataRef = useRef(false);
  const callIdRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    loaderRef.current = loader;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const run = useCallback(async ({ silent = false } = {}) => {
    const callId = ++callIdRef.current;
    const isCurrent = () => mountedRef.current && callId === callIdRef.current;
    const background = silent && hasDataRef.current;
    setState((prev) => (background
      ? { ...prev, refreshing: true }
      : { ...prev, loading: true, error: null }));
    try {
      const data = await loaderRef.current();
      if (isCurrent()) {
        hasDataRef.current = true;
        setState({ data, error: null, loading: false, refreshing: false });
      }
      return data;
    } catch (err) {
      const message = getErrorMessage(err);
      if (isCurrent()) {
        setState((prev) => ({
          ...prev,
          error: background ? prev.error : message,
          loading: false,
          refreshing: false,
        }));
        onErrorRef.current?.(err, message);
      }
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!immediate) return undefined;
    // Defer to a microtask so the effect body itself never sets state synchronously.
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) run(); });
    return () => { cancelled = true; };
    // `deps` is the caller's dependency list for the loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater) => {
    setState((prev) => ({ ...prev, data: typeof updater === 'function' ? updater(prev.data) : updater }));
  }, []);

  return { ...state, refetch: run, setData };
}

/** Alias that reads better at call sites: `useApiQuery(() => apiGet('/x'), [id])`. */
export const useApiQuery = useAsync;

export default useAsync;
