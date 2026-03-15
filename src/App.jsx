import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const STATES = {
  IDLE: 'idle',
  TYPING: 'typing',
  LOADING: 'loading',
  READY: 'ready',
  DOWNLOADING: 'downloading',
  ERROR: 'error'
};

const PLATFORM_CONFIG = {
  youtube: { label: 'YouTube', color: '#FF0000' },
  instagram: { label: 'Instagram', color: '#E1306C' },
  tiktok: { label: 'TikTok', color: '#25F4EE' },
  twitter: { label: 'Twitter / X', color: '#1DA1F2' },
  facebook: { label: 'Facebook', color: '#1877F2' },
  reddit: { label: 'Reddit', color: '#FF4500' },
  pinterest: { label: 'Pinterest', color: '#E60023' },
  vimeo: { label: 'Vimeo', color: '#1ab7ea' },
  soundcloud: { label: 'SoundCloud', color: '#ff7700' },
  twitch: { label: 'Twitch', color: '#9146FF' }
};

const detectPlatform = (url) => {
  if (!url) return null;
  const patterns = {
    youtube: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
    instagram: /instagram\.com\/(p|reel|tv|stories)\//,
    tiktok: /tiktok\.com\/@[\w.]+\/video\/\d+/,
    twitter: /(?:twitter|x)\.com\/\w+\/status\/\d+/,
    facebook: /facebook\.com\/.+\/(videos|reel)\//,
    reddit: /reddit\.com\/r\/\w+\/comments\//,
    pinterest: /pinterest\.com\/pin\/\d+/,
    vimeo: /vimeo\.com\/\d+/,
    soundcloud: /soundcloud\.com\//,
    twitch: /twitch\.tv\//
  };
  for (const [platform, regex] of Object.entries(patterns)) {
    if (regex.test(url)) return platform;
  }
  return null;
};

const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return '—';
  const s = Number(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const loadHistory = () => {
  try {
    const raw = localStorage.getItem('downloader-history');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const persistHistory = (items) => {
  try {
    localStorage.setItem('downloader-history', JSON.stringify(items.slice(0, 5)));
  } catch {
    // ignore
  }
};

const DownloadBox = ({
  url,
  onChangeUrl,
  onSubmit,
  state,
  platform,
  onPaste,
  disabled
}) => {
  const handlePasteClick = async () => {
    try {
      await onPaste();
    } catch {
      // noop; error handled by caller
    }
  };

  return (
    <div className="space-y-4">
      <label
        htmlFor="url"
        className="text-xs uppercase tracking-[0.18em] text-slate-300 font-mono"
      >
        Paste social media URL
      </label>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            id="url"
            value={url}
            onChange={(e) => onChangeUrl(e.target.value)}
            placeholder="https://youtu.be/… or https://www.instagram.com/reel/…"
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:border-neon-cyan/80 focus:ring-2 focus:ring-neon-cyan/50 transition-all font-mono"
            autoComplete="off"
            spellCheck={false}
          />
          <AnimatePresence>
            {platform && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute -bottom-6 left-1 text-[10px] uppercase tracking-[0.18em] text-slate-400 font-mono"
              >
                Platform detected
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={handlePasteClick}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
          aria-label="Paste URL from clipboard"
        >
          <span>Paste</span>
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!url.trim() || disabled}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[11px] uppercase tracking-[0.2em] font-mono hover:bg-white/10 transition disabled:opacity-40"
        >
          <span>{state === STATES.LOADING ? 'Fetching…' : 'Analyze'}</span>
        </button>
        <button
          type="button"
          onClick={() => onSubmit({ quick: true })}
          disabled={!url.trim() || disabled}
          className="inline-flex items-center gap-2 rounded-xl bg-neon-cyan text-black px-4 py-2.5 text-[11px] uppercase tracking-[0.2em] font-mono shadow-glow hover:shadow-neon-cyan/40 hover:-translate-y-0.5 transition disabled:opacity-40 disabled:shadow-none disabled:translate-y-0"
        >
          <span>⚡ Quick</span>
        </button>
      </div>
    </div>
  );
};

const PlatformBadge = ({ platform }) => {
  if (!platform) return null;
  const cfg = PLATFORM_CONFIG[platform];
  if (!cfg) return null;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="inline-flex items-center gap-2 rounded-full bg-black/50 border border-white/10 px-3 py-1 mt-4"
    >
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-black"
        style={{ backgroundColor: cfg.color }}
      >
        {cfg.label[0]}
      </span>
      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-200 font-mono">
        {cfg.label}
      </span>
    </motion.div>
  );
};

const MediaPreview = ({ meta, loading }) => {
  if (!meta && !loading) return null;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-4 flex gap-4"
    >
      <div className="w-32 h-20 rounded-xl overflow-hidden bg-slate-800/60 flex-shrink-0">
        {loading ? (
          <div className="h-full w-full animate-pulse bg-gradient-to-br from-slate-700/60 to-slate-900/60" />
        ) : meta?.thumbnail ? (
          <img
            src={meta.thumbnail}
            alt={meta.title || 'Media thumbnail'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-slate-500 font-mono">
            No preview
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="space-y-1">
          <div className="h-5">
            {loading ? (
              <div className="h-4 w-3/4 rounded bg-slate-700/60 animate-pulse" />
            ) : (
              <p className="text-sm font-semibold text-slate-50 font-heading truncate">
                {meta?.title || 'Media title'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
            {loading ? (
              <>
                <div className="h-3 w-24 rounded bg-slate-800/70 animate-pulse" />
                <div className="h-3 w-16 rounded bg-slate-800/70 animate-pulse" />
              </>
            ) : (
              <>
                <span className="truncate max-w-[60%]">
                  {meta?.author || 'Author'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-slate-500" />
                  {formatDuration(meta?.duration)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const FORMAT_OPTIONS = [
  { id: '1080p', label: 'Video 1080p', description: 'MP4, best available 1080p', target: 'video_1080p' },
  { id: '720p', label: 'Video 720p', description: 'MP4, balanced for most screens', target: 'video_720p' },
  { id: '480p', label: 'Video 480p', description: 'Smaller file, faster download', target: 'video_480p' },
  { id: 'mp3', label: 'Audio MP3', description: 'Audio-only extract', target: 'audio_mp3' }
];

const FormatSelector = ({ value, onChange, disabled }) => {
  return (
    <div className="mt-6">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300 font-mono mb-3">
        Output format
      </p>
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
        role="radiogroup"
        aria-label="Choose download format"
      >
        {FORMAT_OPTIONS.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              disabled={disabled}
              role="radio"
              aria-checked={active}
              className={`group flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70 ${active
                  ? 'border-neon-cyan/80 bg-neon-cyan/10 shadow-glow'
                  : 'border-white/10 bg-black/30 hover:border-neon-cyan/60 hover:bg-neon-cyan/5'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <span
                className={`mt-1 h-3 w-3 rounded-full border flex items-center justify-center ${active
                    ? 'border-neon-cyan bg-neon-cyan/10'
                    : 'border-slate-500 bg-black/40 group-hover:border-neon-cyan/80'
                  }`}
              >
                {active && <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan" />}
              </span>
              <span className="flex-1">
                <span className="block text-[11px] uppercase tracking-[0.18em] text-slate-100 font-mono">
                  {opt.label}
                </span>
                <span className="block text-xs text-slate-400 mt-1">
                  {opt.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const DownloadButton = ({ disabled, state, progress, onClick }) => {
  const label = useMemo(() => {
    if (state === STATES.DOWNLOADING) return 'Downloading…';
    if (state === STATES.LOADING) return 'Preparing…';
    return 'Download';
  }, [state]);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`relative w-full overflow-hidden rounded-2xl bg-neon-cyan text-black py-3.5 text-[12px] uppercase tracking-[0.28em] font-mono shadow-glow transition transform hover:-translate-y-0.5 hover:shadow-neon-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80 disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 ${!disabled && state === STATES.READY ? 'animate-pulse-glow' : ''
          }`}
      >
        <div
          className="absolute inset-0 bg-gradient-to-r from-black/10 via-black/25 to-black/5"
          aria-hidden="true"
        />
        {state === STATES.DOWNLOADING && (
          <motion.div
            className="absolute inset-y-0 left-0 bg-black/20"
            style={{ width: `${Math.min(progress || 5, 100)}%` }}
            initial={{ width: '0%' }}
            animate={{ width: `${Math.min(progress || 5, 100)}%` }}
            transition={{ ease: 'easeOut', duration: 0.3 }}
          />
        )}
        <span className="relative z-10">{label}</span>
      </button>
      {state === STATES.DOWNLOADING && (
        <p
          className="mt-2 text-[11px] text-slate-400 font-mono text-center"
          role="status"
        >
          {progress != null ? `Progress: ${Math.floor(progress)}%` : 'Starting download…'}
        </p>
      )}
    </div>
  );
};

const HistoryList = ({ items }) => {
  if (!items?.length) return null;
  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400 font-mono">
          Recent downloads
        </p>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 px-3 py-2.5 text-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-black flex-shrink-0"
                style={{
                  backgroundColor:
                    PLATFORM_CONFIG[item.platform]?.color || 'rgba(148,163,184,0.85)'
                }}
              >
                {PLATFORM_CONFIG[item.platform]?.label[0] ?? '●'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] text-slate-100 font-heading">
                  {item.title || 'Untitled media'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {FORMAT_OPTIONS.find((f) => f.id === item.format)?.label ?? '—'} ·{' '}
                  {new Date(item.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-neon-cyan hover:underline font-mono ml-3 flex-shrink-0"
            >
              Open
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

const SupportedSites = () => {
  const sites = [
    'YouTube',
    'Instagram',
    'TikTok',
    'Twitter / X',
    'Facebook',
    'Reddit',
    'Pinterest',
    'Vimeo',
    'SoundCloud',
    'Twitch'
  ];
  return (
    <div className="mt-16 mb-6">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-mono mb-3 text-center">
        Optimized for
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-w-3xl mx-auto">
        {sites.map((site) => (
          <div
            key={site}
            className="flex items-center justify-center rounded-full border border-white/5 bg-black/40 px-3 py-1.5 text-[11px] text-slate-200 font-mono"
          >
            {site}
          </div>
        ))}
      </div>
    </div>
  );
};

const App = () => {
  const [url, setUrl] = useState('');
  const [state, setState] = useState(STATES.IDLE);
  const [platform, setPlatform] = useState(null);
  const [meta, setMeta] = useState(null);
  const [format, setFormat] = useState('1080p');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    const p = detectPlatform(url.trim());
    setPlatform(p);
    if (!url.trim()) {
      setState(STATES.IDLE);
    } else if (state === STATES.IDLE) {
      setState(STATES.TYPING);
    }
  }, [url]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
      }
    } catch {
      alert('Clipboard access denied. Please paste manually.');
    }
  }, []);

  const fetchMetadata = async (options = {}) => {
    if (!url.trim()) return;
    setError('');
    setMeta(null);
    setState(STATES.LOADING);
    try {
      if (options.quick) {
        // Skip metadata wait, go straight to download
        handleDownload();
        return;
      }
      const { data } = await axios.post('/api/metadata', { url: url.trim() });
      setMeta(data);
      setState(STATES.READY);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        'We could not fetch this media. It may be private or unsupported.'
      );
      setState(STATES.ERROR);
    }
  };

  const triggerFileDownload = (blob, filename) => {
    const urlObj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlObj;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(urlObj);
  };

  const handleDownload = async () => {
    if (!url.trim()) return;
    setError('');
    setState(STATES.DOWNLOADING);
    setProgress(0);

    try {
      const { data } = await axios.post('/api/download', {
        url: url.trim(),
        format
      });
      const jobId = data?.jobId;
      if (!jobId) {
        throw new Error('No download job id returned.');
      }

      const poll = async () => {
        try {
          const res = await axios.get(`/api/progress/${jobId}`);
          if (res.data?.status === 'running') {
            const pct = typeof res.data.progress === 'number' ? res.data.progress : 0;
            setProgress(Math.max(0, Math.min(100, pct)));
            setTimeout(poll, 900);
          } else if (res.data?.status === 'done') {
            setProgress(100);
            const fileRes = await axios.get(`/api/file/${jobId}`, {
              responseType: 'blob'
            });
            const filenameSafe =
              (meta?.title || 'download')
                .replace(/[\\/:*?"<>|]+/g, '')
                .slice(0, 80) || 'download';
            const ext = format === 'mp3' ? 'mp3' : 'mp4';
            triggerFileDownload(fileRes.data, `${filenameSafe}.${ext}`);

            const entry = {
              id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              title: meta?.title || url.trim(),
              url: url.trim(),
              platform: platform || 'unknown',
              format,
              timestamp: Date.now()
            };
            const next = [entry, ...history].slice(0, 5);
            setHistory(next);
            persistHistory(next);

            setTimeout(() => {
              setState(STATES.READY);
              setProgress(null);
            }, 600);
          } else if (res.data?.status === 'error') {
            setError(
              res.data?.error ||
              'Download failed. Please try again or use a different format.'
            );
            setState(STATES.ERROR);
            setProgress(null);
          } else {
            setTimeout(poll, 1000);
          }
        } catch {
          setError('Connection lost while downloading. Please try again.');
          setState(STATES.ERROR);
          setProgress(null);
        }
      };

      poll();
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Download failed to start. Please try again.'
      );
      setState(STATES.ERROR);
      setProgress(null);
    }
  };

  const showSkeleton = state === STATES.LOADING;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050509] text-slate-100">
      <div className="gradient-mesh" />
      <div className="grain-overlay" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-4xl">
          <header className="mb-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400 font-mono mb-4">
                Vortex Social Downloader
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-semibold tracking-tight text-slate-50">
                One URL.
                <span className="text-neon-cyan"> All the media.</span>
              </h1>
              <p className="mt-4 text-sm text-slate-400 max-w-xl mx-auto font-mono">
                Paste any public social link and get a clean, high-quality download in seconds.
                No ads, no clutter — just signal.
              </p>
            </motion.div>
          </header>

          <motion.main
            className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-3xl px-5 py-6 sm:px-7 sm:py-7 shadow-[0_40px_120px_rgba(0,0,0,0.75)]"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <DownloadBox
              url={url}
              onChangeUrl={setUrl}
              onSubmit={fetchMetadata}
              state={state}
              platform={platform}
              onPaste={handlePaste}
              disabled={state === STATES.LOADING || state === STATES.DOWNLOADING}
            />

            <AnimatePresence>
              <PlatformBadge platform={platform} />
            </AnimatePresence>

            <MediaPreview meta={meta} loading={showSkeleton} />

            <FormatSelector
              value={format}
              onChange={setFormat}
              disabled={state === STATES.LOADING || state === STATES.DOWNLOADING}
            />

            <DownloadButton
              disabled={
                !url.trim() ||
                state === STATES.LOADING ||
                (state !== STATES.READY && state !== STATES.ERROR && state !== STATES.DOWNLOADING)
              }
              state={state}
              progress={progress}
              onClick={handleDownload}
            />

            <AnimatePresence>
              {state === STATES.ERROR && error && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="mt-6 rounded-2xl border border-neon-pink/40 bg-neon-pink/10 px-4 py-3 flex items-start gap-3"
                  role="alert"
                >
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-neon-pink flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-neon-pink font-mono uppercase tracking-[0.18em] mb-1">
                      Something went wrong
                    </p>
                    <p className="text-xs text-slate-100">{error}</p>
                  </div>
                  <button
                    type="button"
                    className="text-[11px] text-slate-200 underline-offset-4 hover:underline font-mono"
                    onClick={() => {
                      setError('');
                      setState(url.trim() ? STATES.TYPING : STATES.IDLE);
                    }}
                  >
                    Retry
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="mt-6 text-[10px] text-slate-500 font-mono text-center">
              Only download content you have rights to. We do not cache or store media — everything
              is processed ephemerally.
            </p>
          </motion.main>

          <HistoryList items={history} />
          <SupportedSites />
        </div>
      </div>
    </div>
  );
};

export default App;

