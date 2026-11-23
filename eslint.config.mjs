import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Guest personal data must never reach logs. Use console.warn/error with
      // generic messages only; console.log is banned outright.
      "no-console": ["error", { allow: ["warn", "error"] }],
      // Guest text is rendered as plain text only. JSON-LD gets a scoped exception later.
      "react/no-danger": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name='SUPABASE_SERVICE_ROLE_KEY']",
          message:
            "The service role key may only be read in src/lib/supabase/admin.ts (server-only).",
        },
      ],
    },
  },
  {
    files: ["src/lib/supabase/admin.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "supabase/**",
    "src/types/database.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
