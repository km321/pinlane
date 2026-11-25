import { NextResponse } from "next/server";
import { isSignupOpen } from "@/lib/signup-gate";

export async function GET() {
  const open = await isSignupOpen();
  return NextResponse.json({ open });
}
