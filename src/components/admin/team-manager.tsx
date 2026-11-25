"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_LABELS, type AdminRole } from "@/lib/admin-format";
import { formatLongDate } from "@/lib/format";
import { inviteSchema } from "@/lib/validation/team";
import type { Database } from "@/types/database";
import { Avatar } from "./card";
import { Field, SaveBar, StatusText, inputClass, useSave } from "./form";
import { send } from "./requests";

type Member = Database["public"]["Functions"]["list_team"]["Returns"][number];
type Invite = { id: string; email: string; role: AdminRole; sent_at: string; expired: boolean };

const ROLES = Object.keys(ROLE_LABELS) as AdminRole[];
const pill = "inline-flex rounded-pill px-2.5 py-1 text-xs font-medium whitespace-nowrap";
const smallButton =
  "h-8 rounded-lg px-3 text-xs font-medium ring-1 ring-line hover:bg-admin-bg disabled:cursor-not-allowed disabled:opacity-60";
const row = "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-3 py-3 ring-1 ring-line";

function RoleSelect({
  value,
  label,
  disabled,
  onChange,
}: {
  value: AdminRole;
  label: string;
  disabled: boolean;
  onChange: (role: AdminRole) => void;
}) {
  return (
    <span className="w-36 shrink-0">
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as AdminRole)}
        className={`${inputClass} h-8`}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    </span>
  );
}

export function TeamList({
  members,
  invites,
  currentUserId,
}: {
  members: Member[];
  invites: Invite[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { status, run, busy } = useSave();

  async function act(url: string, method: "PATCH" | "DELETE", body: unknown, done: string) {
    const result = await run(() => send(url, method, body), done);
    if (result.ok) router.refresh();
  }

  function remove(m: Member) {
    const ok = window.confirm(
      `Remove ${m.full_name} from the team? They won't be able to sign in again, and inquiries they were handling will show as unassigned.`,
    );
    if (ok) void act(`/api/admin/team/members/${m.id}`, "DELETE", undefined, `${m.full_name} was removed.`);
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {members.map((m) => {
          const self = m.id === currentUserId;
          return (
            <li key={m.id} className={row}>
              <span className="flex min-w-0 flex-1 basis-60 items-center gap-3">
                <Avatar name={m.full_name} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-navy">
                    {m.full_name}
                    {self && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">{m.email}</span>
                </span>
              </span>
              {self ? (
                <span className="w-36 text-sm text-ink">{ROLE_LABELS[m.role]}</span>
              ) : (
                <RoleSelect
                  value={m.role}
                  label={`Role for ${m.full_name}`}
                  disabled={busy}
                  onChange={(role) =>
                    void act(
                      `/api/admin/team/members/${m.id}`,
                      "PATCH",
                      { role },
                      `${m.full_name} is now ${ROLE_LABELS[role].toLowerCase()}.`,
                    )
                  }
                />
              )}
              <span
                className={`${pill} ${m.is_active ? "bg-teal-light text-teal" : "bg-admin-bg text-muted ring-1 ring-line"}`}
              >
                {m.is_active ? "Active" : "Deactivated"}
              </span>
              <span className="flex gap-2 sm:w-44 sm:justify-end">
                {!self && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          `/api/admin/team/members/${m.id}`,
                          "PATCH",
                          { active: !m.is_active },
                          m.is_active ? `${m.full_name} can no longer sign in.` : `${m.full_name} can sign in again.`,
                        )
                      }
                      className={`${smallButton} text-navy`}
                    >
                      {m.is_active ? "Deactivate" : "Reactivate"}
                      <span className="sr-only"> {m.full_name}</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(m)}
                      className={`${smallButton} text-danger`}
                    >
                      Remove<span className="sr-only"> {m.full_name}</span>
                    </button>
                  </>
                )}
              </span>
            </li>
          );
        })}
        {invites.map((i) => (
          <li key={i.id} className={row}>
            <span className="min-w-0 flex-1 basis-60">
              <span className="block truncate text-sm font-semibold text-navy">{i.email}</span>
              <span className="block text-xs text-muted">Invite sent {formatLongDate(i.sent_at)}</span>
            </span>
            <span className="w-36 text-sm text-ink">{ROLE_LABELS[i.role]}</span>
            <span
              className={`${pill} ${i.expired ? "bg-admin-bg text-muted ring-1 ring-line" : "bg-sand-light text-navy ring-1 ring-sand"}`}
            >
              {i.expired ? "Invite expired" : "Invited"}
            </span>
            <span className="flex gap-2 sm:w-44 sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(
                    `/api/admin/team/invites/${i.id}`,
                    "PATCH",
                    { action: "resend" },
                    `A new invite is on its way to ${i.email}.`,
                  )
                }
                className={`${smallButton} text-navy`}
              >
                Resend<span className="sr-only"> invite to {i.email}</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(
                    `/api/admin/team/invites/${i.id}`,
                    "PATCH",
                    { action: "cancel" },
                    `The invite to ${i.email} was cancelled.`,
                  )
                }
                className={`${smallButton} text-danger`}
              >
                Cancel<span className="sr-only"> invite to {i.email}</span>
              </button>
            </span>
          </li>
        ))}
      </ul>
      <StatusText status={status} />
    </div>
  );
}

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("team_member");
  const [error, setError] = useState<string>();
  const { status, run } = useSave();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = inviteSchema.safeParse({ email, role });
    setError(parsed.success ? undefined : parsed.error.issues[0]?.message);
    if (!parsed.success) return;
    const result = await run(
      () => send("/api/admin/team/invites", "POST", parsed.data),
      "Invite sent, unless that address is already on the team.",
    );
    if (!result.ok) return;
    setEmail("");
    router.refresh();
  }

  return (
    <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label="Email address" error={error}>
          {(a) => (
            <input
              {...a}
              type="email"
              autoComplete="off"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} h-10`}
            />
          )}
        </Field>
        <Field label="Role" hint="Owners also manage the team, regions and settings, and must use two-factor sign-in.">
          {(a) => (
            <select
              {...a}
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className={`${inputClass} h-10`}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <p className="text-xs text-muted">The link in the email works once and expires after 7 days.</p>
      <SaveBar status={status} label="Send invite" />
    </form>
  );
}
