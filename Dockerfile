# web-terminal — browser terminal (PTY + WebSocket + auth)
#
# Debian slim, NOT Alpine: node-pty ships prebuilt binaries against glibc, and
# Alpine's musl would force a native rebuild (and often fail). bookworm-slim has
# glibc, so `npm ci` uses the prebuild and no compiler is needed.
FROM node:20-bookworm-slim

# bash is the default shell we spawn; ca-certificates for the Google OAuth
# token exchange; tini as PID 1 so signals and zombie PTYs are reaped cleanly.
RUN apt-get update \
 && apt-get install -y --no-install-recommends bash ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for layer caching. Dev deps are needed for the client build.
COPY package.json package-lock.json ./
RUN npm ci

# App source, then build the browser bundle into public/.
COPY . .
RUN npm run build \
 && npm prune --omit=dev

# Persist per-instance data (prefs, workspaces, logs) on a volume.
RUN mkdir -p /data && chown -R node:node /app /data
ENV WEB_TERMINAL_LOG_DIR=/data
VOLUME /data

# Drop root: the shells you open run as this user.
USER node

ENV PORT=7681 BIND=0.0.0.0
EXPOSE 7681

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||7681)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
