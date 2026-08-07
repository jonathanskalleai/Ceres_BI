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

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
