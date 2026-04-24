import { requireAdmin } from "@/app/api/_utils/admin-guard";
import { withOperationProgress } from "@/app/api/_utils/with-operation-progress";
import { updateBoardCardColors } from "@/lib/store";
import type { BoardCardColors } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseColorField(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} color is required.`);
  }

  return value.trim();
}

function parseBody(body: unknown): BoardCardColors {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid board color payload.");
  }

  const colors = (body as { boardCardColors?: unknown }).boardCardColors;
  if (!colors || typeof colors !== "object" || Array.isArray(colors)) {
    throw new Error("boardCardColors must be an object.");
  }

  const source = colors as Partial<Record<keyof BoardCardColors, unknown>>;
  return {
    department: parseColorField(source.department, "Department"),
    objective: parseColorField(source.objective, "Objective"),
    keyResult: parseColorField(source.keyResult, "Key result"),
    kpi: parseColorField(source.kpi, "KPI")
  };
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
