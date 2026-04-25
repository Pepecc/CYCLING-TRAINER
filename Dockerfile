FROM node:22-slim AS builder
WORKDIR /app

# Build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim AS production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "dist/infrastructure/http/server.js"]