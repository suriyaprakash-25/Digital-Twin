import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAsync } from './useAsync';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('useAsync', () => {
  it('starts loading and resolves data', async () => {
    const loader = vi.fn().mockResolvedValue({ items: [1] });
    const { result } = renderHook(() => useAsync(loader, []));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ items: [1] });
    expect(result.current.error).toBeNull();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('exposes a readable error and recovers on refetch', async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce({ response: { status: 500, data: { success: false, message: 'Server down' } } })
      .mockResolvedValueOnce('ok');
    const { result } = renderHook(() => useAsync(loader, []));

    await waitFor(() => expect(result.current.error).toBe('Server down'));
    expect(result.current.loading).toBe(false);

    await act(async () => { await result.current.refetch(); });
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe('ok');
  });

  it('silent refetch keeps data on screen (no loading flicker)', async () => {
    const second = deferred();
    const loader = vi.fn().mockResolvedValueOnce('first').mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useAsync(loader, []));
    await waitFor(() => expect(result.current.data).toBe('first'));

    let pending;
    act(() => { pending = result.current.refetch({ silent: true }); });
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    expect(result.current.data).toBe('first');

    await act(async () => { second.resolve('second'); await pending; });
    expect(result.current.data).toBe('second');
    expect(result.current.refreshing).toBe(false);
  });

  it('a failed silent refresh keeps the last good data and no error', async () => {
    const loader = vi.fn().mockResolvedValueOnce('good').mockRejectedValueOnce(new Error('flaky'));
    const { result } = renderHook(() => useAsync(loader, []));
    await waitFor(() => expect(result.current.data).toBe('good'));

    await act(async () => { await result.current.refetch({ silent: true }); });
    expect(result.current.data).toBe('good');
    expect(result.current.error).toBeNull();
  });

  it('ignores responses from superseded calls', async () => {
    const slow = deferred();
    const fast = deferred();
    const loader = vi.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    const { result } = renderHook(() => useAsync(loader, [], { immediate: false }));

    let first;
    let second;
    act(() => { first = result.current.refetch(); });
    act(() => { second = result.current.refetch(); });
    await act(async () => { fast.resolve('newest'); await second; });
    await act(async () => { slow.resolve('stale'); await first; });

    expect(result.current.data).toBe('newest');
  });

  it('re-runs when deps change and supports local updates via setData', async () => {
    const loader = vi.fn((id) => Promise.resolve(`item-${id}`));
    const { result, rerender } = renderHook(({ id }) => useAsync(() => loader(id), [id]), { initialProps: { id: 1 } });
    await waitFor(() => expect(result.current.data).toBe('item-1'));

    rerender({ id: 2 });
    await waitFor(() => expect(result.current.data).toBe('item-2'));

    act(() => result.current.setData((prev) => `${prev}-edited`));
    expect(result.current.data).toBe('item-2-edited');
  });

  it('does not run on mount when immediate is false', async () => {
    const loader = vi.fn().mockResolvedValue(1);
    const { result } = renderHook(() => useAsync(loader, [], { immediate: false }));
    await Promise.resolve();
    expect(loader).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});
