let apiKeys = [];
let currentKeyIndex = 0;
let channelName = "";
let channelDescription = "";

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

function updateProgress(current, total) {
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");
    const percent = Math.round((current / total) * 100);
    progressBar.style.width = `${percent}%`;
    progressBar.textContent = `${percent}%`;
    progressText.textContent = `در حال پردازش ویدیو ${current} از ${total}`;
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
                part: "snippet",
                id: channelId,
                key: apiKey,
            },
        });
        channelName = channelResponse.data.items[0].snippet.title;
        channelDescription = channelResponse.data.items[0].snippet.description;

        const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;

        let nextPageToken = "";
        const videos = [];
        let totalVideos = 0;
        let currentVideo = 0;

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

            totalVideos = playlistResponse.data.pageInfo.totalResults;
            for (const item of playlistResponse.data.items) {
                currentVideo++;
                updateProgress(currentVideo, totalVideos);

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
                const viewCount = stats.viewCount || 0;
                const likeCount = stats.likeCount || 0;
                const commentCount = stats.commentCount || 0;

                videos.push({ 
                    id: videoId, 
                    title: videoTitle, 
                    thumbnail: thumbnailUrl, 
                    description, 
                    publishDate, 
                    viewCount, 
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

function displayChannelInfo() {
    const channelInfo = document.getElementById("channelInfo");
    const channelNameElement = document.getElementById("channelName");
    const channelDescriptionElement = document.getElementById("channelDescription");

    channelNameElement.textContent = channelName;
    channelDescriptionElement.textContent = channelDescription;
    channelInfo.style.display = "block";
}

function saveToLocalStorage(channelId, data) {
    localStorage.setItem(channelId, JSON.stringify(data));
}

function loadFromLocalStorage(channelId) {
    const data = localStorage.getItem(channelId);
    return data ? JSON.parse(data) : null;
}

function displayVideos(videos) {
    const videoTableContainer = document.getElementById("videoTableContainer");
    const videoTable = $("#videoTable").DataTable({
        data: videos,
        columns: [
            { data: "title", title: "عنوان ویدیو" },
            { data: "viewCount", title: "تعداد بازدید" },
            { data: "likeCount", title: "تعداد لایک‌ها" },
            { data: "commentCount", title: "تعداد کامنت‌ها" },
            { data: "publishDate", title: "تاریخ انتشار", render: function(data) {
                return new Date(data).toLocaleDateString('fa-IR');
            }},
            { data: "thumbnail", title: "تصویر", render: function(data) {
                return `<img src="${data}" class="video-thumbnail" alt="تصویر ویدیو">`;
            }},
            { data: "id", title: "لینک ویدیو", render: function(data) {
                return `<a href="https://www.youtube.com/watch?v=${data}" target="_blank">پخش ویدیو</a>`;
            }},
        ],
        order: [[1, "desc"]], // مرتب‌سازی بر اساس بیشترین بازدید
        dom: 'Bfrtip',
        buttons: [
            {
                extend: 'csv',
                text: 'دانلود CSV',
                filename: function() {
                    return `${channelName}_videos`;
                },
                title: `ویدیوهای کانال ${channelName}`,
                exportOptions: {
                    columns: [0, 1, 2, 3, 4] // انتخاب ستون‌ها برای خروجی CSV
                }
            }
        ],
        language: {
            url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/fa.json" // فارسی‌سازی DataTables
        }
    });

    videoTableContainer.style.display = "block";
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
        let videos = loadFromLocalStorage(channelId);
        if (!videos) {
            videos = await fetchVideosWithRetry(channelId);
            saveToLocalStorage(channelId, { channelName, channelDescription, videos });
        } else {
            channelName = videos.channelName;
            channelDescription = videos.channelDescription;
            videos = videos.videos;
        }

        displayChannelInfo();
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