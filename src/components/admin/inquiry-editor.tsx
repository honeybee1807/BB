"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUSES, STATUS_LABELS, type InquiryStatus } from "@/lib/admin-format";
import type { Admin } from "@/lib/data/admin";
import { useHydrated } from "@/lib/use-hydrated";
import type { InquiryUpdate } from "@/lib/validation/admin";
import { primaryButton } from "./card";
import { updateInquiry } from "./requests";

const field = "w-full rounded-xl border border-field bg-white px-4 text-[15px] text-ink";
const label = "mb-2 block text-[11px] font-semibold tracking-[0.14em] text-navy uppercase";

export function InquiryEditor({
  id,
  status,
  assignedTo,
  notes,
  admins,
  me,
}: {
  id: string;
  status: InquiryStatus;
  assignedTo: string | null;
  notes: string;
  admins: Admin[];
  me: string;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [values, setValues] = useState({ status, assignedTo: assignedTo ?? "", notes });
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; text: string }>({
    kind: "idle",
    text: "",
  });

  const changed =
    values.status !== status || values.assignedTo !== (assignedTo ?? "") || values.notes.trim() !== notes.trim();

  // Only changed fields are sent, so saving a note never undoes someone else's claim.
  async function send(change: InquiryUpdate) {
    setState({ kind: "saving", text: "Saving..." });
    const result = await updateInquiry(id, change);
    if (result.ok) {
      setState({ kind: "saved", text: "Saved." });
      router.refresh();
    } else {
      setState({ kind: "error", text: result.error });
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const change: InquiryUpdate = {};
    if (values.status !== status) change.status = values.status;
    if (values.assignedTo !== (assignedTo ?? "")) change.assignedTo = values.assignedTo || null;
    if (values.notes.trim() !== notes.trim()) change.notes = values.notes;
    void send(change);
  }

  return (
    <form method="post" onSubmit={save} noValidate className="flex flex-col gap-5">
      {!assignedTo && (
        <button
          type="button"
          disabled={!hydrated || state.kind === "saving"}
          onClick={() => void send({ assignedTo: me })}
          className={`${primaryButton} self-start`}
        >
          <Check aria-hidden strokeWidth={2} className="size-4" />
          Claim this inquiry
        </button>
      )}
      <div>
        <label htmlFor="edit-assignee" className={label}>
          Assign to
        </label>
        <select
          id="edit-assignee"
          value={values.assignedTo}
          onChange={(e) => setValues((v) => ({ ...v, assignedTo: e.target.value }))}
          className={`${field} h-12`}
        >
          <option value="">Unclaimed</option>
          {assignedTo && !admins.some((a) => a.id === assignedTo) && (
            <option value={assignedTo} disabled>
              Previously assigned (no longer active)
            </option>
          )}
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="edit-status" className={label}>
          Status
        </label>
        <select
          id="edit-status"
          value={values.status}
          onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as InquiryStatus }))}
          className={`${field} h-12`}
        >
          {STATUSES.map((st) => (
            <option key={st} value={st}>
              {STATUS_LABELS[st]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="edit-notes" className={label}>
          Internal notes
        </label>
        <textarea
          id="edit-notes"
          rows={5}
          maxLength={5000}
          placeholder="Add a note for the team. Guests never see these."
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          className={`${field} py-3 leading-relaxed`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!hydrated || !changed || state.kind === "saving"} className={primaryButton}>
          {state.kind === "saving" ? "Saving..." : "Save update"}
          <Check aria-hidden strokeWidth={2} className="size-4" />
        </button>
        <p
          role={state.kind === "error" ? "alert" : "status"}
          className={`text-sm ${state.kind === "error" ? "text-danger" : "text-muted"}`}
        >
          {state.kind === "saving" ? "" : state.text}
        </p>
      </div>
    </form>
  );
}
