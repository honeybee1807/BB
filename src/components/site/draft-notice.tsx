// Shown on pages whose text the client hasn't approved yet. Remove once it is final.
export function DraftNotice() {
  return (
    <p role="note" className="border-l-4 border-gold bg-sand-light px-4 py-3 text-sm text-ink">
      <strong className="font-semibold">Draft.</strong> This text is waiting for approval and is not final.
    </p>
  );
}
