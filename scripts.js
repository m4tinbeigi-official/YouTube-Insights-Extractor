let apiKeys = [];
let currentKeyIndex = 0;

async function loadApiKeys() {
    try {
        const response = await fetch('api_keys.json');
        apiKeys = await response.json();
        if (apiKeys.length === 0) {
            throw new Error('کلید API یافت نشد!');
        }
    } catch (error) {
        console.error('خطا در بارگذاری کلیدهای API:', error);
        alert('خطایی در بارگذاری کلیدهای API رخ داد. لطفاً بررسی کنید.');
    }
}

function getCurrentApiKey() {
    return apiKeys[currentKeyIndex];
}

function switchToNextApiKey() {
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
}

async function fetchVideosWithRetry(channelId) {
    let retries = apiKeys.length;
    let videos = [];
    while (retries > 0) {
        const apiKey = getCurrentApiKey();
        try {
            videos = await fetchVideos(apiKey, channelId);
            return videos;
        } catch (error) {
            console.warn(`خطا با کلید API ${apiKey}:`, error);
            switchToNextApiKey();
            retries--;
        }
    }
    throw new Error('تمام کلیدهای API شکست خوردند.');
}

async function fetchVideos(apiKey, channelId) {
    const youtubeAPI = "https://www.googleapis.com/youtube/v3";
    try {
        const channelResponse = await axios.get(`${youtubeAPI}/channels`, {
            params: {
                part: "contentDetails",
                id: channelId,
                key: apiKey,
            },
        });
        const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;

        let nextPageToken = "";
        const videos = [];

        do {
            const playlistResponse = await axios.get(`${youtubeAPI}/playlistItems`, {
                params: {
                    part: "snippet",
                    playlistId: uploadsPlaylistId,
                    maxResults: 50,
                    pageToken: nextPageToken,
                    key: apiKey,
                },
            });

            for (const item of playlistResponse.data.items) {
                const videoId = item.snippet.resourceId.videoId;
                const videoTitle = item.snippet.title;
                const thumbnailUrl = item.snippet.thumbnails.medium.url;
                const description = item.snippet.description;
                const publishDate = item.snippet.publishedAt;

                const videoResponse = await axios.get(`${youtubeAPI}/videos`, {
                    params: {
                        part: "statistics",
                        id: videoId,
                        key: apiKey,
                    },
                });

                const stats = videoResponse.data.items[0].statistics;
                const likeCount = stats.likeCount || 0;
                const commentCount = stats.commentCount || 0;

                videos.push({ 
                    id: videoId, 
                    title: videoTitle, 
                    thumbnail: thumbnailUrl, 
                    description, 
                    publishDate, 
                    likeCount, 
                    commentCount 
                });
            }

            nextPageToken = playlistResponse.data.nextPageToken;
        } while (nextPageToken);

        return videos;
    } catch (error) {
        if (error.response && error.response.status === 403) {
            throw new Error("محدودیت API کلید فعلی");
        }
        throw error;
    }
}

function extractChannelId(input) {
    if (input.includes("youtube.com/channel/")) {
        return input.split("youtube.com/channel/")[1].split("/")[0];
    } else if (input.includes("youtube.com/c/")) {
        return input.split("youtube.com/c/")[1].split("/")[0];
    } else if (input.includes("youtube.com/user/")) {
        return input.split("youtube.com/user/")[1].split("/")[0];
    } else {
        return input.trim();
    }
}

function displayVideos(videos) {
    const videoList = document.getElementById("videoList");
    videoList.innerHTML = videos.map(video => `
        <div class="video-item">
            <img src="${video.thumbnail}" class="video-thumbnail" alt="${video.title}">
            <h3>${video.title}</h3>
            <p>${video.description}</p>
            <p>تاریخ انتشار: ${new Date(video.publishDate).toLocaleDateString('fa-IR')}</p>
            <p>تعداد لایک‌ها: ${video.likeCount}</p>
            <p>تعداد کامنت‌ها: ${video.commentCount}</p>
        </div>
    `).join("");
}

document.getElementById("fetchVideosButton").addEventListener("click", async () => {
    const channelInput = document.getElementById("channelInput").value;

    if (!channelInput) {
        alert("لطفاً شناسه یا لینک کانال را وارد کنید!");
        return;
    }

    const channelId = extractChannelId(channelInput);
    const loading = document.getElementById("loading");
    const errorAlert = document.getElementById("errorAlert");

    loading.style.display = "block";
    errorAlert.style.display = "none";

    try {
        const videos = await fetchVideosWithRetry(channelId);
        displayVideos(videos);
    } catch (error) {
        console.error(error);
        errorAlert.textContent = `خطا: ${error.message}`;
        errorAlert.style.display = "block";
    } finally {
        loading.style.display = "none";
    }
});

loadApiKeys();