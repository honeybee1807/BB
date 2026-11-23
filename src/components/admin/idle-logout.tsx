"use client";

import { useEffect } from "react";
import { signOut } from "./sign-out-button";

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const STORAGE_KEY = "bb-admin-last-activity";
const EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;

/**
 * Signs the admin out after 30 minutes without activity. Activity in any open
 * admin tab counts (shared through localStorage, which holds only a timestamp).
 */
export function IdleLogout() {
  useEffect(() => {
    let lastWrite = 0;
    const markActive = () => {
      const now = Date.now();
      if (now - lastWrite < 5000) return; // throttle writes
      lastWrite = now;
      try {
        localStorage.setItem(STORAGE_KEY, String(now));
      } catch {
        // storage unavailable: this tab's own timer still applies
      }
    };
    const lastActivity = () => {
      try {
        const value = Number(localStorage.getItem(STORAGE_KEY));
        return Number.isFinite(value) && value > 0 ? Math.max(value, lastWrite) : lastWrite;
      } catch {
        return lastWrite;
      }
    };

    markActive();
    for (const event of EVENTS) window.addEventListener(event, markActive, { passive: true });
    let signingOut = false;
    const timer = window.setInterval(() => {
      if (!signingOut && Date.now() - lastActivity() >= IDLE_LIMIT_MS) {
        signingOut = true;
        void signOut("idle");
      }
    }, 15_000);

    return () => {
      for (const event of EVENTS) window.removeEventListener(event, markActive);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
