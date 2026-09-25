"use client";

import { useEffect, useState } from "react";

type EventPayload = {
  type: string;
  attendance?: {
    firstNames: string;
    lastName: string;
    checkInAt: string;
  };
};

export function LiveFeed({ meetingId, initialCount }: { meetingId: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const source = new EventSource(`/api/meetings/${meetingId}/stream`);
    source.onmessage = (message) => {
      const data = JSON.parse(message.data) as EventPayload;
      if (data.type === "attendance.created" && data.attendance) {
        const time = new Date(data.attendance.checkInAt).toLocaleTimeString("fr-FR");
        setCount((value) => value + 1);
        setEvents((list) => [
          `+ ${data.attendance!.firstNames} ${data.attendance!.lastName} vient de s'enregistrer — ${time}`,
          ...list,
        ].slice(0, 8));
      }
    };
    return () => source.close();
  }, [meetingId]);

  return (
    <div className="rounded-2xl bg-mint p-4">
      <p className="text-sm font-semibold text-forest">{count} participants enregistrés</p>
      <ul className="mt-3 space-y-2 text-sm text-forest-deep">
        {events.map((event) => (
          <li key={event}>{event}</li>
        ))}
      </ul>
    </div>
  );
}
