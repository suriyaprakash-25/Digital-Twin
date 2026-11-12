import { useCallback, useRef, useState } from 'react';
import { useToast } from '../../context/toastContextCore';
import { useIdempotencyKeys } from '../../hooks/useIdempotencyKeys';
import { getErrorMessage, idempotencyHeaders, isIdempotencyInProgress } from '../../utils/api';

/**
 * Runs a financial mutation (approve / reject / payout / refund ...) with:
 * - one stable Idempotency-Key per action scope, reused only when the same
 *   request is retried after a retryable failure;
 * - an in-flight guard so a second click is ignored while a request is pending;
 * - consistent error toasts (409 IDEMPOTENCY_IN_PROGRESS is "already processing").
 *
 *   const { run, isPending, busy } = useFinancialAction();
 *   const data = await run(`approve:${id}`, (config) => apiPost(url, body, config), 'Error approving');
 *
 * `request` receives `{ headers: { 'Idempotency-Key': key } }` to pass as the request config.
 * Resolves with the response data, or `undefined` when the request failed or was skipped.
 */
export function useFinancialAction() {
  const { keyFor, release, settle } = useIdempotencyKeys();
  const { showError, showWarning } = useToast();
  const [pendingScope, setPendingScope] = useState(null);
  const pendingRef = useRef(null);

  const run = useCallback(async (scope, request, errorMessage = 'Action failed. Please try again.') => {
    if (pendingRef.current) return undefined;
    pendingRef.current = scope;
    setPendingScope(scope);
    try {
      const data = await request({ headers: idempotencyHeaders(keyFor(scope)) });
      release(scope);
      return data;
    } catch (err) {
      settle(scope, err);
      if (isIdempotencyInProgress(err)) {
        showWarning('This action is already being processed. Refresh in a moment to see the result.');
      } else {
        showError(getErrorMessage(err, errorMessage));
      }
      return undefined;
    } finally {
      pendingRef.current = null;
      setPendingScope(null);
    }
  }, [keyFor, release, settle, showError, showWarning]);

  const isPending = useCallback((scope) => pendingScope === scope, [pendingScope]);

  return { run, isPending, pendingScope, busy: pendingScope !== null };
}

export default useFinancialAction;
