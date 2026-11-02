FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat
RUN npm install -g pnpm

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @evoc/database db:generate
RUN pnpm --filter @evoc/api build

EXPOSE 4000
CMD ["pnpm", "--filter", "@evoc/api", "start"]
