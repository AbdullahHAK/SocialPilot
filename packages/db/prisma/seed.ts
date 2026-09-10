import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/password.js";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@socialpilot.test";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Demo user ${email} already exists, skipping seed.`);
    return;
  }

  const passwordHash = await hashPassword("demo-password");

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Demo Owner",
      memberships: {
        create: {
          role: "OWNER",
          organization: {
            create: {
              name: "Demo Business",
              publishingSchedule: { create: {} },
            },
          },
        },
      },
    },
    include: { memberships: { include: { organization: true } } },
  });

  console.log(
    `Seeded demo user ${user.email} in organization "${user.memberships[0]?.organization.name}"`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
