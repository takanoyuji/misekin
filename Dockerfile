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

# 初回DBスキーマ初期化用SQL
COPY --from=builder /app/prisma/schema.sql ./schema.sql

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# DBが未初期化の場合のみスキーマを適用してからサーバー起動
CMD ["sh", "-c", "psql \"$DATABASE_URL\" -c \"SELECT 1 FROM \\\"User\\\" LIMIT 1\" > /dev/null 2>&1 || psql \"$DATABASE_URL\" -f /app/schema.sql && node server.js"]
