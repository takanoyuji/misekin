FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && \
    apt-get install -y openssl --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# ビルド時のダミー環境変数（generate/build に DB 接続不要）
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV AUTH_SECRET="placeholder-build-time-only"
ENV NEXT_PUBLIC_BASE_PATH="/dev/misekin"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=2048

RUN npx prisma generate
RUN npm run build

# スキーマSQLはprisma/schema.sqlにコミット済み

# ---- runner ----
FROM node:20-slim
WORKDIR /app

RUN apt-get update && \
    apt-get install -y openssl postgresql-client --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# standalone build の成果物をコピー
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 初回DBスキーマ初期化用SQL と、既存DBへの差分適用用SQL
COPY --from=builder /app/prisma/schema.sql ./schema.sql
COPY --from=builder /app/prisma/migrations.sql ./migrations.sql

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# DBが未初期化の場合のみスキーマを適用してからサーバー起動
# DBが未初期化の場合のみスキーマ全体を適用する
# (テーブル名は @@map により users / staff などの複数形。以前は "User" を見ていたため
#  判定が常に失敗し、起動のたびに schema.sql 全体が流れてエラーログを大量に出していた)
# 初期化済みの場合は、追記型のマイグレーション文だけを流して差分を反映する
CMD ["sh", "-c", "if psql \"$DATABASE_URL\" -c 'SELECT 1 FROM users LIMIT 1' > /dev/null 2>&1; then psql \"$DATABASE_URL\" -v ON_ERROR_STOP=0 -f /app/migrations.sql; else psql \"$DATABASE_URL\" -f /app/schema.sql; fi; node server.js"]
