import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

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
const bundledFallbackResolvedUrlCache = new Map<string, string>();
const bundledFallbackLoadPromises = new Map<string, Promise<string | null>>();
const bundledFallbackCacheBypassUrls = new Set<string>();

async function createDecodedBundledFallbackUrl(blob: Blob) {
  const resolvedUrl = URL.createObjectURL(blob);
  try {
    const probe = new Image();
    probe.src = resolvedUrl;
    await probe.decode();
    if (probe.naturalWidth <= 0 || probe.naturalHeight <= 0) {
      throw new Error("Bundled avatar decoded without image dimensions");
    }
    return resolvedUrl;
  } catch (error) {
    URL.revokeObjectURL(resolvedUrl);
    throw error;
  }
}

function loadBundledFallbackOnce(url: string) {
  const cached = bundledFallbackResolvedUrlCache.get(url);
  if (cached) return Promise.resolve(cached);
  const existing = bundledFallbackLoadPromises.get(url);
  if (existing) return existing;
  const pending = fetch(url, { cache: bundledFallbackCacheBypassUrls.has(url) ? "reload" : "force-cache" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Unable to load bundled avatar: ${response.status}`);
      const resolvedUrl = await createDecodedBundledFallbackUrl(await response.blob());
      bundledFallbackResolvedUrlCache.set(url, resolvedUrl);
      bundledFallbackCacheBypassUrls.delete(url);
      return resolvedUrl;
    })
    .catch(() => {
      bundledFallbackCacheBypassUrls.add(url);
      return null;
    })
    .finally(() => {
      if (bundledFallbackLoadPromises.get(url) === pending) bundledFallbackLoadPromises.delete(url);
    });
  bundledFallbackLoadPromises.set(url, pending);
  return pending;
}

function loadBundledFallbackForMountedAttempt(url: string) {
  const joinedExistingAttempt = bundledFallbackLoadPromises.has(url);
  return loadBundledFallbackOnce(url).then((resolvedUrl) => {
    if (resolvedUrl || !joinedExistingAttempt || !bundledFallbackCacheBypassUrls.has(url)) {
      return resolvedUrl;
    }
    return loadBundledFallbackOnce(url);
  });
}

function evictBrokenBundledFallback(sourceUrl: string, resolvedUrl: string) {
  if (bundledFallbackResolvedUrlCache.get(sourceUrl) !== resolvedUrl) return;
  bundledFallbackResolvedUrlCache.delete(sourceUrl);
  URL.revokeObjectURL(resolvedUrl);
}

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
  const [fallbackLoadState, setFallbackLoadState] = useState<{ sourceUrl: string; resolvedUrl: string | null }>(() => ({
    sourceUrl: normalizedFallbackUrl,
    resolvedUrl: bundledFallbackResolvedUrlCache.get(normalizedFallbackUrl) || null,
  }));
  const [initialEagerFallbackAttempt] = useState<{ sourceUrl: string; promise: Promise<string | null> } | null>(() => {
    if (loading !== "eager" || !normalizedFallbackUrl) return null;
    const cached = bundledFallbackResolvedUrlCache.get(normalizedFallbackUrl);
    return {
      sourceUrl: normalizedFallbackUrl,
      promise: cached ? Promise.resolve(cached) : loadBundledFallbackForMountedAttempt(normalizedFallbackUrl),
    };
  });
  const eagerFallbackAttempts = useRef(new Map(
    initialEagerFallbackAttempt
      ? [[initialEagerFallbackAttempt.sourceUrl, initialEagerFallbackAttempt.promise] as const]
      : [],
  ));

  useEffect(() => {
    if (!normalizedFallbackUrl || loading !== "eager") return;
    let active = true;
    setFallbackLoadState({
      sourceUrl: normalizedFallbackUrl,
      resolvedUrl: bundledFallbackResolvedUrlCache.get(normalizedFallbackUrl) || null,
    });
    let attempt = eagerFallbackAttempts.current.get(normalizedFallbackUrl);
    if (!attempt) {
      const cached = bundledFallbackResolvedUrlCache.get(normalizedFallbackUrl);
      attempt = cached ? Promise.resolve(cached) : loadBundledFallbackForMountedAttempt(normalizedFallbackUrl);
      eagerFallbackAttempts.current.set(normalizedFallbackUrl, attempt);
    }
    void attempt.then((resolvedUrl) => {
      if (active) setFallbackLoadState({ sourceUrl: normalizedFallbackUrl, resolvedUrl });
    });
    return () => {
      active = false;
    };
  }, [loading, normalizedFallbackUrl]);

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
    const resolvedFallbackUrl = fallbackLoadState.sourceUrl === normalizedFallbackUrl
      ? fallbackLoadState.resolvedUrl || normalizedFallbackUrl
      : normalizedFallbackUrl;
    candidates.push({ url: resolvedFallbackUrl, kind: "image", source: "bundled-fallback" });
  }
  const candidate = candidates.find((item) => !failedUrls.includes(item.url));

  const rejectCandidate = () => {
    if (!candidate) return;
    if (candidate.source === "bundled-fallback" && normalizedFallbackUrl) {
      bundledFallbackCacheBypassUrls.add(normalizedFallbackUrl);
      if (candidate.url !== normalizedFallbackUrl) {
        evictBrokenBundledFallback(normalizedFallbackUrl, candidate.url);
      }
      if (loading === "lazy") {
        void loadBundledFallbackForMountedAttempt(normalizedFallbackUrl).then((resolvedUrl) => {
          if (resolvedUrl) setFallbackLoadState({ sourceUrl: normalizedFallbackUrl, resolvedUrl });
        });
      }
    }
    setLoadState((current) => {
      const ready = current.signature === signature ? current.readyUrls : [];
      const failed = current.signature === signature ? current.failedUrls : [];
      if (failed.includes(candidate.url)) return current;
      return { signature, readyUrls: ready, failedUrls: [...failed, candidate.url] };
    });
  };

  const shareLoadedBundledFallback = () => {
    if (
      loading !== "lazy"
      || candidate?.source !== "bundled-fallback"
      || candidate.url !== normalizedFallbackUrl
    ) return;
    void loadBundledFallbackOnce(normalizedFallbackUrl).then((resolvedUrl) => {
      if (resolvedUrl) setFallbackLoadState({ sourceUrl: normalizedFallbackUrl, resolvedUrl });
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
      onLoad={shareLoadedBundledFallback}
      onError={rejectCandidate}
    />
  );
}
