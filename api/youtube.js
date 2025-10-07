const ytdl = require('ytdl-core-discord');
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
    
    // ytdl-core-discord 沒有 validateURL 方法，我們先用一個簡單的正則表達式代替
    const youtubeRegex = /^(https|http):\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(url)) {
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
            const stream = await ytdl(url, { filter: 'audioandvideo', quality: 'highest' });
            stream
                .on('error', (err) => {
                    console.error("MP4 download stream error:", err);
                    res.end();
                })
                .pipe(res);
        } else if (type === 'mp3') {
            res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
            const stream = await ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });
            
            ffmpeg(stream)
                .audioBitrate(128)
                .format('mp3')
                .on('error', (err) => {
                    console.error('FFmpeg error:', err);
                    res.end();
                })
                .pipe(res);
        } else {
            res.status(400).json({ error: 'Invalid type specified' });
        }
    } catch (generalError) {
        console.error("General server error:", generalError);
        if (!res.headersSent) {
            res.status(500).json({ error: '伺服器發生未知錯誤。' });
        }
    }
}

