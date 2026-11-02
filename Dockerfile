# Render's default path is ./Dockerfile at the repo root (build context = this folder).
# Same image as apps/worker/Dockerfile.
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 \
      libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 libcups2 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.34.9
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter @minkflow/worker...
RUN cd packages/render && node --import tsx -e "import('@remotion/renderer').then(r => r.ensureBrowser())"

ENV NODE_ENV=production
USER node
EXPOSE 8081
CMD ["pnpm", "--filter", "@minkflow/worker", "start"]
