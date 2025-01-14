// تعریف متغیرهای اصلی
let apiKeys = [];
let currentKeyIndex = 0;
let channelName = "";
let channelDescription = "";

// بارگذاری کلیدهای API از فایل JSON
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
        throw error;
    }
}

// مدیریت کلیدهای API
function getCurrentApiKey() {
    return apiKeys[currentKeyIndex];
}

function switchToNextApiKey() {
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
}

// بروزرسانی نوار پیشرفت
function updateProgress(current, total) {
    setTimeout(() => {
        const progressBar = document.getElementById("progressBar");
        const progressText = document.getElementById("progressText");
        const percent = Math.round((current / total) * 100);
        progressBar.style.width = `${percent}%`;
        progressBar.textContent = `${percent}%`;
        progressText.textContent = `در حال پردازش ویدیو ${current} از ${total}`;
    }, 0);
}

// تلاش برای دریافت ویدیوها با کلیدهای متعدد API
async function fetchVideosWithRetry(channelId) {
    let retries = apiKeys.length;
    while (retries > 0) {
        const apiKey = getCurrentApiKey();
        try {
            return await fetchVideos(apiKey, channelId);
        } catch (error) {
            console.warn(`خطا با کلید API ${apiKey}:`, error);
            switchToNextApiKey();
            retries--;
        }
    }
    throw new Error("تمام کلیدهای API شکست خوردند. لطفاً بعداً دوباره امتحان کنید.");
}

// دریافت اطلاعات کانال و ویدیوها
async function fetchVideos(apiKey, channelId) {
    const youtubeAPI = "https://www.googleapis.com/youtube/v3";
    try {
        const channelResponse = await axios.get(`${youtubeAPI}/channels`, {
            params: {
                part: "snippet,statistics,contentDetails",
                id: channelId,
                key: apiKey,
            },
        });

        const channelData = channelResponse.data.items[0];
        channelName = channelData.snippet.title;
        channelDescription = channelData.snippet.description;

        displayChannelInfo(
            channelName,
            channelDescription,
            channelData.statistics.subscriberCount,
            channelData.statistics.viewCount,
            channelData.snippet.publishedAt
        );
        saveSearchHistory(channelId, channelName);

        const uploadsPlaylistId = channelData.contentDetails.relatedPlaylists.uploads;

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
            const videoIds = playlistResponse.data.items.map(item => item.snippet.resourceId.videoId);

            const videoResponse = await axios.get(`${youtubeAPI}/videos`, {
                params: {
                    part: "statistics",
                    id: videoIds.join(","),
                    key: apiKey,
                },
            });

            for (let i = 0; i < playlistResponse.data.items.length; i++) {
                currentVideo++;
                updateProgress(currentVideo, totalVideos);

                const item = playlistResponse.data.items[i];
                const stats = videoResponse.data.items[i].statistics;

                videos.push({ 
                    id: item.snippet.resourceId.videoId,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.medium.url,
                    description: item.snippet.description,
                    publishDate: item.snippet.publishedAt,
                    viewCount: stats.viewCount || 0,
                    likeCount: stats.likeCount || 0,
                    commentCount: stats.commentCount || 0,
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

// استخراج شناسه کانال از ورودی
function extractChannelId(input) {
    if (!input) {
        throw new Error("لطفاً شناسه یا لینک کانال را وارد کنید!");
    }

    if (input.includes("youtube.com/channel/")) {
        return input.split("youtube.com/channel/")[1].split("/")[0];
    } else if (input.includes("youtube.com/c/")) {
        return input.split("youtube.com/c/")[1].split("/")[0];
    } else if (input.includes("youtube.com/user/")) {
        return input.split("youtube.com/user/")[1].split("/")[0];
    } else if (input.includes("youtube.com/@")) {
        return input.split("youtube.com/@")[1].split("/")[0];
    } else if (input.startsWith("UC") && input.length === 24) {
        return input;
    } else if (input.startsWith("@")) {
        return input.slice(1);
    } else {
        return input;
    }
}

// نمایش اطلاعات کانال
function displayChannelInfo(name, description, subscribers, views, creationDate) {
    const channelInfo = document.getElementById("channelInfo");
    channelInfo.innerHTML = `
        <h3>${name}</h3>
        <p>${description}</p>
        <p>تعداد سابسکرایبرها: ${toPersianNumbers(subscribers)}</p>
        <p>تعداد کل بازدیدها: ${toPersianNumbers(views)}</p>
        <p>تاریخ ایجاد کانال: ${toPersianDate(creationDate)}</p>
    `;
    channelInfo.style.display = "block";
}

// ذخیره تاریخچه جستجو
function saveSearchHistory(channelId, channelName) {
    const history = JSON.parse(localStorage.getItem('searchHistory')) || [];
    if (!history.some(item => item.id === channelId)) {
        history.push({ id: channelId, name: channelName });
        if (history.length > 10) {
            history.shift();
        }
        localStorage.setItem('searchHistory', JSON.stringify(history));
    }
    displaySearchHistory();
}

// نمایش تاریخچه جستجو
function displaySearchHistory() {
    const history = JSON.parse(localStorage.getItem('searchHistory')) || [];
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = history.map(item => `<li><a href="#" onclick="fetchChannel('${item.id}')">${item.name}</a></li>`).join('');
}

// تبدیل اعداد به فارسی
function toPersianNumbers(input) {
    const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(input).replace(/\d/g, (match) => persianNumbers[match]);
}

// تبدیل تاریخ به فرمت فارسی
function toPersianDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString('fa-IR', options);
}

// مدیریت حالت تاریک
const toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};

if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}

// شروع بارگذاری اولیه
loadApiKeys();
displaySearchHistory();