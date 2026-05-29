ARG NODE_IMAGE=public.ecr.aws/docker/library/node:24.15.0-alpine

########## Builder stage ##########
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

ENV NPM_CONFIG_LOGLEVEL=error \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

COPY package*.json ./

RUN npm ci && \
    npm cache clean --force

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build

########## Runtime stage ##########
FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=error

WORKDIR /app

RUN apk update && apk upgrade && \
    apk add --no-cache wget && \
    rm -rf /var/cache/apk/* && \
    addgroup -g 1001 -S nodejs && \
    adduser -S fastify -u 1001 -G nodejs && \
    mkdir -p /app/logs && \
    chmod 755 /app/logs

COPY package*.json ./

RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force && \
    rm -rf ~/.npm

COPY --from=builder /app/dist ./dist

RUN chown -R fastify:nodejs /app

USER fastify

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

EXPOSE 3000

CMD ["node", "dist/infra/http/server.js"]
