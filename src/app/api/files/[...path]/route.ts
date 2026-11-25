import { NextResponse } from "next/server";
import { getStoredObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ path: string[] }> };

export async function GET(_req: Request, { params }: Params) {
  const { path } = await params;
  const key = path.map(decodeURIComponent).join("/");

  try {
    const obj = await getStoredObject(key);
    if (!obj) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(Buffer.from(obj.bytes), {
      status: 200,
      headers: {
        "Content-Type": obj.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(obj.bytes.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
