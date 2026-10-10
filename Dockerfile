FROM node:22-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
# The web pixel extension is an npm workspace: its package.json must be here before `npm ci`
# so its dependency (@shopify/web-pixels-extension) gets installed for `shopify app deploy`.
COPY extensions/ai-pixel/package.json ./extensions/ai-pixel/

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN npm run build

CMD ["npm", "run", "docker-start"]
