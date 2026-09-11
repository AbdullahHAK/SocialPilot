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
