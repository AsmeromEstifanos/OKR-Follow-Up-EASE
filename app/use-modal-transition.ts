"use client";

import { useCallback, useState } from "react";

/**
 * Drives enter/exit animations for modals that are conditionally mounted by a
 * parent (React removes them instantly on close, so a CSS exit needs the close
 * to be intercepted). Route every close trigger (button, overlay, Escape)
 * through `requestClose`: it flips `closing` true so the exit animation plays,
 * then calls the real `onClose` after `duration` ms to unmount.
 *
 * Use `state` ("open" | "closing") as a data attribute / class to drive the CSS.
 */
export function useModalTransition(
  onClose: () => void,
  duration = 180
): { state: "open" | "closing"; closing: boolean; requestClose: () => void } {
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    setClosing((already) => {
      if (already) return already;
      window.setTimeout(onClose, duration);
      return true;
    });
  }, [onClose, duration]);

  return { state: closing ? "closing" : "open", closing, requestClose };
}
