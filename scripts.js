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
        throw error; // جلوگیری از ادامه اجرای کد
    }
}

function getCurrentApiKey() {
    return apiKeys[currentKeyIndex];
}

function switchToNextApiKey() {
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
}

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
    throw new Error("تمام کلیدهای API شکست خوردند. لطفاً بعداً دوباره امتحان کنید.");
}

async function fetchVideos(apiKey, channelId) {
    const youtubeAPI = "https://www.googleapis.com/youtube/v3";
    try {
        // دریافت اطلاعات کانال و شناسه پلی‌لیست آپلودها
        const channelResponse = await axios.get(`${youtubeAPI}/channels`, {
            params: {
                part: "snippet,statistics,contentDetails",
                id: channelId,
                key: apiKey,
            },
        });
        channelName = channelResponse.data.items[0].snippet.title;
        channelDescription = channelResponse.data.items[0].snippet.description;
        const subscriberCount = channelResponse.data.items[0].statistics.subscriberCount;
        const totalViews = channelResponse.data.items[0].statistics.viewCount;
        const channelCreationDate = channelResponse.data.items[0].snippet.publishedAt;

        displayChannelInfo(channelName, channelDescription, subscriberCount, totalViews, channelCreationDate);
        saveSearchHistory(channelId, channelName);

        const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;

        // دریافت ویدیوها از پلی‌لیست آپلودها
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

            // دریافت آمار ویدیوها به صورت گروهی
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
                const videoId = item.snippet.resourceId.videoId;
                const videoTitle = item.snippet.title;
                const thumbnailUrl = item.snippet.thumbnails.medium.url;
                const description = item.snippet.description;
                const publishDate = item.snippet.publishedAt;

                const stats = videoResponse.data.items[i].statistics;
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
	
	if (!input) {
        throw new Error("لطفاً شناسه یا لینک کانال را وارد کنید!");
    }
	
    // اگر ورودی یک لینک کامل باشد
    if (input.includes("youtube.com/channel/")) {
        return input.split("youtube.com/channel/")[1].split("/")[0];
    }
    // اگر ورودی یک لینک با نام کاربری باشد (مثال: youtube.com/c/tseries)
    else if (input.includes("youtube.com/c/")) {
        return input.split("youtube.com/c/")[1].split("/")[0];
    }
    // اگر ورودی یک لینک با نام کاربری قدیمی باشد (مثال: youtube.com/user/tseries)
    else if (input.includes("youtube.com/user/")) {
        return input.split("youtube.com/user/")[1].split("/")[0];
    }
    // اگر ورودی یک لینک کوتاه باشد (مثال: youtube.com/@tseries)
    else if (input.includes("youtube.com/@")) {
        return input.split("youtube.com/@")[1].split("/")[0];
    }
    // اگر ورودی یک شناسه کانال باشد (مثال: UCq-Fj5jknLsUf-MWSy4_brA)
    else if (input.startsWith("UC") && input.length === 24) {
        return input;
    }
    // اگر ورودی یک نام کاربری باشد (مثال: @tseries)
    else if (input.startsWith("@")) {
        return input.slice(1); // حذف @ از ابتدای نام کاربری
    }
    // اگر ورودی نامعتبر باشد
    else {
        throw new Error("فرمت شناسه یا لینک کانال نامعتبر است.");
    }
}

function displayChannelInfo(name, description, subscribers, views, creationDate) {
    const channelInfo = document.getElementById("channelInfo");
    channelInfo.innerHTML = `
        <h3>${name}</h3>
        <p>${description}</p>
        <p>تعداد سابسکرایبرها: ${subscribers}</p>
        <p>تعداد کل بازدیدها: ${views}</p>
        <p>تاریخ ایجاد کانال: ${new Date(creationDate).toLocaleDateString('fa-IR')}</p>
    `;
    channelInfo.style.display = "block";
}

function saveSearchHistory(channelId, channelName) {
    const history = JSON.parse(localStorage.getItem('searchHistory')) || [];
    if (!history.some(item => item.id === channelId)) {
        history.push({ id: channelId, name: channelName });
        if (history.length > 10) { // محدود کردن تاریخچه به 10 آیتم
            history.shift();
        }
        localStorage.setItem('searchHistory', JSON.stringify(history));
    }
    displaySearchHistory();
}

function displaySearchHistory() {
    const history = JSON.parse(localStorage.getItem('searchHistory')) || [];
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = history.map(item => `<li><a href="#" onclick="fetchChannel('${item.id}')">${item.name}</a></li>`).join('');
}

function fetchChannel(channelId) {
    document.getElementById('channelInput').value = channelId;
    document.getElementById('fetchVideosButton').click();
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
                return `<img src="${data}" class="video-thumbnail" alt="تصویر ویدیو" onerror="this.src='default-thumbnail.jpg'">`;
            }},
            { data: "id", title: "پیش‌نمایش", render: function(data) {
                return `<iframe width="200" height="100" src="https://www.youtube.com/embed/${data}" frameborder="0" allowfullscreen onerror="this.src='error.html'"></iframe>`;
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

const toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};

if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}

document.getElementById("fetchVideosButton").addEventListener("click", async () => {
    const channelInput = document.getElementById("channelInput").value;

    if (!channelInput) {
        alert("لطفاً شناسه یا لینک کانال را وارد کنید!");
        return;
    }

    const loading = document.getElementById("loading");
    const errorAlert = document.getElementById("errorAlert");

    loading.style.display = "block";
    errorAlert.style.display = "none";

    try {
        // استخراج شناسه کانال از ورودی
        let channelId = extractChannelId(channelInput);

		if (!channelId.startsWith("UC")) {
			const channelIdFromUsername = await getChannelIdByUsername(channelId);
			if (!channelIdFromUsername) {
				throw new Error("کانال با این نام کاربری یافت نشد.");
			}
			channelId = channelIdFromUsername; // اکنون مشکلی ندارد
		}

        // دریافت ویدیوهای کانال
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


async function getChannelIdByUsername(username) {
    const apiKey = getCurrentApiKey();
    const youtubeAPI = "https://www.googleapis.com/youtube/v3";
    try {
        const response = await axios.get(`${youtubeAPI}/channels`, {
            params: {
                part: "id",
                forUsername: username,
                key: apiKey,
            },
        });
        if (response.data.items.length > 0) {
            return response.data.items[0].id; // شناسه کانال
        } else {
            throw new Error("کانال با این نام کاربری یافت نشد.");
        }
    } catch (error) {
        console.error("خطا در دریافت شناسه کانال:", error);
        throw new Error("خطا در دریافت اطلاعات کانال. لطفاً نام کاربری یا لینک را بررسی کنید.");
    }
}

loadApiKeys();
displaySearchHistory();