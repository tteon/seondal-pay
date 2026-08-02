# Build stage
FROM node:24-slim AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY src/ ./src/
RUN npm run build

# Production stage
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/public ./dist/public
COPY merchant-keypair.json ./merchant-keypair.json
COPY merchant-keypair.json ./dist/merchant-keypair.json
COPY merchant-keypair.json /merchant-keypair.json
COPY gcp-key.json ./gcp-key.json
COPY gcp-key.json ./dist/gcp-key.json
COPY gcp-key.json /gcp-key.json

EXPOSE 3000
CMD ["node", "dist/server.js"]
