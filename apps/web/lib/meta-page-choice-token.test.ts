import { beforeEach, describe, expect, it } from "vitest";
import {
  createMetaPageChoiceToken,
  verifyMetaPageChoiceToken,
} from "./meta-page-choice-token";

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-this-long";
});

describe("meta page choice token", () => {
  it("round-trips choices and target", async () => {
    const token = await createMetaPageChoiceToken({
      encryptedUserToken: "iv.tag.data",
      choices: [
        { id: "page-1", name: "Acme Coffee", hasInstagram: true },
        { id: "page-2", name: "Acme Bakery", hasInstagram: false },
      ],
      target: "pending",
    });

    const payload = await verifyMetaPageChoiceToken(token);
    expect(payload).toEqual({
      encryptedUserToken: "iv.tag.data",
      choices: [
        { id: "page-1", name: "Acme Coffee", hasInstagram: true },
        { id: "page-2", name: "Acme Bakery", hasInstagram: false },
      ],
      target: "pending",
    });
  });

  it("rejects a tampered token", async () => {
    const token = await createMetaPageChoiceToken({
      encryptedUserToken: "iv.tag.data",
      choices: [{ id: "page-1", name: "Acme", hasInstagram: false }],
      target: "session",
    });
    expect(await verifyMetaPageChoiceToken(token.slice(0, -2) + "xx")).toBeNull();
  });

  it("rejects an empty choices list", async () => {
    const token = await createMetaPageChoiceToken({
      encryptedUserToken: "iv.tag.data",
      choices: [],
      target: "session",
    });
    expect(await verifyMetaPageChoiceToken(token)).toBeNull();
  });
});
