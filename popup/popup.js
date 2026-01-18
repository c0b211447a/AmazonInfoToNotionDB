document.addEventListener('DOMContentLoaded', () => {
    // ボタンや要素の取得
    const getBtn = document.getElementById('getBtn');
    const saveBtn = document.getElementById('saveBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const backBtn = document.getElementById('backBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    const mainView = document.getElementById('mainView');
    const settingsView = document.getElementById('settingsView');
    const contentDiv = document.getElementById('content');

    // -------------------------------------------------------------------
    // 画面遷移ロジック
    // -------------------------------------------------------------------

    // 設定ボタン: メインビューを隠し、設定ビューを表示
    settingsBtn.addEventListener('click', async () => {
        // 設定画面を開くときに現在の設定値を読み込む
        const { notionToken, dbId } = await chrome.storage.local.get(['notionToken', 'dbId']);
        document.getElementById('notionToken').value = notionToken || "";
        document.getElementById('dbId').value = dbId || "";

        // メッセージをクリア
        document.getElementById('settingsMessage').classList.add('hidden');

        mainView.classList.add('hidden');
        settingsView.classList.remove('hidden');
    });

    // 戻るボタン: 設定ビューを隠し、メインビューを表示
    backBtn.addEventListener('click', () => {
        settingsView.classList.add('hidden');
        mainView.classList.remove('hidden');
    });

    // -------------------------------------------------------------------
    // 設定保存ロジック
    // -------------------------------------------------------------------
    saveSettingsBtn.addEventListener('click', () => {
        const notionToken = document.getElementById('notionToken').value;
        const dbId = document.getElementById('dbId').value;

        chrome.storage.local.set(
            { notionToken: notionToken, dbId: dbId },
            () => {
                showMessage("設定を保存しました。", "success", "settingsMessage");
                // オプション: 少し待ってからメイン画面に戻る？
                // setTimeout(() => {
                //    backBtn.click();
                // }, 1000);
            }
        );
    });

    // -------------------------------------------------------------------
    // メイン機能ロジック (情報取得・Notion保存)
    // -------------------------------------------------------------------

    // 情報取得ボタン
    getBtn.addEventListener('click', async () => {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];

            if (!currentTab) return;

            chrome.tabs.sendMessage(currentTab.id, { action: "getAmazonInfo" }, (response) => {
                if (chrome.runtime.lastError) {
                    showMessage("ページへの接続エラー。ページを更新してみてください: " + chrome.runtime.lastError.message, "error", "message");
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
            showMessage("エラー: " + err.message, "error", "message");
        }
    });

    // 保存ボタン
    saveBtn.addEventListener('click', async () => {
        const title = document.getElementById('titleInput').value;
        const author = document.getElementById('authorInput').value;
        const url = document.getElementById('urlInput').value;
        const imageUrl = document.getElementById('previewImg').dataset.url || "";

        if (!url) {
            showMessage("URLは必須です。", "error", "message");
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "保存中...";

        try {
            const { notionToken, dbId } = await chrome.storage.local.get(['notionToken', 'dbId']);

            if (!notionToken || !dbId) {
                // トークンがない場合はエラーメッセージとともに設定画面への誘導などを促す
                throw new Error("設定が未完了です。右上の歯車アイコンから設定を行ってください。");
            }

            await saveToNotion(notionToken, dbId, { title, author, url, imageUrl });

            showMessage("Notionへの保存に成功しました！", "success", "message");
            setTimeout(() => window.close(), 2000); // 成功後、ポップアップを閉じる
        } catch (err) {
            showMessage("保存に失敗しました: " + err.message, "error", "message");
            saveBtn.disabled = false;
            saveBtn.textContent = "Notionへ保存";
        }
    });
});

/**
 * メッセージを表示するヘルパー関数
 * @param {string} msg 表示するメッセージ
 * @param {string} type 'success' or 'error'
 * @param {string} elementId 表示先の要素ID ('message' or 'settingsMessage')
 */
function showMessage(msg, type, elementId) {
    const el = document.getElementById(elementId);

    // アイコンの付与
    let icon = "";
    if (type === 'success') icon = "✅ ";
    if (type === 'error') icon = "⚠️ ";

    el.textContent = icon + msg;
    el.className = type; // classを上書き
    el.classList.remove('hidden');
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
            },
            // 画像機能
            "カバー画像": {
                files: [
                    {
                        name: "Product Image",
                        type: "external",
                        external: {
                            url: data.imageUrl
                        }
                    }
                ]
            }
        }
    };

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
