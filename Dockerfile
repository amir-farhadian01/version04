FROM node:20-alpine AS base
WORKDIR /app

# Install OpenSSL (required by Prisma on Alpine)
RUN apk add --no-cache openssl

# Install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Generate Prisma Client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy all source
COPY . .

# ─── Development stage ────────────────────────────────────────────────────────
FROM base AS development
ENV NODE_ENV=development
EXPOSE 8080
CMD ["npm", "run", "dev"]

# ─── Build stage ─────────────────────────────────────────────────────────────
FROM base AS builder
ENV NODE_ENV=production
RUN npm run build

# ─── Production stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY prisma ./prisma/
# Copy pre-generated client from base (avoids npx downloading latest prisma)
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/tsconfig.json ./

RUN npm install tsx --save-dev

EXPOSE 8080
CMD sh -c "npx prisma migrate deploy && npm run dev"
