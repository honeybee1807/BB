/**
 * Same-origin check for state-changing requests (CSRF defence in depth,
 * on top of SameSite=Lax cookies).
 *
 * Accepts a request only when its Origin header is the configured site origin
 * or the origin the request was addressed to. Requests without an Origin
 * header, or marked cross-site by the browser, are refused.
 */
export function isSameOrigin(request: Request, siteUrl: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  const allowed = [new URL(request.url).origin];
  if (siteUrl) allowed.push(new URL(siteUrl).origin);
  return allowed.includes(origin);
}
