FROM node:20-slim

WORKDIR /app

RUN apt-get update && \
  apt-get install -y --no-install-recommends python3 python3-pip ffmpeg ca-certificates && \
  pip3 install --no-cache-dir yt-dlp --break-system-packages && \
  ln -s /usr/bin/python3 /usr/bin/python && \
  rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install ALL dependencies (including devDependencies like vite)
RUN npm install

COPY . .

# Build the frontend
RUN npm run build

# Prune devDependencies to keep the image small
RUN npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/index.js"]

