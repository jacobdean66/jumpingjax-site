FROM node:24-bookworm-slim
WORKDIR /work
ENV NEXT_TELEMETRY_DISABLED=1 CI=true
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN --mount=type=cache,id=jjx-agent-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --store-dir=/pnpm/store --fetch-timeout=180000 --network-concurrency=8
COPY . .
CMD ["npm", "run", "test:agent-warnings"]
