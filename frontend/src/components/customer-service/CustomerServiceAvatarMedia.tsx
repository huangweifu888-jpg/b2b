import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { MEDIA_OPTIMIZATION_CONTRACT } from "@/lib/media-optimization-contract";

type CustomerServiceAvatarMediaKind = "image" | "video";

type CustomerServiceAvatarMediaProps = {
  sourceUrl?: string | null;
  sourceKind?: CustomerServiceAvatarMediaKind | null;
  fallbackUrl?: string | null;
  alt: string;
  className?: string;
  sourceStyle?: CSSProperties;
  fallbackStyle?: CSSProperties;
  loading?: "eager" | "lazy";
  fallback: ReactNode;
};

type AvatarMediaCandidate = {
  url: string;
  kind: CustomerServiceAvatarMediaKind;
  source: "saved" | "bundled-fallback";
};

const avatarFirstPaintContract = MEDIA_OPTIMIZATION_CONTRACT.delivery.avatarFirstPaint;

/**
 * Shared expert-avatar media renderer. A configured URL is only a candidate:
 * if the browser cannot decode its image/video, the renderer advances to the
 * expert's bundled portrait and finally to the caller's vector illustration.
 * This keeps every Product Market and customer-service projection non-empty.
 */
export function CustomerServiceAvatarMedia({
  sourceUrl,
  sourceKind = "image",
  fallbackUrl,
  alt,
  className = "h-full w-full object-cover",
  sourceStyle,
  fallbackStyle,
  loading = "lazy",
  fallback,
}: CustomerServiceAvatarMediaProps) {
  const normalizedSourceUrl = sourceUrl?.trim() || "";
  const normalizedFallbackUrl = fallbackUrl?.trim() || "";
  const normalizedSourceKind: CustomerServiceAvatarMediaKind = sourceKind === "video" ? "video" : "image";
  const signature = `${normalizedSourceKind}\u0000${normalizedSourceUrl}\u0000${normalizedFallbackUrl}`;
  const [loadState, setLoadState] = useState<{ signature: string; readyUrls: string[]; failedUrls: string[] }>({
    signature,
    readyUrls: [],
    failedUrls: [],
  });
  const readyUrls = loadState.signature === signature ? loadState.readyUrls : [];
  const failedUrls = loadState.signature === signature ? loadState.failedUrls : [];

  useEffect(() => {
    if (!normalizedSourceUrl || normalizedSourceKind !== "image" || normalizedSourceUrl === normalizedFallbackUrl) return;
    let active = true;
    const probe = new Image();
    const record = (result: "ready" | "failed") => {
      if (!active) return;
      setLoadState((current) => {
        const ready = current.signature === signature ? current.readyUrls : [];
        const failed = current.signature === signature ? current.failedUrls : [];
        if (result === "ready") {
          if (ready.includes(normalizedSourceUrl)) return current;
          return { signature, readyUrls: [...ready, normalizedSourceUrl], failedUrls: failed };
        }
        if (failed.includes(normalizedSourceUrl)) return current;
        return { signature, readyUrls: ready, failedUrls: [...failed, normalizedSourceUrl] };
      });
    };
    probe.onload = () => {
      if (probe.naturalWidth > 0 && probe.naturalHeight > 0) record("ready");
      else record("failed");
    };
    probe.onerror = () => record("failed");
    probe.src = normalizedSourceUrl;
    return () => {
      active = false;
      probe.onload = null;
      probe.onerror = null;
    };
  }, [normalizedFallbackUrl, normalizedSourceKind, normalizedSourceUrl, signature]);

  const candidates: AvatarMediaCandidate[] = [];
  if (
    normalizedSourceUrl
    && normalizedSourceUrl !== normalizedFallbackUrl
    && (normalizedSourceKind === "video" || readyUrls.includes(normalizedSourceUrl))
  ) {
    candidates.push({ url: normalizedSourceUrl, kind: normalizedSourceKind, source: "saved" });
  }
  if (normalizedFallbackUrl) {
    candidates.push({ url: normalizedFallbackUrl, kind: "image", source: "bundled-fallback" });
  }
  const candidate = candidates.find((item) => !failedUrls.includes(item.url));

  const rejectCandidate = () => {
    if (!candidate) return;
    setLoadState((current) => {
      const ready = current.signature === signature ? current.readyUrls : [];
      const failed = current.signature === signature ? current.failedUrls : [];
      if (failed.includes(candidate.url)) return current;
      return { signature, readyUrls: ready, failedUrls: [...failed, candidate.url] };
    });
  };

  if (!candidate) return <>{fallback}</>;

  const style = candidate.source === "saved" ? sourceStyle : fallbackStyle;
  if (candidate.kind === "video") {
    return (
      <video
        src={candidate.url}
        poster={normalizedFallbackUrl || undefined}
        aria-label={alt}
        data-customer-service-avatar-media-source={candidate.source}
        data-media-avatar-first-paint-policy={avatarFirstPaintContract.id}
        data-media-avatar-never-empty={String(avatarFirstPaintContract.neverEmpty)}
        className={className}
        style={style}
        onError={rejectCandidate}
        preload={MEDIA_OPTIMIZATION_CONTRACT.delivery.videoPreload}
        muted
        autoPlay
        loop
        playsInline={MEDIA_OPTIMIZATION_CONTRACT.delivery.videoPlaysInline}
      />
    );
  }

  return (
    <img
      src={candidate.url}
      alt={alt}
      data-customer-service-avatar-media-source={candidate.source}
      data-media-avatar-first-paint-policy={avatarFirstPaintContract.id}
      data-media-avatar-never-empty={String(avatarFirstPaintContract.neverEmpty)}
      className={className}
      style={style}
      loading={loading}
      decoding={MEDIA_OPTIMIZATION_CONTRACT.delivery.imageDecoding}
      onError={rejectCandidate}
    />
  );
}
