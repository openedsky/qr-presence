import { NextResponse, type NextRequest } from "next/server";
import { PROFILE_COOKIE, clearProfileCookie, openProfile } from "@/lib/participant-profile";

const NO_STORE = { "Cache-Control": "no-store, private" };

export async function GET(request: NextRequest) {
  const raw = request.cookies.get(PROFILE_COOKIE)?.value;
  const profile = openProfile(raw);
  const response = NextResponse.json({ profile }, { headers: NO_STORE });
  // Cookie expiré, altéré ou chiffré avec un ancien secret : on le retire.
  if (raw && !profile) clearProfileCookie(response);
  return response;
}

export async function DELETE() {
  const response = new NextResponse(null, { status: 204, headers: NO_STORE });
  clearProfileCookie(response);
  return response;
}
