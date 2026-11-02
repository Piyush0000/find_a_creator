FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat
RUN npm install -g pnpm

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @evoc/database db:generate
RUN pnpm --filter @evoc/worker build

CMD ["pnpm", "--filter", "@evoc/worker", "start"]
