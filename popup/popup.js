document.addEventListener('DOMContentLoaded', () => {
    const getBtn = document.getElementById('getBtn');
    const saveBtn = document.getElementById('saveBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const contentDiv = document.getElementById('content');
    const messageDiv = document.getElementById('message');

    // 設定ボタン
    settingsBtn.addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options/options.html'));
        }
    });

    // 情報取得ボタン
    getBtn.addEventListener('click', async () => {
        // ボタンを非表示にし、特定のコントロールを表示するか、単に入力する
        // 今のところシンプルに: 取得をクリック -> 入力 -> 保存を表示
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];

            if (!currentTab) return;

            chrome.tabs.sendMessage(currentTab.id, { action: "getAmazonInfo" }, (response) => {
                if (chrome.runtime.lastError) {
                    showMessage("ページへの接続エラー。ページを更新してみてください: " + chrome.runtime.lastError.message, "error");
                    return;
                }

                if (response) {
                    document.getElementById('titleInput').value = response.title || "";
                    document.getElementById('authorInput').value = response.author || "";
                    document.getElementById('urlInput').value = response.url || "";

                    if (response.image) {
                        document.getElementById('previewImg').src = response.image;
                        document.getElementById('previewImg').dataset.url = response.image; // URLを保存
                    }

                    contentDiv.classList.remove('hidden');
                    getBtn.classList.add('hidden'); // 成功後、個別の取得ボタンを非表示にする
                }
            });
        } catch (err) {
            showMessage("エラー: " + err.message, "error");
        }
    });

    // 保存ボタン
    saveBtn.addEventListener('click', async () => {
        const title = document.getElementById('titleInput').value;
        const author = document.getElementById('authorInput').value;
        const url = document.getElementById('urlInput').value;
        const imageUrl = document.getElementById('previewImg').dataset.url || "";

        if (!url) {
            showMessage("URLは必須です。", "error");
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "保存中...";

        try {
            const { notionToken, dbId } = await chrome.storage.local.get(['notionToken', 'dbId']);

            if (!notionToken || !dbId) {
                throw new Error("NotionトークンまたはデータベースIDが見つかりません。設定を確認してください。");
            }

            await saveToNotion(notionToken, dbId, { title, author, url, imageUrl });

            showMessage("Notionへの保存に成功しました！", "success");
            setTimeout(() => window.close(), 2000); // 成功後、ポップアップを閉じる
        } catch (err) {
            showMessage("保存に失敗しました: " + err.message, "error");
            saveBtn.disabled = false;
            saveBtn.textContent = "Notionへ保存";
        }
    });
});

function showMessage(msg, type) {
    const el = document.getElementById('message');
    el.textContent = msg;
    el.className = type; // success or error
    el.classList.remove('hidden');

    if (type === 'success') {
        // オプション: フェードアウト
    }
}

async function saveToNotion(token, dbId, data) {
    const payload = {
        parent: { database_id: dbId },
        properties: {
            "Name": {
                title: [
                    {
                        text: {
                            content: data.title
                        }
                    }
                ]
            },
            "URL": {
                url: data.url
            },
            "著者": {
                rich_text: [
                    {
                        text: {
                            content: data.author
                        }
                    }
                ]
                // 注記: プロパティタイプが 'Text' (Rich Text) の場合はこれで機能します。
                // 'Multi-select' の場合は構造が異なります ({ multi_select: [{ name: "..." }] })。
                // 要件には "Text型（またはMulti-select）" とありました。Textの方が安全なデフォルトです。
            }
        }
    };

    // 画像があれば追加（カバー画像またはファイルプロパティ？ 要件: "画像：Files & Media型（External URL）"）
    if (data.imageUrl) {
        // "Image" プロパティ名の想定
        payload.properties["カバー画像"] = {
            files: [
                {
                    name: "Product Image",
                    type: "external",
                    external: {
                        url: data.imageUrl
                    }
                }
            ]
        };

        // カバー画像としても設定する？ 要件にはありませんでしたが、あると良いです。
        // ここでは要件の "Files & Media型" に従います。
    }

    const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || response.statusText);
    }

    return response.json();
}
