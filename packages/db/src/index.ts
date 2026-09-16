import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export * from "@prisma/client";
export * from "./password";
export * from "./auth";
export * from "./brand-profile";
export * from "./crypto";
export * from "./social-account";
export * from "./publishing-schedule";
export * from "./content-post";
export * from "./subscription";
export * from "./creative-concept";
export * from "./brand-creative-profile";
export * from "./timezone";
export * from "./schedule-dates";
export * from "./content-job";
export * from "./usage";
export * from "./admin-auth";
export * from "./audit-log";
export * from "./activation-code";
export * from "./organization";
