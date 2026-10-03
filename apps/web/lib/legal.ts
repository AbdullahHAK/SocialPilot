// The single source of truth for which Terms version a customer is agreeing
// to - recordTermsAcceptance() stamps this onto every acceptance row, and
// /terms displays the matching date, so the two can never drift apart.
// Bump both whenever the Terms actually change in a way that matters
// legally (not for typo fixes).
export const TERMS_VERSION = "2026-09-21";
export const TERMS_UPDATED_DATE_DISPLAY = "September 21, 2026";
