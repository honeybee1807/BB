// The raw IP is only used to compute a hash, never stored or logged.
export function getClientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "unknown";
}

export function guessLocation(headers: Headers): string {
  const decode = (v: string | null) => {
    if (!v) return "";
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  const parts = [decode(headers.get("x-vercel-ip-city")), decode(headers.get("x-vercel-ip-country-region")), decode(headers.get("x-vercel-ip-country"))]
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Unknown location";
}

export function deviceName(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Unknown browser";
  const system = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown system";
  return `${browser} on ${system}`;
}
