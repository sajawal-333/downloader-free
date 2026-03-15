import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import YTDlpWrapModule from 'yt-dlp-wrap';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];

const isValidUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const isSafeUrl = (url) => {
  try {
    const { hostname } = new URL(url);
    if (BLOCKED_HOSTS.includes(hostname)) return false;
    if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) return false;
    return true;
  } catch {
    return false;
  }
};

app.use(express.json({ limit: '1mb' }));
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 40),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down and try again shortly.' }
});

app.use('/api', limiter);

const TMP_DIR = path.join(__dirname, 'tmp');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

const YTDlpWrap = YTDlpWrapModule?.default || YTDlpWrapModule;
const ytDlp = new YTDlpWrap();

const downloadJobs = new Map();

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/metadata', async (req, res) => {
  const { url } = req.body || {};
  if (!url || !isValidUrl(url) || !isSafeUrl(url)) {
    return res.status(400).json({ message: 'Please provide a valid, public media URL.' });
  }
  try {
    const info = await ytDlp.getVideoInfo(url);
    res.json({
      title: info.title,
      author: info.uploader,
      duration: info.duration,
      thumbnail: info.thumbnail,
      platform: info.extractor_key
    });
  } catch (err) {
    console.error('metadata error', err?.message || err);
    res.status(500).json({
      message:
        'Could not read this media. It may be private, region-locked, or temporarily unavailable.'
    });
  }
});

const buildFormatSelector = (choice) => {
  switch (choice) {
    case '1080p':
      return 'bestvideo[height<=1080]+bestaudio/best[height<=1080]';
    case '720p':
      return 'bestvideo[height<=720]+bestaudio/best[height<=720]';
    case '480p':
      return 'bestvideo[height<=480]+bestaudio/best[height<=480]';
    case 'mp3':
      return 'bestaudio/best';
    default:
      return 'bestvideo+bestaudio/best';
  }
};

app.post('/api/download', async (req, res) => {
  const { url, format } = req.body || {};
  if (!url || !isValidUrl(url) || !isSafeUrl(url)) {
    return res.status(400).json({ message: 'Please provide a valid, public media URL.' });
  }

  const maxFileSizeMb = Number(process.env.MAX_FILESIZE_MB || 250);
  const jobId = uuidv4();

  const outTemplate = path.join(TMP_DIR, `${jobId}.%(ext)s`);
  const args = [
    url,
    '-f',
    buildFormatSelector(format),
    '--merge-output-format',
    format === 'mp3' ? 'mp3' : 'mp4',
    '-o',
    outTemplate,
    '--no-playlist',
    '--socket-timeout',
    '30',
    '--max-filesize',
    `${maxFileSizeMb}m`
  ];

  const job = {
    id: jobId,
    status: 'running',
    progress: 0,
    filename: null,
    error: null
  };
  downloadJobs.set(jobId, job);

  const child = ytDlp.exec(args);

  child.on('progress', (progress) => {
    const current = downloadJobs.get(jobId);
    if (!current || current.status !== 'running') return;
    const percent = typeof progress.percent === 'number' ? progress.percent : 0;
    current.progress = Math.max(0, Math.min(100, percent));
    downloadJobs.set(jobId, current);
  });

  child.on('error', (err) => {
    const current = downloadJobs.get(jobId);
    if (!current) return;
    current.status = 'error';
    current.error =
      err?.message || 'Download failed. Try a different link or format.';
    downloadJobs.set(jobId, current);
  });

  child.on('close', (code) => {
    const current = downloadJobs.get(jobId);
    if (!current) return;
    if (code !== 0) {
      current.status = 'error';
      current.error =
        current.error ||
        'Download process exited unexpectedly. Please try again.';
      downloadJobs.set(jobId, current);
      return;
    }
    const files = fs
      .readdirSync(TMP_DIR)
      .filter((f) => f.startsWith(jobId));
    if (!files.length) {
      current.status = 'error';
      current.error = 'Download finished but file was not found.';
      downloadJobs.set(jobId, current);
      return;
    }
    current.status = 'done';
    current.progress = 100;
    current.filename = files[0];
    downloadJobs.set(jobId, current);
  });

  res.json({ jobId });
});

app.get('/api/progress/:id', (req, res) => {
  const job = downloadJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ status: 'not_found' });
  }
  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error
  });
});

app.get('/api/file/:id', (req, res) => {
  const job = downloadJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ message: 'Download not found.' });
  }
  if (job.status !== 'done' || !job.filename) {
    return res.status(400).json({ message: 'File is not ready yet.' });
  }

  const filePath = path.join(TMP_DIR, job.filename);
  if (!fs.existsSync(filePath)) {
    downloadJobs.delete(job.id);
    return res.status(404).json({ message: 'File has expired.' });
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);

  const stream = fs.createReadStream(filePath);
  stream.on('close', () => {
    fs.unlink(filePath, () => {});
    downloadJobs.delete(job.id);
  });
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.end();
    }
    fs.unlink(filePath, () => {});
    downloadJobs.delete(job.id);
  });
  stream.pipe(res);
});

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }
}

app.listen(PORT, () => {
  console.log(`Downloader backend listening on http://localhost:${PORT}`);
});

