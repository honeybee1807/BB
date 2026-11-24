"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUSES, STATUS_LABELS, type InquiryStatus } from "@/lib/admin-format";
import type { Admin } from "@/lib/data/admin";
import { useHydrated } from "@/lib/use-hydrated";
import type { InquiryUpdate } from "@/lib/validation/admin";
import { updateInquiry } from "./requests";

const field = "w-full rounded-lg border border-field bg-white px-3 text-sm text-ink";

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
    <form method="post" onSubmit={save} noValidate className="flex flex-col gap-4">
      {!assignedTo && (
        <button
          type="button"
          disabled={!hydrated || state.kind === "saving"}
          onClick={() => void send({ assignedTo: me })}
          className="h-10 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          Claim this inquiry
        </button>
      )}
      <div>
        <label htmlFor="edit-status" className="mb-1 block text-xs font-medium text-muted">
          Status
        </label>
        <select
          id="edit-status"
          value={values.status}
          onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as InquiryStatus }))}
          className={`${field} h-9`}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="edit-assignee" className="mb-1 block text-xs font-medium text-muted">
          Assigned to
        </label>
        <select
          id="edit-assignee"
          value={values.assignedTo}
          onChange={(e) => setValues((v) => ({ ...v, assignedTo: e.target.value }))}
          className={`${field} h-9`}
        >
          <option value="">Unassigned</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="edit-notes" className="mb-1 block text-xs font-medium text-muted">
          Internal notes <span className="font-normal">(only the team sees these)</span>
        </label>
        <textarea
          id="edit-notes"
          rows={6}
          maxLength={5000}
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          className={`${field} py-2 leading-relaxed`}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!hydrated || !changed || state.kind === "saving"}
          className="h-9 rounded-lg bg-teal px-4 text-sm font-medium text-white hover:bg-teal-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.kind === "saving" ? "Saving..." : "Save changes"}
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
