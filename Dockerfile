# Runs anywhere Docker runs, including older Linux servers that can't install
# a modern Node directly.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_BUILDER_NAME=""
ARG NEXT_PUBLIC_BUILDER_URL=""
ENV NEXT_PUBLIC_BUILDER_NAME=$NEXT_PUBLIC_BUILDER_NAME \
    NEXT_PUBLIC_BUILDER_URL=$NEXT_PUBLIC_BUILDER_URL
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
