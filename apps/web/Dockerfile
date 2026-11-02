FROM node:22-alpine
WORKDIR /app

RUN npm install -g pnpm

COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:4000}

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @evoc/web build

EXPOSE 3000
CMD ["pnpm", "--filter", "@evoc/web", "start"]
