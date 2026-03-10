FROM node:22-alpine

WORKDIR /app

# Install production dependencies (--ignore-scripts skips native builds
# like node-pty which are only needed by the host-side runner, not this container)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built assets (frontend + compiled server)
COPY dist/ ./dist/

EXPOSE 3100

CMD ["node", "dist/server/index.js"]
