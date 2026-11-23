// CSRF defence on top of SameSite=Lax cookies.
export function isSameOrigin(request: Request, siteUrl: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  const allowed = [new URL(request.url).origin];
  if (siteUrl) allowed.push(new URL(siteUrl).origin);
  return allowed.includes(origin);
}
