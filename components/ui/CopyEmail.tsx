"use client";

import { useEffect, useRef, useState } from "react";

/* Copy, with the result said out loud.

   The confirmation is a live region rather than a tooltip, so a screen
   reader is told the address was copied instead of watching a button
   silently change colour. If the clipboard is unavailable — an
   insecure origin, a browser that refuses — the button says so rather
   than claiming success it cannot verify. */
export default function CopyEmail({
  email,
  className,
}: {
  email: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setState("done");
    } catch {
      setState("failed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2400);
  };

  return (
    <>
      <button type="button" onClick={copy} className={className} data-state={state}>
        {state === "done" ? "Copied" : state === "failed" ? "Copy failed" : "Copy address"}
      </button>
      <span className="sr-only" role="status">
        {state === "done"
          ? `${email} copied to the clipboard`
          : state === "failed"
            ? "Could not copy the address. Select it manually."
            : ""}
      </span>
    </>
  );
}
