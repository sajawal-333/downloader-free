import YTDlpWrapModule from 'yt-dlp-wrap';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const YTDlpWrap = YTDlpWrapModule?.default || YTDlpWrapModule;
const ytDlp = new YTDlpWrap();

const COOKIES_PATH = path.join(__dirname, 'cookies.txt');
const TMP_DIR = path.join(__dirname, 'tmp');

const getBaseArgs = () => {
    const hasCookies = fs.existsSync(COOKIES_PATH);
    const args = [
        '--no-check-certificates',
        '--no-cache-dir',
        '--no-warnings',
        '--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        '--add-header', 'Accept-Language:en-US,en;q=0.9',
        '--extractor-args', 'youtube:player-client=ios,android,web_embedded;skip=hls,dash',
        // Anti-bot args from patch
        '--sleep-requests', '1',
        '--sleep-interval', '2',
        '--max-sleep-interval', '5',
        '--retries', '10',
        '--fragment-retries', '10',
        // Performance optimizations
        '--concurrent-fragments', '8',
        '--socket-timeout', '30',
        '--fragment-retries', '10',
        '--throttled-rate', '100K',
        '--download-sections', '0:00:00-',
        '--no-download-archive',
        '--no-playlist'
    ];

    if (hasCookies) {
        console.log('[yt-dlp] Using cookies.txt found at:', COOKIES_PATH);
        args.push('--cookies', COOKIES_PATH);
    }
    return args;
};

export const getVideoInfo = async (url) => {
    const args = [
        url,
        '--flat-playlist',
        ...getBaseArgs()
    ];

    try {
        console.log(`[yt-dlp] Fetching metadata for: ${url}`);
        return await ytDlp.getVideoInfo(args);
    } catch (err) {
        const msg = err?.message || '';
        if (msg.includes('Sign in to confirm you’re not a bot')) {
            throw new Error('BOT_DETECTION_TRIGGERED');
        }
        throw err;
    }
};

export const getDownloadStream = (url, formatSelector, jobId) => {
    const args = [
        url,
        '-f', formatSelector,
        '--merge-output-format', 'mp4',
        '--concurrent-fragments', '8',
        '--socket-timeout', '30',
        '--no-playlist',
        '--output', `${TMP_DIR}/${jobId}.%(ext)s`,
        ...getBaseArgs()
    ];

    return ytDlp.exec(args);
};

export default { getVideoInfo, getDownloadStream };
