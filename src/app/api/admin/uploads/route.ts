import { adminRequest } from "@/lib/admin-route";
import { json, responses } from "@/lib/http";
import { signedUpload } from "@/lib/images";
import { uploadSchema } from "@/lib/validation/admin";

// Photos go straight from the browser to private temporary storage, never through this server.
export async function POST(request: Request) {
  const req = await adminRequest(request, uploadSchema);
  if (req instanceof Response) return req;
  const upload = await signedUpload(req.identity.userId);
  if (!upload) return responses.serverError();
  return json({ ok: true, ...upload });
}
