import { describe, expect, it } from "vitest";
import { upsertManagedBlock } from "../../src/compiler/block";

describe("upsertManagedBlock", () => {
  it("is idempotent", () => {
    const once = upsertManagedBlock(null, "generated");
    expect(upsertManagedBlock(once, "generated")).toBe(once);
  });

  it("preserves user content outside the managed block", () => {
    const existing = ["user header", "", "<!-- cicada:start -->", "old", "<!-- cicada:end -->", "", "user footer", ""].join("\n");

    expect(upsertManagedBlock(existing, "new")).toMatchInlineSnapshot(`
      "user header

      <!-- cicada:start -->
      new
      <!-- cicada:end -->

      user footer
      "
    `);
  });
});
