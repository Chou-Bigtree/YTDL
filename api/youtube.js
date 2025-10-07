const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// 設定 fluent-ffmpeg 要使用的 ffmpeg 執行檔路徑
ffmpeg.setFfmpegPath(ffmpegStatic);

// 輔助函式：清理檔案名稱，移除不合法的字元
function sanitizeFilename(name) {
    return name.replace(/[\/\\?%*:|"<>]/g, '-');
}

module.exports = async (req, res) => {
    // 允許所有來源的跨域請求 (CORS)，方便本地開發
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 對於瀏覽器的 OPTIONS pre-flight 請求，直接回傳成功
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url, type, format } = req.query;

    if (!url || !ytdl.validateURL(url)) {
        return res.status(400).json({ error: '請提供一個有效的 YouTube 網址。' });
    }

    try {
        if (type === 'info') {
            // --- 獲取影片資訊 ---
            const info = await ytdl.getInfo(url);
            const details = info.videoDetails;
            res.status(200).json({
                title: details.title,
                author: details.author.name,
                thumbnail: details.thumbnails[details.thumbnails.length - 1].url, // 使用最高畫質的縮圖
            });
        } else if (type === 'download') {
            // --- 下載檔案 ---
            const info = await ytdl.getInfo(url);
            const title = sanitizeFilename(info.videoDetails.title);

            if (format === 'mp4') {
                res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);
                ytdl(url, {
                    filter: 'audioandvideo',
                    quality: 'highest',
                }).pipe(res);
            } else if (format === 'mp3') {
                res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
                const audioStream = ytdl(url, {
                    filter: 'audioonly',
                    quality: 'highestaudio',
                });

                // 使用 ffmpeg 將音訊串流轉換為 mp3 格式
                ffmpeg(audioStream)
                    .audioBitrate(128)
                    .format('mp3')
                    .on('error', (err) => {
                        console.error('FFmpeg error:', err);
                        res.status(500).send('轉檔時發生錯誤。');
                    })
                    .pipe(res, { end: true });
            } else {
                res.status(400).json({ error: '不支援的格式。' });
            }
        } else {
            res.status(400).json({ error: '無效的操作類型。' });
        }
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: '處理您的請求時發生內部錯誤。' });
    }
};

