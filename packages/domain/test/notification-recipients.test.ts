import { describe, expect, it } from "vitest";

import { collectNotificationRecipientIds } from "../src/index.js";

describe("notification recipients", () => {
  it("DM-S04/S05 returns unique non-empty Discord user IDs", () => {
    expect(collectNotificationRecipientIds(["100", "200", "100", null, undefined, ""])).toEqual([
      "100",
      "200",
    ]);
  });
});
