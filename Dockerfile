FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build -- --webpack

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S journal && adduser -S journal -G journal
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma.config.js ./prisma.config.js
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh
RUN chown -R journal:journal /app
USER journal
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
