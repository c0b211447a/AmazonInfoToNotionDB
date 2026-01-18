// content/content.js

// ポップアップからのメッセージをリッスンしてデータを返却する
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getAmazonInfo") {
        // 情報を取得
        const data = scrapeAmazonPage();
        // ポップアップへレスポンスを返す
        sendResponse(data);
    }
    return true; // 非同期レスポンスのためにメッセージチャネルを開いたままにする
});

function scrapeAmazonPage() {
    const info = {
        title: "",
        author: "",
        image: "",
        url: window.location.href
    };

    // 1. タイトル
    const titleEl = document.getElementById("productTitle");
    if (titleEl) {
        info.title = titleEl.innerText.trim();
    }

    // 2. 著者
    // ユーザー要件: <div id="bylineInfo"> 内の <span class="author"> 内にある <a> タグのテキストを取得
    // 複数ある場合はカンマ区切りで結合
    const authorLinks = document.querySelectorAll('#bylineInfo .author a');

    if (authorLinks && authorLinks.length > 0) {
        // テキストを取得し、空白を除去して配列化
        const authors = Array.from(authorLinks)
            .map(link => link.innerText.trim())
            .filter(text => text !== ''); // 空文字を除外

        // カンマ区切りで結合
        info.author = authors.join(', ');
    } else {
        // フォールバック: 指定の構造で見つからない場合の予備ロジック (必要に応じて残す/削除)
        // 今回は要件に従い上記を優先しますが、念のため他のセレクタも最低限チェックしても良いかもしれません。
        // ここでは念のため既存のシンプルなセレクタも試行します（空の場合のみ）。
        const fallbackSelectors = [".author", "#byline", ".contributorNameID"];
        for (const sel of fallbackSelectors) {
            const el = document.querySelector(sel);
            if (el) {
                info.author = el.innerText.trim();
                break;
            }
        }
    }

    // 3. 画像
    // 可能であればデータ属性から高解像度画像を取得する
    const imageEl = document.getElementById("landingImage") || document.getElementById("imgBlkFront");

    if (imageEl) {
        // Amazonの画像は 'data-a-dynamic-image' 属性に解像度のJSONを含んでいることが多い
        const dynamicImage = imageEl.getAttribute("data-a-dynamic-image");
        if (dynamicImage) {
            try {
                const imageObj = JSON.parse(dynamicImage);
                // キーがURL、値が [width, height]。最大の幅を持つものを取得。
                const urls = Object.keys(imageObj);
                if (urls.length > 0) {
                    // 最大のものを探す
                    const largest = urls.reduce((a, b) => {
                        const sizeA = imageObj[a][0] * imageObj[a][1];
                        const sizeB = imageObj[b][0] * imageObj[b][1];
                        return sizeA > sizeB ? a : b;
                    });
                    info.image = largest;
                }
            } catch (e) {
                info.image = imageEl.src;
            }
        } else {
            info.image = imageEl.src;
        }
    }

    // メイン画像取得失敗時のフォールバック
    if (!info.image) {
        const backupImg = document.querySelector("#main-image");
        if (backupImg) info.image = backupImg.src;
    }

    // URLの整形（DB登録用にクエリパラメータを除去）
    try {
        const cleanUrl = new URL(window.location.href);
        info.url = cleanUrl.origin + cleanUrl.pathname;
    } catch (e) {
        // 無視
    }

    return info;
}
