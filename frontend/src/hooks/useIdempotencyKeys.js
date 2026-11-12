import { useCallback, useMemo, useRef } from 'react';
import { createIdempotencyKey } from '../utils/api';

/**
 * True when the same request may be retried with the SAME idempotency key:
 * network failures, 5xx, and 409 IDEMPOTENCY_IN_PROGRESS. Any other response is
 * a terminal outcome and the next attempt must use a fresh key.
 */
export function isRetryableError(error) {
  const status = error?.response?.status;
  if (!status) return true;
  if (status >= 500) return true;
  return status === 409 && error?.response?.data?.code === 'IDEMPOTENCY_IN_PROGRESS';
}

/**
 * One stable Idempotency-Key per user action (scope), e.g. `approve:${settlementId}`.
 *
 *   const keys = useIdempotencyKeys();
 *   const key = keys.keyFor(`approve:${id}`);
 *   try { await apiPost(url, body, { headers: idempotencyHeaders(key) }); keys.release(scope); }
 *   catch (err) { keys.settle(scope, err); }
 */
export function useIdempotencyKeys() {
  const keysRef = useRef(new Map());

  const keyFor = useCallback((scope = 'default') => {
    const map = keysRef.current;
    if (!map.has(scope)) map.set(scope, createIdempotencyKey());
    return map.get(scope);
  }, []);

  const release = useCallback((scope = 'default') => {
    keysRef.current.delete(scope);
  }, []);

  /** After a failure: keep the key only if the same request may be retried. */
  const settle = useCallback((scope, error) => {
    if (!isRetryableError(error)) keysRef.current.delete(scope);
  }, []);

  return useMemo(() => ({ keyFor, release, settle }), [keyFor, release, settle]);
}

export default useIdempotencyKeys;
