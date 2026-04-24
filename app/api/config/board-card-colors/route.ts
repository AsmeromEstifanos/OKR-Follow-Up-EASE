import { requireAdmin } from "@/app/api/_utils/admin-guard";
import { withOperationProgress } from "@/app/api/_utils/with-operation-progress";
import { updateBoardCardColors } from "@/lib/store";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseBody(body: unknown): string[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid board color payload.");
  }

  const colors = (body as { boardCardColors?: unknown }).boardCardColors;
  if (!Array.isArray(colors)) {
    throw new Error("boardCardColors must be an array.");
  }

  return colors.map((value) => {
    if (typeof value !== "string") {
      throw new Error("Board card colors must be strings.");
    }

    return value;
  });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return withOperationProgress(request, "Updating board colors", async () => {
    const blocked = await requireAdmin(request);
    if (blocked) {
      return blocked;
    }

    try {
      const body = await request.json();
      const boardCardColors = parseBody(body);
      const config = await updateBoardCardColors(boardCardColors);
      return NextResponse.json(config);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update board colors.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
