import "server-only";

/** JSON response that is never cached. */
export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Generic error responses. Detail stays in server logs, never in the response. */
export const responses = {
  forbiddenOrigin: () => json({ ok: false, error: "Request blocked." }, 403),
  badRequest: (message = "Please check the form and try again.") => json({ ok: false, error: message }, 400),
  unauthorised: () => json({ ok: false, error: "Please sign in again." }, 401),
  notFound: () => json({ ok: false, error: "Not found." }, 404),
  serverError: () => json({ ok: false, error: "Something went wrong. Please try again." }, 500),
};

/** Reads a JSON body, refusing other content types and bodies over 10 KB. */
export async function readJsonBody(request: Request, maxBytes = 10_000): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return undefined;
  const text = await request.text();
  if (text.length > maxBytes) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
