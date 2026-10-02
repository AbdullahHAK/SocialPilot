import { Prisma } from "@prisma/client";
import { prisma } from "./index";

/** Claims a Stripe event id for processing before acting on it - the insert's
 * uniqueness is the compare-and-swap, so two concurrent deliveries of the
 * same event can never both return true. Callers should run this insert and
 * the event's own side effect in the same transaction (pass that tx as
 * `client`): committing them together means a crash between the two can
 * never leave a legitimate retry permanently skipped (claimed but not
 * acted on) or an additive effect like a subscription extension applied
 * twice (acted on but not claimed). */
export async function claimStripeEvent(
  eventId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<boolean> {
  try {
    await client.processedStripeEvent.create({ data: { id: eventId } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return false;
    }
    throw error;
  }
}
