export function withAlpha(hex: string | undefined, alpha: number) {
  if (!hex) return `rgba(15, 23, 42, ${alpha})`;
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildTopbarSurfaceStyle(textColor: string) {
  return {
    borderColor: withAlpha(textColor, 0.18),
    backgroundColor: withAlpha(textColor, 0.06),
    color: textColor,
  };
}
