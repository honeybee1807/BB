/**
 * Phase 2 REST and Storage API tests against the LOCAL Supabase stack.
 * Proves through the real Data API (PostgREST) and Storage API what the pgTAP
 * tests prove in SQL: anon, team member and owner see and do only what they should.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, readLocalStack, signedInClient, type Db } from "./local-stack";

const stack = readLocalStack();
const admin = client(stack.url, stack.serviceKey); // fixtures and cleanup only
const anon = client(stack.url, stack.anonKey);
let team: Db;
let owner: Db;

const run = randomBytes(4).toString("hex");
const slug = (s: string) => `apitest-${run}-${s}`;
const password = `${randomBytes(18).toString("base64url")}Aa1!`;
const ownerEmail = `apitest-owner-${run}@test.local`;
const teamEmail = `apitest-team-${run}@test.local`;

const ids = {
  owner: "",
  team: "",
  region: randomUUID(),
  estate: randomUUID(),
  published: randomUUID(),
  draft: randomUUID(),
  deleted: randomUUID(),
  inquiry: randomUUID(),
  postPublished: randomUUID(),
  postDraft: randomUUID(),
};
const photoPath = `apitest/${run}/existing.webp`;
// Smallest valid WebP header bytes are enough: buckets check the declared MIME type.
const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1a, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): NonNullable<T> {
  if (result.error || result.data == null) throw new Error(`${what}: ${result.error?.message ?? "no data"}`);
  return result.data;
}

function check(result: { error: { message: string } | null }, what: string): void {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
}

async function createAdminUser(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`create user: ${error?.message ?? "no user"}`);
  return data.user.id;
}

beforeAll(async () => {
  ids.owner = await createAdminUser(ownerEmail);
  ids.team = await createAdminUser(teamEmail);
  check(await admin.from("admin_profiles").insert([
    { id: ids.owner, full_name: "API Owner", role: "owner" },
    { id: ids.team, full_name: "API Team", role: "team_member" },
  ]), "profiles");
  check(await admin.from("regions").insert({ id: ids.region, slug: slug("region"), name: "API Region" }), "region");
  check(await admin.from("estates").insert({ id: ids.estate, region_id: ids.region, slug: slug("estate"), name: "API Estate" }), "estate");
  check(await admin.from("properties").insert([
    { id: ids.published, estate_id: ids.estate, slug: slug("published"), name: "Published", is_published: true },
    { id: ids.draft, estate_id: ids.estate, slug: slug("draft"), name: "Draft", is_published: false },
    { id: ids.deleted, estate_id: ids.estate, slug: slug("deleted"), name: "Deleted", is_published: true, deleted_at: new Date().toISOString() },
  ]), "properties");
  check(await admin.from("property_photos").insert([
    { property_id: ids.published, storage_path: "a.webp", thumb_path: "a-t.webp" },
    { property_id: ids.draft, storage_path: "b.webp", thumb_path: "b-t.webp" },
  ]), "photos");
  check(await admin.from("availability_blocks").insert([
    { property_id: ids.published, date: "2027-01-10" },
    { property_id: ids.draft, date: "2027-01-10" },
    { property_id: ids.deleted, date: "2027-01-10" },
  ]), "blocks");
  check(await admin.from("blog_posts").insert([
    { id: ids.postPublished, slug: slug("post"), title: "Published post", is_published: true },
    { id: ids.postDraft, slug: slug("draft-post"), title: "Draft post", is_published: false },
  ]), "posts");
  check(await admin.from("inquiries").insert({
    id: ids.inquiry, guest_name: "API Guest", guest_email: "guest@example.com", guest_phone: "0820000000",
    check_in: "2027-02-01", check_out: "2027-02-03", adults: 2, consent_given_at: new Date().toISOString(),
  }), "inquiry");
  check(await admin.storage.from("property-photos").upload(photoPath, webpBytes, { contentType: "image/webp" }), "photo upload");

  owner = await signedInClient(stack, ownerEmail, password);
  team = await signedInClient(stack, teamEmail, password);
});

afterAll(async () => {
  await admin.storage.from("property-photos").remove([photoPath]);
  await admin.from("inquiries").delete().eq("id", ids.inquiry);
  await admin.from("blog_posts").delete().in("id", [ids.postPublished, ids.postDraft]);
  await admin.from("properties").delete().eq("estate_id", ids.estate);
  await admin.from("estates").delete().eq("id", ids.estate);
  await admin.from("regions").delete().like("slug", `apitest-${run}-%`);
  await admin.from("audit_log").delete().like("action", "apitest%");
  for (const id of [ids.owner, ids.team]) if (id) await admin.auth.admin.deleteUser(id);
});

describe("anon: public content tables return rows or an empty set, never an error", () => {
  it("regions and estates are readable", async () => {
    const r = await anon.from("regions").select("id").eq("id", ids.region);
    expect(r.error).toBeNull();
    expect(r.data).toHaveLength(1);
    const e = await anon.from("estates").select("id").eq("id", ids.estate);
    expect(e.error).toBeNull();
    expect(e.data).toHaveLength(1);
  });

  it("properties: only published and not deleted", async () => {
    const { data, error } = await anon.from("properties").select("id").eq("estate_id", ids.estate);
    expect(error).toBeNull();
    expect(data?.map((p) => p.id)).toEqual([ids.published]);
  });

  it("a draft property is an empty set, not an error", async () => {
    const { data, error } = await anon.from("properties").select("id").eq("id", ids.draft);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("property_photos: only photos of published properties", async () => {
    const { data, error } = await anon.from("property_photos").select("property_id").in("property_id", [ids.published, ids.draft]);
    expect(error).toBeNull();
    expect(data?.map((p) => p.property_id)).toEqual([ids.published]);
  });

  it("blog_posts: only published", async () => {
    const { data, error } = await anon.from("blog_posts").select("id").in("id", [ids.postPublished, ids.postDraft]);
    expect(error).toBeNull();
    expect(data?.map((p) => p.id)).toEqual([ids.postPublished]);
  });

  it("seo_pages are readable", async () => {
    const { data, error } = await anon.from("seo_pages").select("path");
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(6);
  });

  it("cannot write public content tables", async () => {
    const ins = await anon.from("regions").insert({ slug: slug("anon"), name: "Anon" });
    expect(ins.error?.code).toBe("42501");
    const upd = await anon.from("properties").update({ name: "Hacked" }).eq("id", ids.published);
    expect(upd.error?.code).toBe("42501");
    const del = await anon.from("blog_posts").delete().eq("id", ids.postPublished);
    expect(del.error?.code).toBe("42501");
  });
});

describe("anon: private tables are refused", () => {
  const privateTables = ["inquiries", "availability_blocks", "admin_profiles", "audit_log", "rate_limits"] as const;
  for (const table of privateTables) {
    it(`${table}: select is refused with permission denied`, async () => {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    });
  }

  it("inquiries: a direct insert with the anon key is refused", async () => {
    const { error } = await anon.from("inquiries").insert({
      guest_name: "Spam", guest_email: "s@example.com", guest_phone: "0820000000",
      check_in: "2027-01-01", check_out: "2027-01-02", adults: 1, consent_given_at: new Date().toISOString(),
    });
    expect(error?.code).toBe("42501");
  });

  it("availability_blocks: a direct insert is refused", async () => {
    const { error } = await anon.from("availability_blocks").insert({ property_id: ids.published, date: "2027-06-01" });
    expect(error?.code).toBe("42501");
  });

  it("audit_log: a direct insert is refused", async () => {
    const { error } = await anon.from("audit_log").insert({ action: "apitest.anon" });
    expect(error?.code).toBe("42501");
  });
});

describe("anon: functions", () => {
  const range = { p_from: "2027-01-01", p_to: "2027-01-31" };

  it("get_blocked_dates returns blocked dates for a published property", async () => {
    const { data, error } = await anon.rpc("get_blocked_dates", { p_property_id: ids.published, ...range });
    expect(error).toBeNull();
    expect(data).toEqual(["2027-01-10"]);
  });

  it.each([
    ["an unpublished property", () => ids.draft],
    ["a soft-deleted property", () => ids.deleted],
    ["an unknown property", () => randomUUID()],
  ])("get_blocked_dates returns an empty set for %s", async (_label, id) => {
    const { data, error } = await anon.rpc("get_blocked_dates", { p_property_id: id(), ...range });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("get_blocked_dates rejects an inverted range", async () => {
    const { error } = await anon.rpc("get_blocked_dates", { p_property_id: ids.published, p_from: "2027-01-31", p_to: "2027-01-01" });
    expect(error?.code).toBe("22023");
  });

  it("get_blocked_dates rejects a range over 366 days", async () => {
    const { error } = await anon.rpc("get_blocked_dates", { p_property_id: ids.published, p_from: "2027-01-01", p_to: "2028-01-02" });
    expect(error?.code).toBe("22023");
  });

  it("get_blocked_dates rejects a call with no property", async () => {
    const { error } = await anon.rpc("get_blocked_dates", { p_property_id: null as unknown as string, ...range });
    expect(error?.code).toBe("22023");
  });

  it.each(["is_admin", "is_owner", "list_active_admins"] as const)("%s is not callable by anon", async (fn) => {
    const { error } = await anon.rpc(fn);
    expect(error?.code).toBe("42501");
  });

  it("block_dates and rate_limit_hit are not callable by anon", async () => {
    const block = await anon.rpc("block_dates", { p_property_id: ids.published, p_from: "2027-03-01", p_to: "2027-03-02" });
    expect(block.error?.code).toBe("42501");
    const hit = await anon.rpc("rate_limit_hit", { p_bucket: "login", p_key_hash: "a".repeat(32), p_window_seconds: 900, p_max: 5 });
    expect(hit.error).not.toBeNull();
  });
});

describe("storage through the Storage API", () => {
  it("public bucket files are readable by public URL", async () => {
    const { data } = anon.storage.from("property-photos").getPublicUrl(photoPath);
    const res = await fetch(data.publicUrl);
    expect(res.status).toBe(200);
  });

  it.each(["property-photos", "blog-images", "uploads-tmp"])("anon cannot upload to %s", async (bucket) => {
    const { error } = await anon.storage.from(bucket).upload(`apitest/${run}/anon.webp`, webpBytes, { contentType: "image/webp" });
    expect(error).not.toBeNull();
  });

  it("team member and owner cannot upload directly (server pipeline only)", async () => {
    for (const c of [team, owner]) {
      const { error } = await c.storage.from("property-photos").upload(`apitest/${run}/direct.webp`, webpBytes, { contentType: "image/webp" });
      expect(error).not.toBeNull();
    }
  });

  it("anon, team member and owner cannot delete or overwrite stored photos", async () => {
    for (const c of [anon, team, owner]) {
      await c.storage.from("property-photos").remove([photoPath]);
      const up = await c.storage.from("property-photos").update(photoPath, webpBytes, { contentType: "image/webp" });
      expect(up.error).not.toBeNull();
    }
    const { data } = await admin.storage.from("property-photos").list(`apitest/${run}`);
    expect(data?.map((f) => f.name)).toContain("existing.webp");
  });

  it("nobody but the server can list the private uploads-tmp bucket", async () => {
    for (const c of [anon, team, owner]) {
      const { data } = await c.storage.from("uploads-tmp").list();
      expect(data ?? []).toEqual([]);
    }
  });

  it("a server-issued signed upload URL lets the browser upload to uploads-tmp, and a disallowed type is refused", async () => {
    const tmpPath = `apitest/${run}/${randomUUID()}.webp`;
    const signed = must(await admin.storage.from("uploads-tmp").createSignedUploadUrl(tmpPath), "signed url");
    const ok = await anon.storage.from("uploads-tmp").uploadToSignedUrl(tmpPath, signed.token, webpBytes, { contentType: "image/webp" });
    expect(ok.error).toBeNull();

    const heicPath = `apitest/${run}/${randomUUID()}.heic`;
    const signedHeic = must(await admin.storage.from("uploads-tmp").createSignedUploadUrl(heicPath), "signed url");
    const bad = await anon.storage.from("uploads-tmp").uploadToSignedUrl(heicPath, signedHeic.token, webpBytes, { contentType: "image/heic" });
    expect(bad.error).not.toBeNull();

    await admin.storage.from("uploads-tmp").remove([tmpPath, heicPath]);
  });
});

describe("team member through the API", () => {
  it("sees drafts but not soft-deleted properties", async () => {
    const { data, error } = await team.from("properties").select("id").eq("estate_id", ids.estate).order("name");
    expect(error).toBeNull();
    expect(data?.map((p) => p.id).sort()).toEqual([ids.draft, ids.published].sort());
  });

  it("can update inquiry status, assignment and notes", async () => {
    const { data, error } = await team.from("inquiries")
      .update({ status: "in_progress", assigned_to: ids.team, internal_notes: "Called guest" })
      .eq("id", ids.inquiry).select("status");
    expect(error).toBeNull();
    expect(data).toEqual([{ status: "in_progress" }]);
  });

  it("cannot soft delete a property, a post or an inquiry", async () => {
    const now = new Date().toISOString();
    expect((await team.from("properties").update({ deleted_at: now }).eq("id", ids.draft)).error?.code).toBe("42501");
    expect((await team.from("blog_posts").update({ deleted_at: now }).eq("id", ids.postDraft)).error?.code).toBe("42501");
    expect((await team.from("inquiries").update({ deleted_at: now }).eq("id", ids.inquiry)).error?.code).toBe("42501");
  });

  it("cannot restore a soft-deleted property", async () => {
    const { data } = await team.from("properties").update({ deleted_at: null }).eq("id", ids.deleted).select("id");
    expect(data ?? []).toEqual([]);
    const check = await admin.from("properties").select("deleted_at").eq("id", ids.deleted).single();
    expect(check.data?.deleted_at).not.toBeNull();
  });

  it("cannot hard delete, edit regions or read the audit log", async () => {
    expect((await team.from("properties").delete().eq("id", ids.draft)).error?.code).toBe("42501");
    expect((await team.from("regions").insert({ slug: slug("team"), name: "Team" })).error?.code).toBe("42501");
    expect((await team.from("audit_log").select("*").limit(1)).error?.code).toBe("42501");
  });

  it("can block and open dates with the range functions", async () => {
    const block = await team.rpc("block_dates", { p_property_id: ids.draft, p_from: "2027-04-01", p_to: "2027-04-03" });
    expect(block.error).toBeNull();
    expect(block.data).toBe(3);
    const open = await team.rpc("open_dates", { p_property_id: ids.draft, p_from: "2027-04-02", p_to: "2027-04-02" });
    expect(open.data).toBe(1);
  });
});

describe("owner through the API", () => {
  it("can soft delete and restore, but not hard delete", async () => {
    const del = await owner.from("properties").update({ deleted_at: new Date().toISOString() }).eq("id", ids.draft).select("id");
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
    const restore = await owner.from("properties").update({ deleted_at: null }).eq("id", ids.draft).select("id");
    expect(restore.data).toHaveLength(1);
    expect((await owner.from("properties").delete().eq("id", ids.draft)).error?.code).toBe("42501");
  });

  it("can manage regions and page SEO", async () => {
    const r = await owner.from("regions").insert({ slug: slug("owner-region"), name: "Owner Region" }).select("id");
    expect(r.error).toBeNull();
    const s = await owner.from("seo_pages").update({ description: "Updated by API test" }).eq("path", "/about").select("path");
    expect(s.data).toEqual([{ path: "/about" }]);
  });

  it("cannot read audit_log or rate_limits through the API (server only)", async () => {
    expect((await owner.from("audit_log").select("*").limit(1)).error?.code).toBe("42501");
    expect((await owner.from("rate_limits").select("*").limit(1)).error?.code).toBe("42501");
  });
});
