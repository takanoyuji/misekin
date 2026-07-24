import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAppUrl, buildClockUrl } from "@/lib/app-url";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.APP_URL;
  delete process.env.NEXTAUTH_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("getAppUrl", () => {
  it("実行時の NEXTAUTH_URL を使う (Dockerではビルド時にNEXT_PUBLIC_*が入らないため)", () => {
    process.env.NEXTAUTH_URL = "https://example.com/dev/misekin";

    expect(getAppUrl()).toBe("https://example.com/dev/misekin");
  });

  it("APP_URL を最優先する", () => {
    process.env.APP_URL = "https://primary.example.com";
    process.env.NEXTAUTH_URL = "https://fallback.example.com";

    expect(getAppUrl()).toBe("https://primary.example.com");
  });

  it("末尾のスラッシュを取り除く", () => {
    process.env.NEXTAUTH_URL = "https://example.com/dev/misekin/";

    expect(getAppUrl()).toBe("https://example.com/dev/misekin");
  });

  it("どれも無ければローカル開発用のURLになる", () => {
    expect(getAppUrl()).toBe("http://localhost:3000");
  });
});

describe("buildClockUrl", () => {
  it("basePath を含んだ打刻URLを組み立てる", () => {
    process.env.NEXTAUTH_URL = "https://example.com/dev/misekin";

    expect(buildClockUrl("abc123")).toBe(
      "https://example.com/dev/misekin/clock/abc123"
    );
  });
});
