# syntax=docker/dockerfile:1

# Debian-based (not alpine): onnxruntime-node and the ffmpeg-static binary are
# prebuilt against glibc and will not run on musl.
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Install with scripts enabled — ffmpeg-static downloads its binary and
# onnxruntime-node unpacks its native libs in postinstall.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# Bake the model into the image. This populates /app/.model-cache (the
# recognizer's env.cacheDir is <dist>/../.model-cache) and runs one inference
# pass, so the image ships with the weights and a proven-working ONNX runtime.
# Without this the first request after every cold start would re-download
# ~300MB from the HuggingFace Hub onto an ephemeral disk.
RUN node scripts/prefetch-model.js

# Drop devDependencies but keep the built native artifacts (ffmpeg binary,
# onnxruntime .so files) exactly as installed, instead of reinstalling them.
RUN npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production
ENV PORT=5055
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/.model-cache ./.model-cache
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 5055

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5055)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
