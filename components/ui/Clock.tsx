"use client";

import { useEffect, useState } from "react";

/* His local time, actually ticking.

   A small thing, but it is the difference between a page that says
   "GMT+8" and a page that is demonstrably running. Rendered empty on
   the server and filled on mount, so there is no hydration mismatch
   and no stale build-time timestamp baked into the HTML. */
export default function Clock({ className }: { className?: string }) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const t = window.setInterval(tick, 10_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      {time ? `${time} GMT+8` : "GMT+8"}
    </span>
  );
}
