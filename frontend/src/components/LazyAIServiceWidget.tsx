import { lazy, Suspense, useEffect, useState } from "react";

const AIServiceWidget = lazy(() => import("./AIServiceWidget"));

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const INITIAL_WIDGET_DELAY_MS = 2400;

/**
 * Keep the floating customer-service widget out of every layout's initial chunk.
 * It mounts after the shell has painted, while preserving the existing widget API.
 */
export default function LazyAIServiceWidget() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idleWindow = window as IdleWindow;
    let idleHandle: number | null = null;
    const delayHandle = window.setTimeout(() => {
      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(() => setReady(true), { timeout: 2500 });
        return;
      }
      setReady(true);
    }, INITIAL_WIDGET_DELAY_MS);
    return () => {
      window.clearTimeout(delayHandle);
      if (idleHandle !== null) idleWindow.cancelIdleCallback?.(idleHandle);
    };
  }, []);

  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <AIServiceWidget />
    </Suspense>
  );
}
