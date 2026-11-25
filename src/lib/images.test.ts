import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const bucket = {
  download: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(async () => ({ error: null })),
};
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => ({ storage: { from: () => bucket } }) }));

const { encodeImage, ImageError, processUpload } = await import("./images");

const blank = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#5a8fc0" } });

describe("encodeImage", () => {
  it("drops EXIF and location data and turns the photo upright", async () => {
    const photo = await blank(300, 200)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Make: "Phone" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "29/1 30/1 0/1" } })
      .toBuffer();
    expect((await sharp(photo).metadata()).exif).toBeDefined();

    const { full, thumb } = await encodeImage(photo, true);
    const meta = await sharp(full.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect([meta.width, meta.height]).toEqual([200, 300]);
    expect((await sharp(thumb!).metadata()).exif).toBeUndefined();
  });

  it("refuses text renamed to .jpg", async () => {
    await expect(encodeImage(Buffer.from("just some text"), true)).rejects.toThrow(
      "Please choose a JPEG, PNG or WebP image.",
    );
  });

  it("refuses a damaged JPEG with a friendly message", async () => {
    const photo = await blank(800, 600).jpeg().toBuffer();
    const cut = photo.subarray(0, Math.floor(photo.length / 2));
    await expect(encodeImage(cut, true)).rejects.toThrow("That photo looks damaged");
  });

  it("refuses HEIC and says how to fix it", async () => {
    const heif = await blank(64, 64).heif({ compression: "av1" }).toBuffer();
    await expect(encodeImage(heif, true)).rejects.toThrow("Please save the photo as a JPEG");
  });

  it("refuses a photo over 50 megapixels before decoding it", async () => {
    const huge = await blank(10_000, 5_001).png({ compressionLevel: 1 }).toBuffer();
    await expect(encodeImage(huge, false)).rejects.toThrow("under 50 megapixels");
  });
});

describe("processUpload", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const photo = await blank(100, 100).jpeg().toBuffer();
    bucket.download.mockResolvedValue({ data: new Blob([new Uint8Array(photo)]), error: null });
  });

  it("removes the saved full-size image when the thumbnail fails, and the temporary file", async () => {
    bucket.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "boom" } });
    await expect(processUpload("u/tmp", "property-photos", "home", true)).rejects.toThrow();
    const [fullPath] = bucket.upload.mock.calls[0] as unknown as [string];
    expect(bucket.remove).toHaveBeenCalledWith([fullPath]);
    expect(bucket.remove).toHaveBeenCalledWith(["u/tmp"]);
  });

  it("removes the temporary file when the photo is refused", async () => {
    bucket.download.mockResolvedValue({ data: new Blob(["not an image"]), error: null });
    await expect(processUpload("u/tmp", "property-photos", "home", true)).rejects.toBeInstanceOf(ImageError);
    expect(bucket.upload).not.toHaveBeenCalled();
    expect(bucket.remove).toHaveBeenCalledWith(["u/tmp"]);
  });
});
