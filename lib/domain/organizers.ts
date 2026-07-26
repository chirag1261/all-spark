import { Organizer } from "@/types";

/**
 * Organizer validation — pure, I/O-free. Single source of truth for the
 * admin create/update form's server-side validation.
 */

export interface OrganizerInput {
  name?: unknown;
  role?: unknown;
  bio?: unknown;
  photoUrl?: unknown;
  displayOrder?: unknown;
  published?: unknown;
}

export type ValidatedOrganizer = Omit<Organizer, "id" | "createdAt" | "updatedAt">;

/** Validates admin create/update input, returning the sanitized organizer or a human error. */
export function validateOrganizerInput(
  body: OrganizerInput
): { ok: true; value: ValidatedOrganizer } | { ok: false; error: string } {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const name = str(body.name);
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "Name must be 2–80 characters" };
  }

  const role = str(body.role).slice(0, 120);
  const bio = str(body.bio).slice(0, 2000);
  const photoUrl = str(body.photoUrl);

  let displayOrder = 0;
  if (body.displayOrder !== undefined && body.displayOrder !== "") {
    const n = Number(body.displayOrder);
    if (!Number.isFinite(n)) return { ok: false, error: "Display order must be a number" };
    displayOrder = Math.trunc(n);
  }

  const published = body.published !== false;

  return { ok: true, value: { name, role, bio, photoUrl, displayOrder, published } };
}
