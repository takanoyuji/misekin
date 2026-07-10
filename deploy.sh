#!/bin/bash
set -e

REMOTE_USER="ubuntu"
REMOTE_HOST="219.94.244.166"
REMOTE_DIR="/opt/apps/misekin"
SSH_KEY="~/.ssh/id_ed25519_xinglang_deploy"

echo "==> みせ勤 デプロイ開始"

# リモートディレクトリ作成
ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_DIR"

# ファイル同期（node_modules と .next と .git を除外）
echo "==> ファイル同期中..."
rsync -az --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.env*' \
  --exclude='tests' \
  --exclude='*.md' \
  -e "ssh -i $SSH_KEY" \
  ./ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

echo "==> Dockerイメージをビルド中（サーバー上）..."
ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && docker compose build --no-cache"

echo "==> コンテナ起動..."
ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && docker compose up -d"

echo "==> デプロイ完了"
echo "    URL: https://dataraw.jp/dev/misekin"
