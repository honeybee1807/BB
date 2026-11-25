"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_LABELS, type AdminRole } from "@/lib/admin-format";
import { formatLongDate } from "@/lib/format";
import { inviteSchema } from "@/lib/validation/team";
import type { Database } from "@/types/database";
import { AdminCard, Avatar, pill, primaryButton } from "./card";
import { Field, SaveBar, StatusText, inputClass, useSave } from "./form";
import { send } from "./requests";

type Member = Database["public"]["Functions"]["list_team"]["Returns"][number];
type Invite = { id: string; email: string; role: AdminRole; sent_at: string; expired: boolean };

const ROLES = Object.keys(ROLE_LABELS) as AdminRole[];
const smallButton =
  "h-9 rounded-full px-4 text-xs font-semibold ring-1 ring-line hover:bg-admin-bg disabled:cursor-not-allowed disabled:opacity-60";
const card = "flex min-w-0 flex-col rounded-2xl p-6 ring-1 ring-line";

function StatusBadge({ text, tone }: { text: string; tone: "on" | "off" | "waiting" }) {
  const tones = {
    on: "bg-frost text-teal",
    off: "bg-admin-bg text-muted ring-1 ring-line",
    waiting: "bg-sand-light text-navy",
  };
  return <span className={`${pill} ${tones[tone]}`}>{text}</span>;
}

function InviteForm({ onDone }: { onDone: () => void }) {
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
    <form method="post" onSubmit={submit} noValidate className="mb-6 flex flex-col gap-4 rounded-2xl bg-admin-bg p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-xl text-navy">Invite someone</h3>
        <button type="button" onClick={onDone} className="rounded-full p-1.5 text-muted hover:bg-white">
          <X aria-hidden strokeWidth={1.6} className="size-4" />
          <span className="sr-only">Close the invite form</span>
        </button>
      </div>
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
              className={`${inputClass} h-11`}
            />
          )}
        </Field>
        <Field label="Role" hint="Owners also manage the team, regions and settings, and must use two-factor sign-in.">
          {(a) => (
            <select
              {...a}
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className={`${inputClass} h-11`}
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

export function TeamSection({
  members,
  invites,
  currentUserId,
}: {
  members: Member[];
  invites: Invite[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
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
    <AdminCard
      title="Team members"
      description="Manage the people who help guests find their way."
      action={
        !inviting && (
          <button type="button" onClick={() => setInviting(true)} className={primaryButton}>
            <Plus aria-hidden strokeWidth={2} className="size-4" />
            Add team member
          </button>
        )
      }
    >
      {inviting && <InviteForm onDone={() => setInviting(false)} />}

      <ul className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {members.map((m) => {
          const self = m.id === currentUserId;
          return (
            <li key={m.id} className={card}>
              <div className="flex items-start justify-between gap-3">
                <Avatar name={m.full_name} size="lg" />
                <StatusBadge text={m.is_active ? "Active" : "Deactivated"} tone={m.is_active ? "on" : "off"} />
              </div>
              <p className="mt-5 font-serif text-2xl text-navy">
                {m.full_name}
                {self && <span className="ml-2 font-sans text-sm text-muted">(you)</span>}
              </p>
              {self ? (
                <p className="mt-2 text-sm text-muted">{ROLE_LABELS[m.role]}</p>
              ) : (
                <span className="mt-2 block w-44">
                  <select
                    aria-label={`Role for ${m.full_name}`}
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => {
                      const role = e.target.value as AdminRole;
                      void act(
                        `/api/admin/team/members/${m.id}`,
                        "PATCH",
                        { role },
                        `${m.full_name} is now ${ROLE_LABELS[role].toLowerCase()}.`,
                      );
                    }}
                    className={`${inputClass} h-10`}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </span>
              )}
              <p className="mt-5 truncate border-t border-line pt-4 text-sm text-muted">{m.email}</p>
              {!self && (
                <div className="mt-4 flex flex-wrap gap-2">
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
                </div>
              )}
            </li>
          );
        })}
        {invites.map((i) => (
          <li key={i.id} className={`${card} border border-dashed border-field ring-0`}>
            <div className="flex items-start justify-between gap-3">
              <Avatar name={i.email} size="lg" />
              <StatusBadge text={i.expired ? "Invite expired" : "Invited"} tone={i.expired ? "off" : "waiting"} />
            </div>
            <p className="mt-5 truncate font-serif text-2xl text-navy">{i.email}</p>
            <p className="mt-2 text-sm text-muted">{ROLE_LABELS[i.role]}</p>
            <p className="mt-5 border-t border-line pt-4 text-sm text-muted">Invite sent {formatLongDate(i.sent_at)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
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
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <StatusText status={status} />
      </div>
    </AdminCard>
  );
}
