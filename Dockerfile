# syntax=docker/dockerfile:1

# ---- Stage 1: build the Vite/React SPA ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first for better layer caching (only re-runs if lock changes)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source. .env MUST be present in the build context:
# VITE_* vars are inlined into the bundle at build time (see .dockerignore).
COPY . .
RUN npm run build

# ---- Stage 2: runtime — nginx serving the static dist ----
FROM nginx:alpine AS runtime

# SPA fallback + gzip + asset caching (TLS is terminated by Traefik upstream)
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Keep hashed chunks from previous releases in a persistent volume. An open
# tab can legitimately request an older Vite hash for a few minutes after a
# deploy; retaining the files avoids a transient dynamic-import 404. The
# entrypoint copies this release into the mounted directory without deleting
# files from previous releases.
COPY --from=build /app/dist/assets /opt/ceresbi-assets
COPY docker/web-assets-entrypoint.sh /docker-entrypoint.d/20-ceresbi-assets.sh
RUN chmod +x /docker-entrypoint.d/20-ceresbi-assets.sh

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
