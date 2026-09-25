type Listener = (payload: unknown) => void;

const channels = new Map<string, Set<Listener>>();

export function subscribe(channel: string, listener: Listener) {
  const set = channels.get(channel) ?? new Set<Listener>();
  set.add(listener);
  channels.set(channel, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) channels.delete(channel);
  };
}

export function publish(channel: string, payload: unknown) {
  const set = channels.get(channel);
  if (!set) return;
  for (const listener of set) listener(payload);
}

export function meetingChannel(meetingId: string) {
  return `meeting:${meetingId}`;
}
