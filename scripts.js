async function loadApiKeys() {
    try {
        const response = await fetch('api_keys.json');
        const keys = await response.json();
        const apiKeySelect = document.getElementById('apiKeySelect');

        keys.forEach((key, index) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `کلید API ${index + 1}`;
            apiKeySelect.appendChild(option);
        });
    } catch (error) {
        console.error('خطا در بارگذاری کلیدهای API:', error);
    }
}

function extractChannelId(input) {
    const regex = /channel\/([\w\-]+)/;
    const match = input.match(regex);
    return match ? match[1] : input;
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
        console.error("Error fetching videos:", error);
        return [];
    }
}

function displayVideos(videos) {
    const videoList = document.getElementById("videoList");
    videoList.innerHTML = "";

    if (videos.length === 0) {
        videoList.innerHTML = '<div class="alert alert-warning">هیچ ویدیویی یافت نشد!</div>';
        return;
    }

    videos.forEach((video) => {
        const videoItem = document.createElement("div");
        videoItem.classList.add("video-item", "card", "p-3");

        videoItem.innerHTML = `
            <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
            <h5 class="mt-3">${video.title}</h5>
            <p><strong>توضیحات:</strong> ${video.description || "ندارد"}</p>
            <p><strong>تاریخ انتشار:</strong> ${new Date(video.publishDate).toLocaleDateString()}</p>
            <p><strong>لایک‌ها:</strong> ${video.likeCount}</p>
            <p><strong>کامنت‌ها:</strong> ${video.commentCount}</p>
            <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" class="btn btn-primary">مشاهده ویدیو</a>
        `;

        videoList.appendChild(videoItem);
    });
}

document.getElementById("fetchVideosButton").addEventListener("click", async () => {
    const apiKey = document.getElementById("apiKeySelect").value;
    const channelInput = document.getElementById("channelInput").value;

    if (!apiKey || !channelInput) {
        alert("لطفاً تمام فیلدها را پر کنید!");
        return;
    }

    const channelId = extractChannelId(channelInput);
    const videos = await fetchVideos(apiKey, channelId);
    displayVideos(videos);
});

loadApiKeys();