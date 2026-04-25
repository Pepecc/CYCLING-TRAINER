FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS production
WORKDIR /app
COPY package*.json ./
# Copia node_modules ya compilados del builder en vez de reinstalar
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "dist/infrastructure/http/server.js"]