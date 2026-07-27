import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: [
      // 画像インポート（Verticalレジストリが静的インポートしている）をスタブに寄せる
      {
        find: /^.*\.(jpg|jpeg|png|webp|avif|gif)$/,
        replacement: resolve(__dirname, "./tests/stubs/image.ts"),
      },
      { find: "@", replacement: resolve(__dirname, "./src") },
    ],
  },
});
