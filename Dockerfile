FROM node:22-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@11.9.0
COPY . .
RUN pnpm install --frozen-lockfile \
    && pnpm --filter @reproloop/web build \
    && pnpm --filter @reproloop/worker build \
    && chown -R node:node /app/apps/web/.next \
    && install -d -o node -g node /data

ENV NODE_ENV=production
USER node
ENTRYPOINT ["/bin/sh", "/app/deploy/start-container.sh"]
CMD ["pnpm", "--filter", "@reproloop/web", "start", "--hostname", "0.0.0.0"]
