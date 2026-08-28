import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";

import { schedulePostPaintIdle } from "@/lib/post-paint-lazy";

export type DeferredViewportMediaGroupProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: (mediaEnabled: boolean) => ReactNode;
  rootMargin?: string;
};

/**
 * Keep a group's semantic DOM mounted while delaying its optional media URLs
 * until the group is close to the visible viewport. This is intentionally
 * narrower than native loading="lazy", whose preload window can still fetch
 * every image on a long configuration page during the initial visit.
 */
export default function DeferredViewportMediaGroup({
  children,
  rootMargin = "120px 0px",
  ...hostProps
}: DeferredViewportMediaGroupProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mediaEnabled, setMediaEnabled] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!("IntersectionObserver" in window)) {
      return schedulePostPaintIdle(() => setMediaEnabled(true));
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setMediaEnabled(true);
      observer.disconnect();
    }, { rootMargin });
    observer.observe(host);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div
      {...hostProps}
      ref={hostRef}
      data-deferred-viewport-media={mediaEnabled ? "enabled" : "pending"}
    >
      {children(mediaEnabled)}
    </div>
  );
}
