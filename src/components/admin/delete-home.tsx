"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { outlineButton } from "./card";
import { StatusText, useSave } from "./form";
import { send } from "./requests";

export function DeleteHome({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const { status, run, busy } = useSave();

  async function remove() {
    const result = await run(() => send(`/api/admin/properties/${id}`, "DELETE"), "Deleted.");
    if (result.ok) router.push("/admin/properties");
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Takes the home off the website and out of this list.</p>
        <Dialog.Trigger
          disabled={!hydrated}
          className="h-10 rounded-lg px-4 text-sm text-danger ring-1 ring-line hover:bg-admin-bg disabled:opacity-60"
        >
          Delete home
        </Dialog.Trigger>
      </div>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-navy-deep/50" />
        <Dialog.Content className="admin-theme fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-card bg-white p-6 text-ink shadow-xl">
          <Dialog.Title className="font-serif text-2xl text-navy">Delete {name}?</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted">
            It comes off the website straight away. Its photos, dates and inquiries are kept, and an alert email is sent
            so nobody is caught by surprise.
          </Dialog.Description>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <StatusText status={status} />
            <Dialog.Close className={outlineButton}>Keep it</Dialog.Close>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="h-10 rounded-full bg-danger px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Deleting…" : "Yes, delete it"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
