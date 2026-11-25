// Photo upload edge cases, run against the local dev server and Supabase stack.
import { expect, test, type APIRequestContext } from "@playwright/test";
import sharp from "sharp";
import { totpCode } from "../tests/api/totp";
import { admin, apiAs, cleanup, createUser, password, run, type TestUser } from "./support";

test.describe.configure({ mode: "serial", timeout: 120_000 });

let owner: TestUser;
let api: APIRequestContext;
let homeId = "";

const photo = (colour = "#5a8fc0") =>
  sharp({ create: { width: 400, height: 300, channels: 3, background: colour } })
    .jpeg()
    .withExif({ IFD0: { Make: "Phone" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "29/1 30/1 0/1" } })
    .toBuffer();

async function upload(body: Buffer, contentType = "image/jpeg") {
  const ticket = await api.post("/api/admin/uploads", { data: { contentType, size: body.length } });
  expect(ticket.status(), await ticket.text()).toBe(200);
  const { path, url } = (await ticket.json()) as { path: string; url: string };
  const put = await fetch(url, { method: "PUT", body: new Uint8Array(body), headers: { "Content-Type": contentType } });
  expect(put.ok).toBe(true);
  const res = await api.post(`/api/admin/properties/${homeId}/photos`, { data: { path, alt_text: "" } });
  return { res, path };
}

async function tmpExists(path: string) {
  const [folder, name] = path.split("/");
  const { data } = await admin.storage.from("uploads-tmp").list(folder, { search: name });
  return (data ?? []).some((f) => f.name === name);
}

const storedFiles = async () => (await admin.storage.from("property-photos").list(homeId)).data ?? [];
const rows = async () =>
  (await admin.from("property_photos").select("id, is_cover, storage_path").eq("property_id", homeId)).data ?? [];

test.beforeAll(async () => {
  owner = await createUser("photos-owner", { role: "owner", fullName: "Photos Owner" });
  api = await apiAs();
  expect((await api.post("/api/admin/login", { data: { email: owner.email, password } })).status()).toBe(200);
  const enrol = (await (await api.post("/api/admin/mfa/enroll", { data: {} })).json()) as {
    factorId: string;
    secret: string;
  };
  await api.post("/api/admin/mfa/verify", { data: { factorId: enrol.factorId, code: totpCode(enrol.secret) } });
  const { data: estate } = await admin.from("estates").select("id").limit(1).single();
  const { data: home } = await admin
    .from("properties")
    .insert({ name: "Photo Test Home", slug: `e2e-photos-${run}`, estate_id: estate!.id })
    .select("id")
    .single();
  homeId = home!.id;
});

test.afterAll(async () => {
  const files = await storedFiles();
  if (files.length) await admin.storage.from("property-photos").remove(files.map((f) => `${homeId}/${f.name}`));
  await admin.from("properties").delete().eq("id", homeId);
  await cleanup();
});

test("a file over 15 MB or in HEIC format is refused before it is sent", async () => {
  const big = await api.post("/api/admin/uploads", { data: { contentType: "image/jpeg", size: 16 * 1024 * 1024 } });
  expect(big.status()).toBe(400);
  expect(await big.text()).toContain("under 15 MB");
  const heic = await api.post("/api/admin/uploads", { data: { contentType: "image/heic", size: 1000 } });
  expect(heic.status()).toBe(400);
});

test("text renamed to .jpg and a damaged JPEG are refused and leave nothing behind", async () => {
  const good = await photo();
  for (const body of [Buffer.from("just some text"), good.subarray(0, Math.floor(good.length / 2))]) {
    const { res, path } = await upload(body);
    expect(res.status()).toBe(400);
    expect(await res.text()).not.toContain("Sorry");
    expect(await tmpExists(path)).toBe(false);
  }
  expect(await rows()).toEqual([]);
  expect(await storedFiles()).toEqual([]);
});

test("a HEIC photo sent as a JPEG gets the HEIC message", async () => {
  const heif = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#fff" } })
    .heif({ compression: "av1" })
    .toBuffer();
  const { res } = await upload(heif);
  expect(res.status()).toBe(400);
  expect(await res.text()).toContain("HEIC");
});

test("photos uploaded at the same time all save, with exactly one cover", async () => {
  const results = await Promise.all(["#111111", "#222222", "#333333"].map(async (c) => upload(await photo(c))));
  for (const { res } of results) expect(res.status(), await res.text()).toBe(200);
  const saved = await rows();
  expect(saved).toHaveLength(3);
  expect(saved.filter((r) => r.is_cover)).toHaveLength(1);
  expect(await storedFiles()).toHaveLength(6);
});

test("the stored photo carries no EXIF or location data", async () => {
  const [first] = await rows();
  const { data } = await admin.storage.from("property-photos").download(first!.storage_path);
  const meta = await sharp(Buffer.from(await data!.arrayBuffer())).metadata();
  expect(meta.format).toBe("webp");
  expect(meta.exif).toBeUndefined();
});

test("the 21st photo is refused and its upload is cleared away", async () => {
  const filler = Array.from({ length: 17 }, (_, i) => ({
    property_id: homeId,
    storage_path: `${homeId}/filler-${i}.webp`,
    thumb_path: `${homeId}/filler-${i}-640.webp`,
    sort_order: 10 + i,
  }));
  expect((await admin.from("property_photos").insert(filler)).error).toBeNull();
  const { res, path } = await upload(await photo());
  expect(res.status()).toBe(400);
  expect(await res.text()).toContain("up to 20 photos");
  expect(await tmpExists(path)).toBe(false);
  expect(await rows()).toHaveLength(20);
  expect(await storedFiles()).toHaveLength(6);
});
