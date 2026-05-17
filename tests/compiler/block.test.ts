import { describe, expect, it } from "vitest";
import { upsertManagedBlock } from "../../src/compiler/block";

describe("upsertManagedBlock", () => {
  it("is idempotent", () => {
    const once = upsertManagedBlock(null, "generated");
    expect(upsertManagedBlock(once, "generated")).toBe(once);
  });

  it("preserves user content outside the managed block", () => {
    const existing = ["user header", "", "<!-- nymor:start -->", "old", "<!-- nymor:end -->", "", "user footer", ""].join("\n");

    expect(upsertManagedBlock(existing, "new")).toMatchInlineSnapshot(`
      "user header

      <!-- nymor:start -->
      new
      <!-- nymor:end -->

      user footer
      "
    `);
  });
});
