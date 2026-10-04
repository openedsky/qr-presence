import { canAccessMeeting, requireMeetingApi } from "@/lib/meeting-access";
import { prisma } from "@/lib/prisma";
import { meetingChannel, subscribe } from "@/lib/realtime";

/** Hors du contexte de la requête initiale : relecture directe du compte et de la réunion. */
async function stillAuthorized(userId: string, meetingId: string, sessionVersion: number) {
  const [user, meeting] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, active: true, sessionVersion: true } }),
    prisma.meeting.findUnique({ where: { id: meetingId }, select: { createdById: true, secretaryId: true } }),
  ]);
  // Déconnexion forcée (mot de passe changé, sessions révoquées) : le flux ouvert est coupé aussi.
  if (!user?.active || user.sessionVersion !== sessionVersion) return false;
  return Boolean(meeting && canAccessMeeting(user, meeting, "read"));
}

const HEARTBEAT_MS = 15_000;
/** Droits revérifiés régulièrement : un compte désactivé ou retiré de la réunion cesse de recevoir le flux. */
const REAUTHORIZE_MS = 60_000;
/** Le navigateur se reconnecte seul (EventSource) : une durée bornée évite les connexions orphelines. */
const MAX_LIFETIME_MS = 60 * 60_000;
/**
 * Flux ouverts par compte, par instance (compteur local : un compteur Redis resterait gonflé après un arrêt brutal).
 * Large pour plusieurs onglets et écrans de salle, mais borne un script qui ouvrirait des connexions en boucle.
 */
const MAX_STREAMS_PER_USER = 12;
const openStreams = new Map<string, number>();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireMeetingApi(id, "read");
  if (gate.error) return gate.error;
  const userId = gate.session.user.id;
  if ((openStreams.get(userId) ?? 0) >= MAX_STREAMS_PER_USER) {
    return Response.json(
      { error: "Trop de suivis en direct ouverts : fermez des onglets puis réessayez." },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }
  // La session vient d'être validée contre la base : sa version courante sert de référence.
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  const sessionVersion = account?.sessionVersion ?? 0;
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      openStreams.set(userId, (openStreams.get(userId) ?? 0) + 1);
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const send = (payload: unknown) => write(`data: ${JSON.stringify(payload)}\n\n`);
      send({ type: "ready" });
      const unsubscribe = subscribe(meetingChannel(id), send);
      const heartbeat = setInterval(() => write(`: ping\n\n`), HEARTBEAT_MS);
      const reauthorize = setInterval(() => {
        void stillAuthorized(userId, id, sessionVersion)
          .then((ok) => {
            if (!ok) close();
          })
          .catch(() => undefined);
      }, REAUTHORIZE_MS);
      const lifetime = setTimeout(() => close(), MAX_LIFETIME_MS);
      cleanup = () => {
        if (closed) return;
        closed = true;
        const remaining = (openStreams.get(userId) ?? 1) - 1;
        if (remaining > 0) openStreams.set(userId, remaining);
        else openStreams.delete(userId);
        clearInterval(heartbeat);
        clearInterval(reauthorize);
        clearTimeout(lifetime);
        unsubscribe();
        request.signal.removeEventListener("abort", cleanup);
      };
      const close = () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // déjà fermé
        }
      };
      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
