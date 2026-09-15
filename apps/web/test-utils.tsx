import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import enMessages from "./messages/en.json";

// useTranslations() throws without a provider in the tree - every existing
// test asserts against literal English text, so wrapping in English
// messages here keeps those assertions correct unchanged, rather than
// needing every test file to set this up itself.
export function render(ui: ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={enMessages}>
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });
}

export * from "@testing-library/react";
