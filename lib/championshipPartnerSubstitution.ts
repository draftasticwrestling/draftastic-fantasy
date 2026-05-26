/** Label stored on reign rows when a tag partner is replaced without the title changing hands. */
export const PARTNER_SUBSTITUTION_EVENT_LABEL = "Partner substitution";

export function isPartnerSubstitutionEventLabel(label: string | null | undefined): boolean {
  if (!label?.trim()) return false;
  return /^partner\s+substitution/i.test(label.trim());
}
