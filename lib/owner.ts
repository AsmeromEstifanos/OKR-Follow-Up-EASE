export type AssignedOwner = {
  name: string;
  email: string;
};

const OWNER_SEPARATOR = "; ";

function splitOwnerValue(value?: string): string[] {
  const raw = (value ?? "").trim();
  if (!raw) {
    return [];
  }

  const semicolonSplit = raw
    .split(/[\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (semicolonSplit.length > 1 || /[\n;]/.test(raw) || !raw.includes(",")) {
    return semicolonSplit;
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupeAssignedOwners(entries: AssignedOwner[]): AssignedOwner[] {
  const seen = new Set<string>();
  const deduped: AssignedOwner[] = [];

  entries.forEach((entry) => {
    const name = entry.name.trim();
    const email = entry.email.trim();
    const displayName = name || email;
    if (!displayName) {
      return;
    }

    const key = (email || displayName).toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    deduped.push({
      name: displayName,
      email
    });
  });

  return deduped;
}

export function parseAssignedOwners(owner?: string, ownerEmail?: string): AssignedOwner[] {
  const names = splitOwnerValue(owner);
  const emailTokens = splitOwnerValue(ownerEmail);
  const count = Math.max(names.length, emailTokens.length);
  const entries: AssignedOwner[] = [];

  for (let index = 0; index < count; index += 1) {
    const rawName = names[index]?.trim() ?? "";
    const rawEmailToken = emailTokens[index]?.trim() ?? "";
    const email = rawEmailToken.includes("@") ? rawEmailToken : rawName.includes("@") ? rawName : "";
    const name = rawName || email;

    if (!name && !email) {
      continue;
    }

    entries.push({ name, email });
  }

  return dedupeAssignedOwners(entries);
}

export function serializeAssignedOwners(entries: AssignedOwner[]): {
  owner: string;
  ownerEmail: string;
} {
  const normalized = dedupeAssignedOwners(entries);

  return {
    owner: normalized.map((entry) => entry.name || entry.email).join(OWNER_SEPARATOR),
    ownerEmail: normalized
      .map((entry) => entry.email || entry.name || "")
      .join(OWNER_SEPARATOR)
  };
}

export function resolveOwnerName(owner?: string, ownerEmail?: string): string {
  return parseAssignedOwners(owner, ownerEmail)
    .map((entry) => entry.name || entry.email)
    .join(OWNER_SEPARATOR);
}

export function resolveOwnerEmail(owner?: string, ownerEmail?: string): string {
  return parseAssignedOwners(owner, ownerEmail)
    .map((entry) => entry.email || entry.name || "")
    .join(OWNER_SEPARATOR);
}

export function formatOwnerLabel(owner?: string, ownerEmail?: string): string {
  return parseAssignedOwners(owner, ownerEmail)
    .map((entry) => entry.name || entry.email)
    .join(", ");
}

export function formatOwnerEmailLabel(owner?: string, ownerEmail?: string): string {
  return parseAssignedOwners(owner, ownerEmail)
    .map((entry) => entry.email)
    .filter(Boolean)
    .join(", ");
}

export function includesAssignedOwnerEmail(
  owner?: string,
  ownerEmail?: string,
  candidateEmail?: string
): boolean {
  const normalizedCandidate = (candidateEmail ?? "").trim().toLowerCase();
  if (!normalizedCandidate) {
    return false;
  }

  return parseAssignedOwners(owner, ownerEmail).some((entry) => entry.email.trim().toLowerCase() === normalizedCandidate);
}

export function includesSerializedOwnerEmail(ownerEmail?: string, candidateEmail?: string): boolean {
  return includesAssignedOwnerEmail(undefined, ownerEmail, candidateEmail);
}

export function matchesAssignedOwner(owner?: string, ownerEmail?: string, expected?: string): boolean {
  const normalizedExpected = (expected ?? "").trim().toLowerCase();
  if (!normalizedExpected) {
    return true;
  }

  return parseAssignedOwners(owner, ownerEmail).some((entry) => {
    return (
      entry.name.trim().toLowerCase() === normalizedExpected ||
      entry.email.trim().toLowerCase() === normalizedExpected
    );
  });
}
