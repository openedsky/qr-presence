import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getObjectBuffer } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { key } = await params;
  const objectKey = key.map((part) => decodeURIComponent(part)).join("/");
  const buffer = await getObjectBuffer(objectKey);
  if (!buffer) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/octet-stream" },
  });
}
