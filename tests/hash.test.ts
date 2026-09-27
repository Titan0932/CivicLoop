import { describe, expect, test } from "vitest";
import { contentHash, normalizeContent } from "@/lib/hash";

describe("meaningful content hashing", () => {
  test("normalizes markup and whitespace", () => {
    expect(normalizeContent("<main> Hello   &amp; world </main>")).toBe("Hello & world");
    expect(contentHash("<p>Same text</p>")).toBe(contentHash("  Same   text "));
  });

  test("ignores script and style content", () => {
    expect(contentHash("<script>nonce=one</script><p>Public update</p>"))
      .toBe(contentHash("<style>.x{}</style><p>Public update</p>"));
  });
});
