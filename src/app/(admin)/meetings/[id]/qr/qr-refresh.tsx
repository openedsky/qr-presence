"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function QrRefresh({ meetingId, seconds }: { meetingId: string; seconds: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setLeft((value) => {
        if (value <= 1) {
          router.refresh();
          return seconds;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [meetingId, router, seconds]);

  return <p className="mt-2 text-xs text-muted">QR dynamique · renouvellement dans {left}s</p>;
}
