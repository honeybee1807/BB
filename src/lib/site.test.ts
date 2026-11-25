import { describe, expect, it } from "vitest";
import { contactLinks, organizationContact, supportHref } from "./site";

const empty = { phone: "", whatsapp: "", email: "", supportEmail: "" };

describe("contact links", () => {
  it("returns nothing while every value is empty", () => {
    expect(contactLinks(empty)).toEqual([]);
    expect(supportHref(empty)).toBeNull();
  });

  it("treats blank values as empty", () => {
    expect(contactLinks({ ...empty, phone: "   ", email: " " })).toEqual([]);
    expect(contactLinks({ ...empty, phone: "( )", whatsapp: "+" })).toEqual([]);
    expect(supportHref({ ...empty, supportEmail: "  " })).toBeNull();
  });

  it("builds phone, WhatsApp and email links", () => {
    const links = contactLinks({
      ...empty,
      phone: "082 123 4567",
      whatsapp: "+27 82 123 4567",
      email: "info@example.co.za",
    });
    expect(links.map((l) => l.href)).toEqual([
      "tel:0821234567",
      "https://wa.me/27821234567",
      "mailto:info@example.co.za",
    ]);
    expect(links[1]?.text).toBe("+27821234567");
  });

  it("only shows the values that are set", () => {
    expect(contactLinks({ ...empty, email: "info@example.co.za" }).map((l) => l.kind)).toEqual(["email"]);
  });

  it("builds the support link", () => {
    expect(supportHref({ ...empty, supportEmail: "help@example.co.za" })).toBe("mailto:help@example.co.za");
  });
});

describe("organizationContact", () => {
  it("leaves out empty details", () => {
    expect(organizationContact(empty)).toEqual({});
    expect(organizationContact({ ...empty, phone: " ( ) " })).toEqual({});
  });

  it("names the phone and email once they are set", () => {
    expect(organizationContact({ ...empty, phone: "082 123 4567", email: "info@example.co.za" })).toEqual({
      telephone: "0821234567",
      email: "info@example.co.za",
    });
  });
});
