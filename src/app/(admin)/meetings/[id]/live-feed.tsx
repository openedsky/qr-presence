"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type EventPayload = {
  type: string;
  attendance?: {
    id: string;
    firstNames: string;
    lastName: string;
    checkInAt: string;
  };
};

type FeedEvent = { id: string; text: string };

/** Le compte local peut dériver (annulations, événements manqués pendant une reconnexion) : resynchronisation régulière. */
const RESYNC_MS = 60_000;

const timeFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Abidjan", hour: "2-digit", minute: "2-digit" });

export function LiveFeed({ meetingId, initialCount }: { meetingId: string; initialCount: number }) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [syncedCount, setSyncedCount] = useState(initialCount);
  const [events, setEvents] = useState<FeedEvent[]>([]);

  if (initialCount !== syncedCount) {
    setSyncedCount(initialCount);
    setCount(initialCount);
  }

  useEffect(() => {
    const source = new EventSource(`/api/meetings/${meetingId}/stream`);
    let connected = false;
    source.onmessage = (message) => {
      let data: EventPayload;
      try {
        data = JSON.parse(message.data) as EventPayload;
      } catch {
        return;
      }
      if (data.type === "ready") {
        if (connected) router.refresh();
        connected = true;
        return;
      }
      if (data.type === "attendance.created" && data.attendance) {
        const { id, firstNames, lastName, checkInAt } = data.attendance;
        setCount((value) => value + 1);
        setEvents((list) =>
          [
            { id, text: `${firstNames} ${lastName} vient de s'enregistrer — ${timeFormat.format(new Date(checkInAt))}` },
            ...list.filter((event) => event.id !== id),
          ].slice(0, 8),
        );
      }
    };
    const resync = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, RESYNC_MS);
    return () => {
      source.close();
      window.clearInterval(resync);
    };
  }, [meetingId, router]);

  return (
    <div className="rounded-2xl bg-mint p-4">
      <p className="text-sm font-semibold text-forest" aria-live="polite" aria-atomic="true">
        {count} participant{count > 1 ? "s" : ""} enregistré{count > 1 ? "s" : ""}
      </p>
      <ul className="mt-3 space-y-2 text-sm text-forest-deep" aria-live="polite" aria-relevant="additions">
        {events.map((event) => (
          <li key={event.id} className="feed-item">
            + {event.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
