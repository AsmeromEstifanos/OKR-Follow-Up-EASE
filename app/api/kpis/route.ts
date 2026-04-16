import { requireDepartmentOwnerOrAdminForKrCreate } from "@/app/api/_utils/department-owner-guard";
import { withOperationProgress } from "@/app/api/_utils/with-operation-progress";
import { createKpi, listKpis } from "@/lib/store";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const kpis = await listKpis({
    periodKey: searchParams.get("periodKey") ?? undefined,
    objectiveKey: searchParams.get("objectiveKey") ?? undefined,
    krKey: searchParams.get("krKey") ?? undefined,
    owner: searchParams.get("owner") ?? undefined,
    status: searchParams.get("status") ?? undefined
  });

  return NextResponse.json(kpis);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withOperationProgress(request, "Creating KPI", async () => {
    try {
      const body = await request.json();
      const blocked = await requireDepartmentOwnerOrAdminForKrCreate(request, {
        objectiveKey: typeof body?.objectiveKey === "string" ? body.objectiveKey : undefined
      });
      if (blocked) {
        return blocked;
      }

      const kpi = await createKpi(body);
      return NextResponse.json(kpi, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create KPI.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
