// REST and Storage API tests against the local Supabase stack.
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, createAuthUser, readLocalStack, signedInClient, type Db } from "./local-stack";
import { enrolAndVerifyTotp } from "./totp";

const stack = readLocalStack();
const admin = client(stack.url, stack.serviceKey); // fixtures and cleanup only
const anon = client(stack.url, stack.anonKey);
let team: Db;
let owner: Db; // aal2 (TOTP verified)
let ownerAal1: Db; // same owner, password only

const run = randomBytes(4).toString("hex");
const slug = (s: string) => `apitest-${run}-${s}`;
const password = `${randomBytes(18).toString("base64url")}Aa1!`;
const ownerEmail = `apitest-owner-${run}@test.local`;
const teamEmail = `apitest-team-${run}@test.local`;
const recoveryEmail = `apitest-recovery-${run}@test.local`;

const ids = {
  owner: "",
  team: "",
  recovery: "",
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

function createAdminUser(email: string): Promise<string> {
  return createAuthUser(admin, email, password);
}

beforeAll(async () => {
  ids.owner = await createAdminUser(ownerEmail);
  ids.team = await createAdminUser(teamEmail);
  check(
    await admin.from("admin_profiles").insert([
      { id: ids.owner, full_name: "API Owner", role: "owner" },
      { id: ids.team, full_name: "API Team", role: "team_member" },
    ]),
    "profiles",
  );
  check(await admin.from("regions").insert({ id: ids.region, slug: slug("region"), name: "API Region" }), "region");
  check(
    await admin
      .from("estates")
      .insert({ id: ids.estate, region_id: ids.region, slug: slug("estate"), name: "API Estate" }),
    "estate",
  );
  check(
    await admin.from("properties").insert([
      { id: ids.published, estate_id: ids.estate, slug: slug("published"), name: "Published", is_published: true },
      { id: ids.draft, estate_id: ids.estate, slug: slug("draft"), name: "Draft", is_published: false },
      {
        id: ids.deleted,
        estate_id: ids.estate,
        slug: slug("deleted"),
        name: "Deleted",
        is_published: true,
        deleted_at: new Date().toISOString(),
      },
    ]),
    "properties",
  );
  check(
    await admin.from("property_photos").insert([
      { property_id: ids.published, storage_path: "a.webp", thumb_path: "a-t.webp" },
      { property_id: ids.draft, storage_path: "b.webp", thumb_path: "b-t.webp" },
    ]),
    "photos",
  );
  check(
    await admin.from("availability_blocks").insert([
      { property_id: ids.published, date: "2027-01-10" },
      { property_id: ids.draft, date: "2027-01-10" },
      { property_id: ids.deleted, date: "2027-01-10" },
    ]),
    "blocks",
  );
  check(
    await admin.from("blog_posts").insert([
      { id: ids.postPublished, slug: slug("post"), title: "Published post", is_published: true },
      { id: ids.postDraft, slug: slug("draft-post"), title: "Draft post", is_published: false },
    ]),
    "posts",
  );
  check(
    await admin.from("inquiries").insert({
      id: ids.inquiry,
      guest_name: "API Guest",
      guest_email: "guest@example.com",
      guest_phone: "0820000000",
      check_in: "2027-02-01",
      check_out: "2027-02-03",
      adults: 2,
      consent_given_at: new Date().toISOString(),
    }),
    "inquiry",
  );
  check(
    await admin.storage.from("property-photos").upload(photoPath, webpBytes, { contentType: "image/webp" }),
    "photo upload",
  );

  check(await admin.from("audit_log").insert({ action: "apitest.seed" }), "audit seed");

  owner = await signedInClient(stack, ownerEmail, password);
  await enrolAndVerifyTotp(owner); // raises this session to aal2
  ownerAal1 = await signedInClient(stack, ownerEmail, password); // a fresh password-only session
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
  for (const id of [ids.owner, ids.team, ids.recovery]) if (id) await admin.auth.admin.deleteUser(id);
});

describe("anon reads public tables without errors", () => {
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
    const { data, error } = await anon
      .from("property_photos")
      .select("property_id")
      .in("property_id", [ids.published, ids.draft]);
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

describe("anon is refused private tables", () => {
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
      guest_name: "Spam",
      guest_email: "s@example.com",
      guest_phone: "0820000000",
      check_in: "2027-01-01",
      check_out: "2027-01-02",
      adults: 1,
      consent_given_at: new Date().toISOString(),
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

describe("anon functions", () => {
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
    const { error } = await anon.rpc("get_blocked_dates", {
      p_property_id: ids.published,
      p_from: "2027-01-31",
      p_to: "2027-01-01",
    });
    expect(error?.code).toBe("22023");
  });

  it("get_blocked_dates rejects a range over 366 days", async () => {
    const { error } = await anon.rpc("get_blocked_dates", {
      p_property_id: ids.published,
      p_from: "2027-01-01",
      p_to: "2028-01-02",
    });
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
    const block = await anon.rpc("block_dates", {
      p_property_id: ids.published,
      p_from: "2027-03-01",
      p_to: "2027-03-02",
    });
    expect(block.error?.code).toBe("42501");
    const hit = await anon.rpc("rate_limit_hit", {
      p_bucket: "login",
      p_key_hash: "a".repeat(32),
      p_window_seconds: 900,
      p_max: 5,
    });
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
    const { error } = await anon.storage
      .from(bucket)
      .upload(`apitest/${run}/anon.webp`, webpBytes, { contentType: "image/webp" });
    expect(error).not.toBeNull();
  });

  it("team member and owner cannot upload directly", async () => {
    for (const c of [team, owner]) {
      const { error } = await c.storage
        .from("property-photos")
        .upload(`apitest/${run}/direct.webp`, webpBytes, { contentType: "image/webp" });
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

  it("only the server can list uploads-tmp", async () => {
    for (const c of [anon, team, owner]) {
      const { data } = await c.storage.from("uploads-tmp").list();
      expect(data ?? []).toEqual([]);
    }
  });

  it("signed upload URL works and refuses HEIC", async () => {
    const tmpPath = `apitest/${run}/${randomUUID()}.webp`;
    const signed = must(await admin.storage.from("uploads-tmp").createSignedUploadUrl(tmpPath), "signed url");
    const ok = await anon.storage
      .from("uploads-tmp")
      .uploadToSignedUrl(tmpPath, signed.token, webpBytes, { contentType: "image/webp" });
    expect(ok.error).toBeNull();

    const heicPath = `apitest/${run}/${randomUUID()}.heic`;
    const signedHeic = must(await admin.storage.from("uploads-tmp").createSignedUploadUrl(heicPath), "signed url");
    const bad = await anon.storage
      .from("uploads-tmp")
      .uploadToSignedUrl(heicPath, signedHeic.token, webpBytes, { contentType: "image/heic" });
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
    const { data, error } = await team
      .from("inquiries")
      .update({ status: "in_progress", assigned_to: ids.team, internal_notes: "Called guest" })
      .eq("id", ids.inquiry)
      .select("status");
    expect(error).toBeNull();
    expect(data).toEqual([{ status: "in_progress" }]);
  });

  it("only one of two people claiming the same inquiry at once gets it", async () => {
    check(await admin.from("inquiries").update({ assigned_to: null }).eq("id", ids.inquiry), "unassign");
    const claim = (db: Db, id: string) =>
      db.from("inquiries").update({ assigned_to: id }).eq("id", ids.inquiry).is("assigned_to", null).select("id");
    const results = await Promise.all([claim(team, ids.team), claim(owner, ids.owner)]);
    for (const r of results) expect(r.error).toBeNull();
    expect(results.map((r) => r.data?.length ?? 0).sort()).toEqual([0, 1]);
    const winner = results[0].data?.length ? ids.team : ids.owner;
    const { data } = await admin.from("inquiries").select("assigned_to").eq("id", ids.inquiry).single();
    expect(data?.assigned_to).toBe(winner);
  });

  it("cannot soft delete a property, a post or an inquiry", async () => {
    const now = new Date().toISOString();
    expect((await team.from("properties").update({ deleted_at: now }).eq("id", ids.draft)).error?.code).toBe("42501");
    expect((await team.from("blog_posts").update({ deleted_at: now }).eq("id", ids.postDraft)).error?.code).toBe(
      "42501",
    );
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
    const audit = await team.from("audit_log").select("id").limit(1);
    expect(audit.error).toBeNull();
    expect(audit.data).toEqual([]);
  });

  it("can delete a property photo row", async () => {
    const inserted = await admin
      .from("property_photos")
      .insert({ property_id: ids.draft, storage_path: "team-del.webp", thumb_path: "team-del-t.webp" })
      .select("id")
      .single();
    if (inserted.error) throw new Error(`photo: ${inserted.error.message}`);
    const photo = inserted.data;
    const { data, error } = await team.from("property_photos").delete().eq("id", photo.id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: photo.id }]);
  });

  it("cannot delete page SEO rows", async () => {
    expect((await team.from("seo_pages").delete().eq("path", "/about")).error?.code).toBe("42501");
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
    const del = await owner
      .from("properties")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", ids.draft)
      .select("id");
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
    const restore = await owner.from("properties").update({ deleted_at: null }).eq("id", ids.draft).select("id");
    expect(restore.data).toHaveLength(1);
    expect((await owner.from("properties").delete().eq("id", ids.draft)).error?.code).toBe("42501");
  });

  it("can manage regions and page SEO", async () => {
    const r = await owner
      .from("regions")
      .insert({ slug: slug("owner-region"), name: "Owner Region" })
      .select("id");
    expect(r.error).toBeNull();
    const s = await owner
      .from("seo_pages")
      .update({ description: "Updated by API test" })
      .eq("path", "/about")
      .select("path");
    expect(s.data).toEqual([{ path: "/about" }]);
  });

  it("can read the audit log (read only) but not rate_limits", async () => {
    const { data, error } = await owner.from("audit_log").select("action").eq("action", "apitest.seed");
    expect(error).toBeNull();
    expect(data).toEqual([{ action: "apitest.seed" }]);
    expect((await owner.from("audit_log").insert({ action: "apitest.owner" })).error?.code).toBe("42501");
    expect((await owner.from("rate_limits").select("*").limit(1)).error?.code).toBe("42501");
  });

  it("cannot delete page SEO rows either", async () => {
    expect((await owner.from("seo_pages").delete().eq("path", "/about")).error?.code).toBe("42501");
  });
});

describe("owner two-factor", () => {
  it("rpc is_owner: false at aal1, true at aal2", async () => {
    expect((await ownerAal1.rpc("is_owner")).data).toBe(false);
    expect((await ownerAal1.rpc("is_admin")).data).toBe(false);
    expect((await owner.rpc("is_owner")).data).toBe(true);
  });

  it("owner at aal1 can read their own profile", async () => {
    const { data, error } = await ownerAal1.from("admin_profiles").select("id, role");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: ids.owner, role: "owner" }]);
  });

  it("owner at aal1 gets no access", async () => {
    expect((await ownerAal1.from("inquiries").select("id")).data).toEqual([]);
    expect((await ownerAal1.from("regions").insert({ slug: slug("aal1"), name: "X" })).error?.code).toBe("42501");
    const del = await ownerAal1
      .from("properties")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", ids.draft)
      .select("id");
    expect(del.data ?? []).toEqual([]);
    expect((await ownerAal1.from("audit_log").select("id")).data).toEqual([]);
  });

  it("recovery owner can enrol TOTP at aal1", async () => {
    ids.recovery = await createAdminUser(recoveryEmail);
    check(
      await admin.from("admin_profiles").insert({ id: ids.recovery, full_name: "API Recovery Owner", role: "owner" }),
      "recovery",
    );
    const recovery = await signedInClient(stack, recoveryEmail, password);
    expect((await recovery.rpc("is_owner")).data).toBe(false);
    await enrolAndVerifyTotp(recovery);
    expect((await recovery.rpc("is_owner")).data).toBe(true);
  });

  it("the last active owner cannot be demoted or deactivated", async () => {
    // Other local owners would count as remaining owners, so they sit out this test.
    const others = await admin
      .from("admin_profiles")
      .update({ is_active: false })
      .eq("role", "owner")
      .eq("is_active", true)
      .not("id", "in", `(${ids.owner},${ids.recovery})`)
      .select("id");
    const otherIds = (others.data ?? []).map((o) => o.id);
    try {
      const off = await owner.from("admin_profiles").update({ is_active: false }).eq("id", ids.recovery).select("id");
      expect(off.data).toEqual([{ id: ids.recovery }]);
      const self = await owner.from("admin_profiles").update({ role: "team_member" }).eq("id", ids.owner);
      expect(self.error?.code).toBe("23514");
      const deactivate = await owner.from("admin_profiles").update({ is_active: false }).eq("id", ids.owner);
      expect(deactivate.error?.code).toBe("23514");
      const back = await owner.from("admin_profiles").update({ is_active: true }).eq("id", ids.recovery).select("id");
      expect(back.data).toEqual([{ id: ids.recovery }]);
    } finally {
      if (otherIds.length) await admin.from("admin_profiles").update({ is_active: true }).in("id", otherIds);
    }
  });
});
