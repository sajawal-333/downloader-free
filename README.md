## Vortex Social Downloader

**Stack**

- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, yt-dlp-wrap, ffmpeg

### Development

1. Install dependencies:

```bash
npm install
```

2. Make sure `yt-dlp` and `ffmpeg` are installed and available on your system `PATH`.

3. Run dev servers (frontend + backend together):

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: proxied via Vite to `http://localhost:4000`

### Production build

```bash
npm run build
NODE_ENV=production PORT=4000 node server/index.js
```

### Environment variables (optional)

- `PORT` — backend port (default: `4000`)
- `ALLOWED_ORIGINS` — comma-separated list of allowed origins for CORS (default: `*`)
- `RATE_LIMIT_MAX` — requests per 15 min window (default: `40`)
- `MAX_FILESIZE_MB` — maximum download size (default: `250`)

### Deploying to Railway (Docker)

This repo includes a `Dockerfile` that bundles:
- Node.js app
- Built React frontend
- `yt-dlp` (via Python)
- `ffmpeg`

Basic steps:

1. Push this project to a GitHub repo.
2. In Railway:
   - Create a new project → “Deploy from GitHub repository”.
   - Select your repo.
   - Railway will detect the `Dockerfile` and build it.
3. Set environment variables in Railway (optional but recommended):
   - `PORT=3000` (Dockerfile default)
   - `ALLOWED_ORIGINS=https://your-frontend-domain.com` (or `*` while testing)
   - `MAX_FILESIZE_MB`, `RATE_LIMIT_MAX` as needed.

Railway will expose a public URL; all routes (frontend + `/api/*`) are served from that single service.


