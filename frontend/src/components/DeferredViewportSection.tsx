import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";

import { schedulePostPaintIdle } from "@/lib/post-paint-lazy";

export function DeferredViewportSection({
  children,
  label,
  minHeight = 72,
  rootMargin = "240px 0px",
}: {
  children: ReactNode;
  label: string;
  minHeight?: number;
  rootMargin?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const host = hostRef.current;
    if (!host) return;
    if (!("IntersectionObserver" in window)) {
      return schedulePostPaintIdle(() => setVisible(true));
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setVisible(true);
      observer.disconnect();
    }, { rootMargin });
    observer.observe(host);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  const fallback = (
    <div
      data-deferred-viewport-placeholder={label}
      aria-busy="true"
      aria-label={`${label}按需加载中`}
      className="mx-3 my-3 rounded-lg border border-dashed border-current/20 bg-current/[0.02]"
      style={{ minHeight }}
    />
  );

  return (
    <div ref={hostRef} data-deferred-viewport-section={label}>
      {visible ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  );
}
