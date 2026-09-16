/**
 * One-off bootstrap for the very first platform admin - there's no
 * self-serve signup for AdminUser by design (see schema.prisma's comment
 * on the model), so this is the only way to create one.
 *
 * Run with: pnpm --filter @socialpilot/db exec tsx scripts/create-admin.ts <email> <password> [role]
 * (via the root's `dotenv -e .env --` wrapper, or with production env vars
 * already in the environment when bootstrapping production). role defaults
 * to SUPER_ADMIN; pass ADMIN/SUPPORT/FINANCE for anything else.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const VALID_ROLES = ["SUPER_ADMIN", "ADMIN", "SUPPORT", "FINANCE"];

async function main() {
  const [, , email, password, roleArg] = process.argv;
  const role = roleArg ?? "SUPER_ADMIN";

  if (!email || !password) {
    console.error("Usage: tsx scripts/create-admin.ts <email> <password> [role]");
    process.exit(1);
  }
  if (!VALID_ROLES.includes(role)) {
    console.error(`Invalid role "${role}" - must be one of ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.adminUser.create({
    data: { email, passwordHash, role: role as never },
  });

  console.log(`Created admin ${admin.email} (${admin.role}), id: ${admin.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
