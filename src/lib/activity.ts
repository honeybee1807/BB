import { STATUS_LABELS, dateRangeLabel, type InquiryStatus } from "@/lib/admin-format";
import type { Json } from "@/types/database";

export type ActivityKind = "inquiry" | "home" | "post" | "dates" | "place" | "team" | "page";

type Entry = { action: string; entity_id: string | null; metadata: Json };
type Names = { homes: Map<string, string>; posts: Map<string, string> };

// Plain sentences for the owner's activity list. Guest details never appear here.
export function describeActivity(entry: Entry, names: Names): { kind: ActivityKind; title: string } {
  const meta = (
    entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata) ? entry.metadata : {}
  ) as Record<string, Json | undefined>;
  const id = entry.entity_id ?? "";
  const home = names.homes.get(id) ?? "a home";
  const post = names.posts.get(id) ?? "a journal post";
  const Home = home[0]!.toUpperCase() + home.slice(1);
  const text = (v: Json | undefined) => (typeof v === "string" ? v : "");

  switch (entry.action) {
    case "inquiry.status": {
      const to = text(meta.to) as InquiryStatus;
      return { kind: "inquiry", title: `Inquiry marked ${(STATUS_LABELS[to] ?? "updated").toLowerCase()}` };
    }
    case "inquiry.assign":
      return { kind: "inquiry", title: meta.to ? "Inquiry claimed" : "Inquiry released" };
    case "inquiry.notes":
      return { kind: "inquiry", title: "Inquiry notes updated" };
    case "availability.block":
    case "availability.open": {
      const from = text(meta.from);
      const to = text(meta.to);
      const when = from && to ? `${dateRangeLabel(from, to)} ` : "Dates ";
      return { kind: "dates", title: `${when}${entry.action.endsWith("block") ? "blocked" : "opened"} at ${home}` };
    }
    case "property.create":
      return { kind: "home", title: `${Home} added` };
    case "property.update":
      return { kind: "home", title: `${Home} updated` };
    case "property.publish":
      return { kind: "home", title: `${Home} ${meta.published ? "published" : "hidden from the site"}` };
    case "photo.add":
    case "photo.update":
    case "photo.order":
    case "photo.delete":
      return { kind: "home", title: `Photos updated for ${home}` };
    case "post.create":
      return { kind: "post", title: `Journal post started: ${post}` };
    case "post.update":
    case "post.cover":
      return { kind: "post", title: `Journal post updated: ${post}` };
    case "post.publish":
      return { kind: "post", title: `Journal post ${meta.published ? "published" : "taken down"}: ${post}` };
    case "post.delete":
      return { kind: "post", title: "Journal post deleted" };
    case "testimonial.create":
      return { kind: "post", title: "Testimonial added" };
    case "testimonial.update":
      return { kind: "post", title: "Testimonial updated" };
    case "testimonial.delete":
      return { kind: "post", title: "Testimonial deleted" };
    case "region.create":
    case "estate.create":
      return { kind: "place", title: `${entry.action.startsWith("region") ? "Region" : "Estate"} added` };
    case "region.update":
    case "estate.update":
      return { kind: "place", title: `${entry.action.startsWith("region") ? "Region" : "Estate"} updated` };
    case "region.delete":
    case "estate.delete":
      return { kind: "place", title: `${entry.action.startsWith("region") ? "Region" : "Estate"} deleted` };
    case "team.invite":
      return { kind: "team", title: "Team invite sent" };
    case "team.invite_resend":
      return { kind: "team", title: "Team invite sent again" };
    case "team.invite_cancel":
      return { kind: "team", title: "Team invite cancelled" };
    case "team.join":
      return { kind: "team", title: "New team member joined" };
    case "team.role":
      return { kind: "team", title: "Team role changed" };
    case "team.deactivate":
      return { kind: "team", title: "Team member deactivated" };
    case "team.reactivate":
      return { kind: "team", title: "Team member reactivated" };
    case "team.remove":
      return { kind: "team", title: "Team member removed" };
    case "seo.update":
    case "seo.image":
      return { kind: "page", title: `Search details updated for ${id === "/" ? "the homepage" : id}` };
    default:
      return { kind: "page", title: "Admin change" };
  }
}
