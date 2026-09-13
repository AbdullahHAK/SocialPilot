/** Only ever redirect back within our own app - a same-origin relative
 * path starting with a single "/", never a protocol-relative "//host"
 * that would actually send the browser somewhere external. */
export function safeReturnTo(value: FormDataEntryValue | null, fallback: string): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return fallback;
}
