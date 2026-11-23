"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// onToken must be stable, or the widget is rendered again on every change.
export function Turnstile({
  siteKey,
  onToken,
  resetCount,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  resetCount: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !box.current || !window.turnstile) return;
    const id = window.turnstile.render(box.current, {
      sitekey: siteKey,
      size: "flexible",
      theme: "light",
      appearance: "interaction-only",
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
    widget.current = id;
    return () => {
      window.turnstile?.remove(id);
      widget.current = null;
    };
  }, [ready, siteKey, onToken]);

  // tokens work once, so a failed send needs a fresh check
  useEffect(() => {
    if (resetCount > 0 && widget.current) window.turnstile?.reset(widget.current);
  }, [resetCount]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={box} />
    </>
  );
}
