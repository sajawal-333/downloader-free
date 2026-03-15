FROM node:20-slim

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

RUN apt-get update && \
  apt-get install -y --no-install-recommends python3 python3-pip ffmpeg ca-certificates && \
  pip3 install --no-cache-dir yt-dlp --break-system-packages && \
  rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN npm install --ignore-scripts && npm run build

EXPOSE 3000

CMD ["node", "server/index.js"]

