// ytdlp.js — Fixed: removed --impersonate, uses extractor-args instead
// Requires: pip install yt-dlp curl-cffi --break-system-packages

import YTDlpWrap from 'yt-dlp-wrap';
import fs from 'fs';
import path from 'path';

const ytDlp = new YTDlpWrap(process.env.YTDLP_PATH || 'yt-dlp');

const getCookieArgs = () => {
  const cookiesFile = process.env.COOKIES_FILE || path.join(process.cwd(), 'cookies.txt');
  if (fs.existsSync(cookiesFile) && fs.statSync(cookiesFile).size > 0) {
    return ['--cookies', cookiesFile];
  }
  if (process.env.YTDLP_BROWSER) {
    return ['--cookies-from-browser', process.env.YTDLP_BROWSER];
  }
  return [];
};

// --impersonate is REMOVED from here.
// Use YTDLP_IMPERSONATE=chrome in .env ONLY after running:
//   pip install curl-cffi --break-system-packages
const getImpersonateArgs = () =>
  process.env.YTDLP_IMPERSONATE ? ['--impersonate', process.env.YTDLP_IMPERSONATE] : [];

// Works WITHOUT curl-cffi -- tells YouTube we are iOS/Android app
const BYPASS_ARGS = [
  '--extractor-args', 'youtube:player_client=ios,android,web_embedded',
  '--add-header', 'User-Agent:Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  '--add-header', 'Accept-Language:en-US,en;q=0.9',
  '--no-check-certificates',
  '--no-cache-dir',
  '--no-warnings',
  '--sleep-requests', '1',
  '--sleep-interval', '2',
  '--max-sleep-interval', '5',
  '--retries', '10',
  '--fragment-retries', '10',
];

// Strip &list= &start_radio= &pp= from URL
// These cause yt-dlp to try fetching the whole playlist → metadata error
const stripPlaylistParams = (url) => {
  try {
    const u = new URL(url);
    ['list', 'start_radio', 'pp', 'index'].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch { return url; }
};

const sanitizeInfo = (info) => ({
  title:     info.title,
  author:    info.uploader || info.channel,
  thumbnail: info.thumbnail,
  duration:  info.duration,
  platform:  info.extractor_key,
  formats: (info.formats || [])
    .filter(f => f.url && (f.vcodec !== 'none' || f.acodec !== 'none'))
    .map(f => ({
      id:         f.format_id,
      label:      f.format_note || f.resolution || 'unknown',
      ext:        f.ext,
      filesize:   f.filesize,
      hasVideo:   f.vcodec !== 'none',
      hasAudio:   f.acodec !== 'none',
      resolution: f.resolution,
    }))
    .slice(-10),
});

const formatError = (err) => {
  const msg = err.message || '';
  if (msg.includes('Impersonate target') && msg.includes('not available'))
    return new Error('curl-cffi missing. Run: pip install curl-cffi --break-system-packages  OR remove YTDLP_IMPERSONATE from .env');
  if (msg.includes('Sign in') || msg.includes('bot'))
    return new Error('YouTube bot detection. Export cookies.txt and set COOKIES_FILE in .env');
  if (msg.includes('Private video'))
    return new Error('This video is private.');
  if (msg.includes('not available'))
    return new Error('Video not available or removed.');
  return new Error(`yt-dlp: ${msg.split('\n')[0]}`);
};

export const getVideoInfo = async (url) => {
  const cleanUrl = stripPlaylistParams(url);
  try {
    return sanitizeInfo(
      await ytDlp.getVideoInfo(cleanUrl, [
        cleanUrl, '--dump-json', '--no-playlist', '--flat-playlist',
        ...getCookieArgs(), ...getImpersonateArgs(), ...BYPASS_ARGS,
      ])
    );
  } catch (err) { throw formatError(err); }
};

export const downloadVideo = async (url, formatId, outputPath) => {
  const cleanUrl = stripPlaylistParams(url);
  try {
    await ytDlp.execPromise([
      cleanUrl,
      '-f', formatId || 'bestvideo+bestaudio/best',
      '--merge-output-format', 'mp4',
      '-o', outputPath,
      '--no-playlist',
      '--max-filesize', `${process.env.MAX_FILESIZE_MB || 200}m`,
      '--socket-timeout', '30',
      ...getCookieArgs(), ...getImpersonateArgs(), ...BYPASS_ARGS,
    ]);
  } catch (err) { throw formatError(err); }
};

export default { getVideoInfo, downloadVideo };
