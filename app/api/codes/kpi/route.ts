import { previewNextKpiCode } from "@/lib/store";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const krKey = searchParams.get("krKey")?.trim() ?? "";

  if (!krKey) {
    return NextResponse.json({ error: "krKey is required." }, { status: 400 });
  }

  const code = await previewNextKpiCode(krKey);
  return NextResponse.json({ code });
}
