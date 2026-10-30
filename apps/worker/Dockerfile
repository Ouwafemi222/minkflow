# Render/AI worker image (Railway). Build from the repository root:
#   docker build -f apps/worker/Dockerfile -t minkflow-worker .
# Chromium runtime libraries follow Remotion's Linux guidance; TO VERIFY against the current Remotion docs (V-14).
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 \
      libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 libcups2 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.34.9
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter @minkflow/worker...
# Pre-download Chrome Headless Shell at build time so the first render does not stall.
RUN cd packages/render && node --import tsx -e "import('@remotion/renderer').then(r => r.ensureBrowser())"

ENV NODE_ENV=production
USER node
EXPOSE 8081
CMD ["pnpm", "--filter", "@minkflow/worker", "start"]
