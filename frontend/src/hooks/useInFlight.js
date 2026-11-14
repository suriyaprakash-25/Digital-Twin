import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Guards an async action against double submission. `run(...args)` is a no-op
 * while a previous call is still pending; `pending` drives disabled/spinner UI.
 */
export function useInFlight(action) {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const actionRef = useRef(action);

  useEffect(() => {
    actionRef.current = action;
  });

  const run = useCallback(async (...args) => {
    if (pendingRef.current) return undefined;
    pendingRef.current = true;
    setPending(true);
    try {
      return await actionRef.current(...args);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, []);

  return [run, pending];
}

export default useInFlight;
