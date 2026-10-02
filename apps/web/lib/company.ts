export const COMPANY_LEGAL_NAME = "YH DIGITAL LLC";
export const CONTACT_EMAIL = "contact@yopapi.com";
export const SITE_ORIGIN = "https://yopapi.com";
// Shown on the Subscribe page's manual-activation card - the person to
// contact for manual subscription activation while Stripe checkout isn't
// fully wired up yet.
export const CONTACT_PHONE = "+212 609 362 838";
// wa.me links need digits only (country code, no "+", no spaces) - kept as
// its own constant rather than stripped from CONTACT_PHONE inline wherever
// a WhatsApp link is built, so the two can never drift out of sync.
export const WHATSAPP_NUMBER = "212609362838";
