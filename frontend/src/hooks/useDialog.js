import { useEffect, useId, useRef } from 'react';
import { useEscapeKey } from './useEscapeKey';

/**
 * Accessibility wiring for a modal dialog.
 *
 *   const { dialogProps, titleId } = useDialog({ isOpen, onClose });
 *   <div {...dialogProps}> <h2 id={titleId}>Title</h2> ... </div>
 *
 * Adds role="dialog", aria-modal and aria-labelledby, closes on Escape, moves focus
 * into the dialog when it opens and restores it to the trigger when it closes.
 */
export function useDialog({ isOpen = true, onClose } = {}) {
  const titleId = useId();
  const dialogRef = useRef(null);
  useEscapeKey(onClose, Boolean(isOpen && onClose));

  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = typeof document !== 'undefined' ? document.activeElement : null;
    const node = dialogRef.current;
    if (node && !node.contains(document.activeElement)) node.focus({ preventScroll: true });
    return () => {
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  return {
    titleId,
    dialogRef,
    dialogProps: {
      ref: dialogRef,
      role: 'dialog',
      'aria-modal': true,
      'aria-labelledby': titleId,
      tabIndex: -1,
    },
  };
}

export default useDialog;
