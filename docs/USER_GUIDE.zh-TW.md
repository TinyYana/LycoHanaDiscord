# 彼岸花 Discord Bot v3.0 使用手冊

[回到繁中 README](../README.zh-TW.md) · [English README](../README.md)

這份手冊寫給實際管理彼岸花 Discord 伺服器的人。主線從第一次部署、伺服器設定一路走到日常操作與排錯，不要求先看懂程式碼。

手冊依目前 M8 的實作撰寫。程式與文件檢查已通過，但 Discord 權限、身份組階層與完整互動流程仍應先在測試 guild 實機驗收，再放進正式社群。尤其是 honeypot 的 ban，別拿正式成員試，會很有記憶點，但不是好的那種。

## 先決定你要做到哪裡

Bot 的功能可以分開啟用，不需要第一天全部打開。

| 想處理的事情           | 需要設定的功能                                 |
| ---------------------- | ---------------------------------------------- |
| 確認 Bot 正常上線      | `/ping`                                        |
| 歡迎新成員             | `/config welcome`                              |
| 記錄離開成員           | `/config leave-log`                            |
| 觀察社群活躍度         | `/activity me`、`/activity stats`              |
| 自動發放活躍成員身分組 | `/config active-role`、`thresholds`、`weights` |
| 讓成員自行領取身分組   | `/role-menu create`                            |
| 由管理員製作 Embed     | `/embed draft`、`/embed template`              |
| 設定誘捕頻道           | `/config log-channel`、`/honeypot`             |

如果只是要先確認部署，不用急著設定門檻或 honeypot。先讓 `/ping`、歡迎頻道和一個測試 Role Menu 跑通，再往下加，排錯會輕鬆很多。

## 第一次部署

### 1. 建立 Discord Application

在 Discord Developer Portal 建立 Application 與 Bot，取得：

- Bot Token，填入 `DISCORD_TOKEN`
- Application ID，填入 `DISCORD_CLIENT_ID`
- 測試伺服器 ID，開發時可填入 `DISCORD_GUILD_ID`

請在 Bot 設定中開啟：

- **Server Members Intent**
- **Message Content Intent**

邀請 Bot 時至少勾選 `bot` 與 `applications.commands` scopes。權限可以依功能逐步給，不必直接丟 Administrator。

| 功能                  | 建議權限                                  |
| --------------------- | ----------------------------------------- |
| 基本訊息與 Embed      | View Channels、Send Messages、Embed Links |
| 反應與歷史訊息追蹤    | Read Message History                      |
| 活躍身分組、Role Menu | Manage Roles                              |
| Honeypot 刪除訊息     | Manage Messages                           |
| Honeypot 禁言         | Moderate Members                          |
| Honeypot 封鎖         | Ban Members                               |

Bot 的最高身分組必須放在它要管理的身分組與成員之上。`Manage Roles`、`Moderate Members` 和 `Ban Members` 都受 Discord 身分組階層限制。

### 2. 準備 PostgreSQL

目前專案使用 Supabase PostgreSQL，但 Bot 是直接透過 `DATABASE_URL` 連 PostgreSQL，不需要 Supabase Data API。

從 Supabase 專案取得 PostgreSQL connection URI，填入：

```dotenv
DATABASE_URL=postgresql://...
```

程式支援 direct connection（通常是 5432）與 transaction pooler（通常是 6543），連線時會要求 SSL。實際 URI 請以你的 Supabase 專案顯示內容為準，Dashboard 名稱之後改版也不用跟它鬥氣，重點是拿到完整 PostgreSQL URI。

Bot 目前使用 `public` schema。若專案同時開放 Supabase Data API，請另外限制 `anon`／`authenticated` roles 或配置符合實際需求的 RLS。Bot 用得到資料表，不代表公開 API 也應該碰得到。

### 3. 建立 `.env`

在 repository 根目錄執行：

```powershell
Copy-Item .env.example .env
```

最少需要：

```dotenv
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DATABASE_URL=postgresql://...
```

`DISCORD_GUILD_ID` 是選填。開發時建議設定，slash commands 會註冊到單一測試 guild，更新通常能立即看到；沒設定時會改成全域註冊。

不要提交 `.env`，也不要把 Bot Token、資料庫密碼或完整連線字串貼進 issue、log、Discord 訊息或截圖。

### 4. 安裝、遷移與啟動

```bash
pnpm install
pnpm db:migrate
pnpm build
pnpm --filter @lycohana/bot start
```

開發時可以使用：

```bash
pnpm dev
```

Bot 啟動時會先同步 slash commands，再登入 Discord。看到 Bot 上線後，在測試 guild 執行：

```text
/ping
```

若能收到只有自己看得到的延遲回覆，基本連線就通了。

## 建議的首次設定順序

### 1. 先看目前設定

```text
/config view
```

它會顯示：

- 活躍成員身分組
- 高標與低標
- 各類活躍度權重
- 豁免身分組
- 歡迎、離開與管理紀錄頻道

回覆只有執行指令的管理員看得到。之後每改一組設定，都可以再跑一次 `/config view`，不要靠記憶猜現在到底是哪個頻道。

### 2. 設定歡迎與紀錄頻道

啟用歡迎訊息：

```text
/config welcome enabled:True channel:#歡迎
```

停用時不必重選頻道：

```text
/config welcome enabled:False
```

目前歡迎訊息是固定格式：

```text
歡迎 @成員 來到 伺服器名稱！
```

啟用離開紀錄：

```text
/config leave-log enabled:True channel:#成員離開紀錄
```

離開紀錄會包含成員 tag 與 Discord user ID。這個頻道通常不需要開給一般成員看。

啟用管理紀錄：

```text
/config log-channel enabled:True channel:#管理紀錄
```

目前管理紀錄主要接收 honeypot 的自動處置。資料庫仍會保存紀錄；頻道則是讓管理員不用進資料庫才能看到發生了什麼。

### 3. 設定活躍成員身分組

先建立一個 Discord 身分組，例如 `活躍成員`，並把它放在 Bot 最高身分組下方。

```text
/config active-role role:@活躍成員
```

如果身份組位置太高，Bot 會顯示警告，但仍會保存設定。這時要回 Discord 的身分組設定調整順序。

接著設定門檻：

```text
/config thresholds high:100 low:70
```

- 分數 **大於或等於 high**：尚未持有身份組的成員會取得身份組。
- 分數 **小於 low**：已持有身份組的成員會失去身份組。
- 分數落在兩者中間：維持目前狀態。

`high` 必須大於或等於 `low`。分開兩條線是為了避免成員分數剛好卡在邊界時，身份組每天被加上又拔掉。

最後確認權重。預設值是：

| 活動           | 預設權重 |
| -------------- | -------: |
| 聊天           |        1 |
| 圖片           |        3 |
| 音樂分享       |        3 |
| 互動           |        1 |
| 語音每 10 分鐘 |        2 |

需要調整時，五個值要一起填：

```text
/config weights chat:1 image:3 music:3 interaction:1 voice_per_10min:2
```

先用 `/activity stats` 看實際分布，再決定門檻。不要只看公式覺得 100 很漂亮就直接上正式服，社群使用習慣通常不會配合漂亮數字。

### 4. 設定豁免身份組

不希望被自動發放或回收活躍身份組的人，可以加入豁免：

```text
/config exempt-add role:@工作人員
```

移除豁免：

```text
/config exempt-remove role:@工作人員
```

只要成員持有任何一個豁免身份組，排程就不會變更他的活躍成員身份組。

## 活躍度怎麼計算

### 成員查看自己的紀錄

```text
/activity me
```

成員會看到本月的聊天、語音、圖片、音樂分享與互動數量。回覆只有本人看得到，也沒有公開排行榜。

### 管理員查看分布

```text
/activity stats
```

它會顯示滾動視窗內的：

- 有活動的成員數
- 最低、中位與最高分
- 高於 high 與低於 low 的人數

預設視窗是 30 天。這份統計適合拿來調門檻，不適合拿來公開排名，程式也沒有提供成員排行榜。

### 哪些行為會被記錄

- **聊天**：同一位成員預設每 60 秒最多計一次。
- **圖片**：依附件 MIME type 或副檔名辨識，每則訊息最多加一次。
- **音樂分享**：辨識 Spotify、YouTube／YouTube Music、SoundCloud、Apple Music、Bandcamp、Deezer 與 Tidal 連結。
- **互動**：回覆其他非 Bot 成員，或對訊息新增反應；預設每天最多 20 次。
- **語音**：非 AFK 語音頻道內至少有兩位真人時才累計，預設每天最多 4 小時。

Bot 不保存原始訊息本文，只保存每位成員每天的數量彙整。不過圖片與音樂辨識仍需讀取附件資訊與訊息內容，所以 Message Content Intent 不能關。

聊天冷卻、進行中的語音區段都只存在記憶體。Bot 重啟時，尚未結束的語音區段可能不會留下；這是目前已知的取捨。

### 活躍身份組何時更新

預設排程是每天 **04:00 Asia/Taipei**，計算最近 30 天。現在沒有手動執行 sweep 的 slash command，因此剛改完門檻不會立刻替所有人重算。

Bot、持有豁免身份組的人，以及 Bot 無法管理的身份組都會被跳過。若排程完全沒有動作，先檢查：

1. `/config view` 是否已設定身份組和門檻。
2. Bot 是否有 `Manage Roles`。
3. Bot 最高身分組是否高於活躍成員身分組。
4. `ACTIVE_MEMBER_CRON` 是否為有效 cron expression。
5. 執行時間是否使用了預期的 `ACTIVITY_TIME_ZONE`。

## 建立自助身分組選單

```text
/role-menu create
```

必填內容：

- `title`：顯示在訊息上方的標題
- `channel`：文字或公告頻道
- `role_1` 與 `label_1`：第一個身份組與按鈕文字

最多可以設定 5 組身份組。從第二組開始可省略，但 `role_n` 與 `label_n` 必須一起填。

範例：

```text
/role-menu create title:興趣身分組 channel:#領取身分組 role_1:@動畫 label_1:動畫 role_2:@遊戲 label_2:遊戲
```

成員按一次會取得身份組，再按一次會移除身份組。回覆只有本人看得到。

### 限定開放時間

`available_from` 與 `available_until` 接受 ISO 8601 時間。建議明確寫時區：

```text
available_from:2026-06-28T00:00:00+08:00
available_until:2026-07-05T23:59:59+08:00
```

開始前按鈕會回覆「尚未開始」，結束後會回覆「已經結束」。結束時間必須晚於開始時間。

### 目前限制

- 沒有 `/role-menu list`、編輯或刪除指令。
- 要停止常駐選單，可以先手動刪除 Discord 訊息。
- 刪除訊息不會同步刪除資料庫紀錄。
- Bot 需要 `Manage Roles`，身份組必須在 Bot 最高身分組下方，也不能是其他 integration 管理的身份組。

## 製作與送出 Embed

### 建立草稿

```text
/embed draft
```

草稿控制面板只有建立它的管理員能操作。預設 60 分鐘後過期，Bot 重啟也會讓未送出的草稿消失。

建議操作順序：

1. 按 **編輯文字**，填標題、描述與 Footer。
2. 按 **編輯外觀**，需要時填色碼、圖片 URL 與縮圖 URL。
3. 從頻道選單指定目標頻道。
4. 按 **預覽** 檢查內容。
5. 按 **送出**，再按 **確認送出**。

至少要有標題或描述才能預覽、儲存模板或送出。色碼需為 6 位 hex，例如 `#F4A7B9`；圖片與縮圖必須使用 `http` 或 `https` URL。

送出前仍可以返回編輯。確認送出後草稿會鎖定，不能重複送出。

### 儲存與使用模板

在草稿控制面板按 **儲存模板** 並輸入名稱。同一個伺服器內使用相同名稱會更新舊模板。

列出模板：

```text
/embed template list
```

載入模板：

```text
/embed template use name:公告模板
```

載入後會建立新的記憶體草稿，仍需選擇目標頻道並確認送出。

目前沒有模板刪除指令，也沒有 Embed fields 的編輯介面。先別把公告格式設計到需要二十種欄位，現在這版不打算養那個複雜度。

## 設定 Honeypot 誘捕頻道

Honeypot 會對在指定頻道發言的非工作人員採取動作。正式啟用前，先確認管理紀錄頻道、Bot 權限與身份組階層，並用測試帳號驗收。

### 使用 timeout

```text
/honeypot add channel:#請勿發言 action:timeout timeout_minutes:10
```

如果省略 `timeout_minutes`，會使用 `HONEYPOT_TIMEOUT_SECONDS`，預設 600 秒。可輸入 1 到 40320 分鐘，Discord 的 timeout 上限是 28 天。

### 使用 ban

```text
/honeypot add channel:#請勿發言 action:ban
```

`timeout_minutes` 對 ban 沒有效果。

設定成功時，Bot 會嘗試在頻道張貼紅色警告 Embed。若它回覆無法貼出警告，**honeypot 設定仍可能已保存並開始生效**。這時請立刻調整權限、手動張貼警告，或先執行 remove；不要放著一個沒有標示的陷阱頻道。

列出目前設定：

```text
/honeypot list
```

移除：

```text
/honeypot remove channel:#請勿發言
```

### 實際處置流程

一般成員發言後，Bot 會：

1. 嘗試刪除訊息。
2. 依設定 timeout 或 ban。
3. 將動作寫入 PostgreSQL 管理紀錄。
4. 若已設定管理紀錄頻道，再張貼一則管理 Embed。

伺服器擁有者與持有 `Manage Messages` 的成員視為工作人員，不會被處置。其他管理身份組若沒有 `Manage Messages`，不會因為名稱看起來像管理員就自動豁免。

## 環境變數調整

以下值都有預設值，不填也能啟動：

| 變數                               | 預設值        | 用途                           |
| ---------------------------------- | ------------- | ------------------------------ |
| `ACTIVITY_TIME_ZONE`               | `Asia/Taipei` | 每日分界與活躍身份組排程時區     |
| `ACTIVITY_CHAT_COOLDOWN_MS`        | `60000`       | 同一成員兩次聊天計數的最短間隔 |
| `ACTIVITY_VOICE_DAILY_CAP_SECONDS` | `14400`       | 每日語音累計上限               |
| `ACTIVITY_INTERACTION_DAILY_CAP`   | `20`          | 每日互動累計上限               |
| `ACTIVE_MEMBER_WINDOW_DAYS`        | `30`          | 活躍分數滾動天數               |
| `ACTIVE_MEMBER_CRON`               | `0 4 * * *`   | 活躍身份組更新排程               |
| `EMBED_DRAFT_TTL_MINUTES`          | `60`          | Embed 草稿存活時間             |
| `HONEYPOT_TIMEOUT_SECONDS`         | `600`         | Honeypot 預設 timeout 秒數     |

修改 `.env` 後需要重新啟動 Bot。排程值若不是有效 cron expression，Bot 仍可上線，但活躍身份組 sweep 不會被排程，log 會留下錯誤。

## 常見問題

### Slash commands 沒出現

1. 確認邀請時包含 `applications.commands` scope。
2. 確認 `DISCORD_CLIENT_ID` 正確。
3. 開發時設定 `DISCORD_GUILD_ID` 後重啟 Bot。
4. 若使用全域註冊，等待 Discord 完成同步。

### Bot 在線，但活躍度、歡迎或離開事件沒反應

檢查 Server Members Intent 與 Message Content Intent 是否已在 Developer Portal 開啟。也要確認 Bot 能看到相關頻道；歡迎與離開紀錄頻道至少需要 View Channel 與 Send Messages。

### Bot 無法發放身份組

檢查：

- Bot 是否有 Manage Roles。
- 目標身份組是否在 Bot 最高身份組下方。
- 目標身份組是否由 integration 管理。
- Bot 是否能管理目標成員。

### Embed 草稿顯示過期或不存在

草稿超過 TTL、Bot 已重啟，或草稿本來就不是由目前帳號建立。重新執行 `/embed draft` 或從模板建立即可。

### Honeypot 沒有處置成員

確認 Bot 具有 Manage Messages，以及對應的 Moderate Members 或 Ban Members。若成員身份組高於 Bot、成員是伺服器擁有者，或持有 Manage Messages，Bot 不會處置。

### 資料庫 migration 失敗

先確認 `DATABASE_URL` 存在、連線字串完整且資料庫可連線。migration 使用 repository 根目錄的 `.env`，並要求 SSL。不要用重設資料庫當第一個排錯動作，那通常只會把原本的問題換成一個更大的問題。

## 上線前驗收清單

- [ ] `/ping` 正常回覆。
- [ ] `/config view` 顯示預期設定。
- [ ] 歡迎、離開與管理紀錄頻道都能收到訊息。
- [ ] Bot 能替測試帳號新增與移除一般身分組。
- [ ] `/activity me` 與 `/activity stats` 能正常讀取彙整。
- [ ] 限時 Role Menu 在開始前、期間中與結束後行為正確。
- [ ] Embed 可以預覽、返回編輯、確認送出，且不會重複送出。
- [ ] Honeypot timeout 先用測試帳號驗證。
- [ ] 若要使用 ban，再確認 Bot 與測試帳號的身份組階層。
- [ ] 重啟 Bot 後 slash commands、排程與資料庫連線正常。

目前沒有 Web 後台，所以這份手冊和 `/config view` 就是主要操作入口。設定有改就留下紀錄，不然三個月後最難查的通常不是 bug，是「當初到底為什麼設成這樣」。
