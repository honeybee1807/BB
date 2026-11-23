import { publicEnv } from "@/lib/env";

type PublicBucket = "property-photos" | "blog-images";

export function publicImageUrl(bucket: PublicBucket, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${encoded}`;
}
