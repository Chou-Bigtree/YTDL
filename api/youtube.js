const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

// 設定 Vercel Edge Function 的配置
export const config = {
    runtime: 'nodejs',
    maxDuration: 60, // 將超時時間設定為 60 秒
};

export default async function handler(req, res) {
    // 允許來自任何來源的跨域請求
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url, type } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'YouTube URL is required' });
    }
    if (!ytdl.validateURL(url)) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    try {
        if (type === 'info') {
            try {
                const info = await ytdl.getInfo(url);
                const details = info.videoDetails;
                res.json({
                    title: details.title,
                    author: details.author.name,
                    thumbnail: details.thumbnails[details.thumbnails.length - 1].url,
                });
            } catch (infoError) {
                console.error("Error fetching video info:", infoError);
                return res.status(500).json({ error: '無法獲取影片資訊，可能是影片有限制或網址錯誤。' });
            }
        } else if (type === 'mp4') {
            res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
            ytdl(url, { filter: 'audioandvideo', quality: 'highest' })
                .on('error', (err) => {
                    console.error("MP4 download stream error:", err);
                    // 由於標頭已發送，很難再發送 JSON 錯誤，只能中斷連線
                    res.end();
                })
                .pipe(res);
        } else if (type === 'mp3') {
            res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
            const stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });
            
            ffmpeg(stream)
                .audioBitrate(128)
                .format('mp3')
                .on('error', (err) => {
                    console.error('FFmpeg error:', err);
                    res.end(); // 中斷連線
                })
                .pipe(res);
        } else {
            res.status(400).json({ error: 'Invalid type specified' });
        }
    } catch (generalError) {
        console.error("General server error:", generalError);
        // 確保即使發生意外，也有一個兜底的錯誤回覆
        if (!res.headersSent) {
            res.status(500).json({ error: '伺服器發生未知錯誤。' });
        }
    }
}

