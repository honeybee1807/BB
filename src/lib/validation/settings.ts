import { z } from "zod";
import { SEO_PATHS } from "@/lib/seo-pages";
import { coverSchema } from "./admin";

// Control characters and runs of whitespace go before the length check. Blank means "use the default".
const seoText = (max: number) =>
  z
    .string()
    .transform((v) =>
      v
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .pipe(z.string().max(max, { error: `Please keep this under ${max} characters.` }))
    .transform((v) => v || null);

const page = z.enum(SEO_PATHS, { error: "That page can't be changed here." });

export const seoPageSchema = z.strictObject({
  page,
  title: seoText(120),
  description: seoText(320),
});

export const seoImageSchema = z.strictObject({
  page,
  path: coverSchema.shape.path,
});
