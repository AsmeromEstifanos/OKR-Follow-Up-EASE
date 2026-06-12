import { getCommentCounts, listKeyResults, listKpis, listObjectives } from "@/lib/store";
import { parseAssignedOwners } from "@/lib/owner";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EnrichedCount = {
  count: number;
  latestAt: string;
  latestBody: string;
  latestAuthor: string;
  entityType: "objective" | "kr" | "kpi";
  entityKey: string;
  title: string;
  code: string;
  department?: string;
  timestamps: string[];
  ownerEmails: string[];
  participantEmails: string[];
  mentionedEmails: string[];
};

function ownerEmailsOf(owner?: string, ownerEmail?: string): string[] {
  return parseAssignedOwners(owner, ownerEmail)
    .map((entry) => entry.email.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET(): Promise<NextResponse> {
  const [counts, objectives, krs, kpis] = await Promise.all([
    getCommentCounts(),
    listObjectives({}),
    listKeyResults({}),
    listKpis({})
  ]);

  const objectiveByKey = new Map(objectives.map((o) => [o.objectiveKey, o]));
  const krByKey = new Map(krs.map((k) => [k.krKey, k]));
  const kpiByKey = new Map(kpis.map((k) => [k.kpiKey, k]));

  const enriched: Record<string, EnrichedCount> = {};
  for (const [id, base] of Object.entries(counts)) {
    const [entityType, entityKey] = id.split("::");
    if (entityType !== "objective" && entityType !== "kr" && entityType !== "kpi") continue;

    let title = entityKey;
    let code = entityKey;
    let department: string | undefined;
    let ownerEmails: string[] = [];

    if (entityType === "objective") {
      const obj = objectiveByKey.get(entityKey);
      if (obj) {
        title = obj.title;
        code = obj.objectiveCode ?? obj.objectiveKey;
        department = obj.department;
        ownerEmails = ownerEmailsOf(obj.owner, obj.ownerEmail);
      }
    } else if (entityType === "kr") {
      const kr = krByKey.get(entityKey);
      if (kr) {
        title = kr.title;
        code = kr.krCode ?? kr.krKey;
        ownerEmails = ownerEmailsOf(kr.owner, kr.ownerEmail);
        const parentObj = objectiveByKey.get(kr.objectiveKey);
        if (parentObj) {
          department = parentObj.department;
        }
      }
    } else {
      const kpi = kpiByKey.get(entityKey);
      if (kpi) {
        title = kpi.title;
        code = kpi.kpiCode ?? kpi.kpiKey;
        ownerEmails = ownerEmailsOf(kpi.owner, kpi.ownerEmail);
        const parentObj = objectiveByKey.get(kpi.objectiveKey);
        if (parentObj) {
          department = parentObj.department;
        }
      }
    }

    enriched[id] = {
      count: base.count,
      latestAt: base.latestAt,
      latestBody: base.latestBody,
      latestAuthor: base.latestAuthor,
      entityType: entityType as "objective" | "kr" | "kpi",
      entityKey,
      title,
      code,
      department,
      timestamps: base.timestamps,
      ownerEmails,
      participantEmails: base.participantEmails ?? [],
      mentionedEmails: base.mentionedEmails ?? []
    };
  }

  return NextResponse.json({ counts: enriched });
}
