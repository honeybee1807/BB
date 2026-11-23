export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // Escaping "<" stops a stored value from closing the script tag.
  const json = JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c");
  // eslint-disable-next-line react/no-danger -- JSON-LD is the one allowed use
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
