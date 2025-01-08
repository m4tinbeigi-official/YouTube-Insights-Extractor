let apiKeys = [];
let currentKeyIndex = 0;

async function loadApiKeys() {
    try {
        const response = await fetch('api_keys.json');
        apiKeys = await response.json();
        const apiKeySelect = document.getElementById('apiKeySelect');

        apiKeys.forEach((key, index) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `کلید API ${index + 1}`;
            apiKeySelect.appendChild(option);
        });

        if (apiKeys.length > 0) {
            apiKeySelect.value = apiKeys[0];
        }
    } catch (error) {
        console.error('خطا در بارگذاری کلیدهای API:', error);
    }
}

function getCurrentApiKey() {
    return apiKeys[currentKeyIndex];
}

function switchToNextApiKey() {
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    document.getElementById('apiKeySelect').value = getCurrentApiKey();
}

async function fetchVideosWithRetry(channelId) {
    let retries = apiKeys.length;
    while (retries > 0) {
        const apiKey = getCurrentApiKey();
        try {
            const videos = await fetchVideos(apiKey, channelId);
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

document.getElementById("fetchVideosButton").addEventListener("click", async () => {
    const channelInput = document.getElementById("channelInput").value;

    if (!channelInput) {
        alert("لطفاً شناسه یا لینک کانال را وارد کنید!");
        return;
    }

    const channelId = extractChannelId(channelInput);
    try {
        const videos = await fetchVideosWithRetry(channelId);
        displayVideos(videos);
    } catch (error) {
        console.error(error);
        alert("خطایی رخ داده است. لطفاً بعداً دوباره تلاش کنید.");
    }
});

loadApiKeys();