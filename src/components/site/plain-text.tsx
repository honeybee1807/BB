// Stored text is shown as plain paragraphs, never as HTML.
export function PlainText({ text, className = "" }: { text: string | null; className?: string }) {
  if (!text?.trim()) return null;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className={`flex flex-col gap-4 text-[15px] leading-relaxed text-ink ${className}`}>
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}
