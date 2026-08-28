import { useEffect, useState } from "react";

export function schedulePostPaintIdle(callback: () => void, timeout = 600) {
  let timer = 0;
  let idleHandle = 0;
  let frame = window.requestAnimationFrame(() => {
    frame = 0;
    const idleWindow = window as Window & typeof globalThis & {
      requestIdleCallback?: (task: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(callback, { timeout });
    } else {
      timer = window.setTimeout(callback, 80);
    }
  });
  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    if (timer) window.clearTimeout(timer);
    if (idleHandle) {
      const idleWindow = window as Window & typeof globalThis & { cancelIdleCallback?: (handle: number) => void };
      idleWindow.cancelIdleCallback?.(idleHandle);
    }
  };
}

/**
 * Keeps non-critical UI out of the first render and first paint. The callback
 * is still bounded by `timeout`, so controls become available even when the
 * browser never reports a fully idle window.
 */
export function usePostPaintReady(timeout = 600) {
  const [ready, setReady] = useState(false);

  useEffect(() => schedulePostPaintIdle(() => setReady(true), timeout), [timeout]);

  return ready;
}
