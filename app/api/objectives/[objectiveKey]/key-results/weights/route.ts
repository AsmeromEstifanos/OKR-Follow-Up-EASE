import { updateKrWeightGroup } from "@/lib/store";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = {
  params: {
    objectiveKey: string;
  };
};

type WeightEntry = {
  key: string;
  weight: number;
};

function parseBody(body: unknown): WeightEntry[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid key result weight payload.");
  }

  const weights = (body as { weights?: unknown }).weights;
  if (!Array.isArray(weights) || weights.length === 0) {
    throw new Error("Key result weights are required.");
  }

  return weights.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Invalid key result weight entry.");
    }

    const key = (entry as { key?: unknown }).key;
    const weight = (entry as { weight?: unknown }).weight;
    if (typeof key !== "string" || typeof weight !== "number" || !Number.isFinite(weight)) {
      throw new Error("Key result weight entries must include a key and numeric weight.");
    }

    return { key, weight };
  });
}

export async function PATCH(request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const body = await request.json();
    const weights = parseBody(body);
    const keyResults = await updateKrWeightGroup(context.params.objectiveKey, weights);
    return NextResponse.json(keyResults);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update key result weights.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
