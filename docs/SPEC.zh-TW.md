# 彼岸花 Bot v3 功能規格

> 狀態：截至 2026-06-20 的已實作基線  
> 對象：社群管理員、維護者與後續開發者  
> 核心原則：用一個可設定、可追蹤、可安全失敗的 Bot 處理彼岸花 Discord 的社群營運核心，不長成通用 Bot 平台。

## 1. 產品邊界先守住社群營運核心

彼岸花 Bot v3 負責重複性高、適合自動化、又需要留下明確狀態的社群營運工作：活躍度彙整、活躍成員身分組、自助身分組、歡迎與離開紀錄、動態語音、Embed 發送，以及 honeypot 管理防護。

這一版明確不做：

- Web 管理後台。
- 經濟、商店、抽卡或 RPG 系統。
- 公開成員排行榜。
- 通用 Bot plugin 平台。
- 保存原始訊息內容或語音內容。
- 未經管理員確認的批次身分組、頻道或權限變更。

## 2. 三層架構讓規則、資料與 Discord 行為各自有主人

專案是 pnpm workspace monorepo，依賴方向固定為：

```text
packages/domain  →  packages/db  →  apps/bot
```

- `packages/domain`：不依賴 Discord 或 Drizzle 的純規則，例如計分、門檻、日期視窗與辨識。
- `packages/db`：Drizzle schema、migration、PostgreSQL client 與 feature repository。
- `apps/bot`：discord.js client、slash commands、events、scheduler 與各 feature module。
- `apps/bot/src/index.ts` 只負責組裝；feature 透過 dependencies 接收 logger、repositories 與 runtime config。

## 3. 權限分層避免把所有能力都塞給所有人

### 一般成員

- 使用 `/ping`、`/activity me`。
- 操作已發布的 Role Menu。
- 加入動態語音入口並管理自己建立的頻道。

### Discord 管理員

- 使用 `/config`、`/activity stats`、`/role-menu create`、`/embed`、`/honeypot`。
- 設定 guild 專屬頻道、角色、門檻與權重。

### Bot 建議權限

- 基本訊息：View Channels、Send Messages、Embed Links、Read Message History。
- 角色功能：Manage Roles，且 Bot 最高身分組必須高於目標角色與成員。
- 動態語音：Manage Channels、Manage Roles、Move Members、View Channel、Connect。
- Honeypot：Manage Messages，以及依動作需要 Moderate Members 或 Ban Members。

Bot 不要求一律給 Administrator；實際只授予已啟用功能所需的權限。

## 4. 活躍度只保存計數，不保存原始對話

### 4.1 計數來源

- 聊天：同一成員受可設定 cooldown 限制，預設 60 秒最多一次。
- 圖片：依附件 MIME type 或副檔名辨識，每則訊息最多一次。
- 音樂分享：辨識 Spotify、YouTube／YouTube Music、SoundCloud、Apple Music、Bandcamp、Deezer 與 Tidal。
- 互動：回覆其他真人成員或新增 reaction；有可設定每日上限。
- 語音：非 AFK 頻道內至少兩位真人時才累計；有可設定每日秒數上限。

### 4.2 儲存與查詢

- `activity_daily` 以 guild、user、date 保存每日彙整。
- 原始訊息本文、附件內容與語音內容都不寫入資料庫。
- `/activity me` 顯示本人本月聊天、語音、圖片、音樂與互動彙整。
- `/activity stats` 供管理員查看滾動視窗內的活躍人數、最低／中位／最高分與門檻分布，不提供公開排行榜。

### 4.3 暫存邊界

聊天 cooldown 與進行中的語音 session 只存在記憶體；Bot 重啟時未完成 session 不補算。已落入 `activity_daily` 的彙整會保留。

## 5. 活躍成員身分組用雙門檻避免反覆跳動

- 排程依 `ACTIVE_MEMBER_CRON` 執行，預設為 Asia/Taipei 每日 04:00。
- 計算 `ACTIVE_MEMBER_WINDOW_DAYS` 指定的滾動視窗，預設 30 天。
- 分數大於或等於 high：加入活躍成員身分組。
- 分數小於 low：移除活躍成員身分組。
- 分數落在 high 與 low 之間：維持原狀。
- Bot、持有任一 exempt role 的成員，以及 Bot 無法管理的成員／角色不變更。
- 敏感權限角色需經共用 role policy 阻擋，避免活動流程授予高權限角色。

管理員透過 `/config active-role`、`/config thresholds`、`/config weights`、`/config exempt-add` 與 `/config exempt-remove` 維護設定。

## 6. 動態語音頻道完整處理建立、所有權與清理

### 6.1 管理員設定入口

```text
/config dynamic-voice enabled:True channel:<語音入口>
```

- 入口頻道 ID 存在 `guild_config.dynamic_voice_trigger_channel_id`，不寫死在程式碼。
- `enabled:False` 會停止建立新頻道，但既有動態頻道仍會在變空時清理。
- `/config view` 顯示目前入口；沒有入口時視為停用。

### 6.2 成員加入後的建立流程

1. 忽略 Bot 與非設定入口的 Voice State Update。
2. 在入口相同分類建立 `DisplayName 的語音頻道`；名稱上限 100 字元。
3. 給建立者 View Channel、Connect、Speak、Manage Channels 與 Manage Roles 的頻道權限覆寫，使其可改名與管理該頻道權限。
4. 將 channel ID、guild ID 與 owner ID 寫入 `dynamic_voice_channels`。
5. 確認成員仍在入口，再將成員移入新頻道。

同一位成員的同時建立事件會以 process 內的 in-flight guard 合併，避免單次加入重複建立。

### 6.3 失敗與清理流程

- 建立後若 DB 保存或成員移動失敗，Bot 會嘗試刪除空殼頻道並移除追蹤紀錄。
- 若成員在建立完成前已離開入口，Bot 不會把人強制拉回去，而是回滾新頻道。
- 任何成員離開／切換頻道時，若舊頻道存在於 `dynamic_voice_channels` 且成員數為 0，Bot 會刪除頻道與 DB 紀錄。
- 頻道被手動刪除時，`ChannelDelete` 事件會清除 DB 紀錄。
- Bot 啟動完成後會 reconcile 全部追蹤紀錄：不存在的頻道移除紀錄；仍有人使用的頻道保留；空頻道刪除。
- 無法安全判定或 Discord API 暫時失敗時保留紀錄並寫 error log，不猜測、不刪普通頻道。

## 7. Role Menu 讓成員自助切換低風險身分組

- `/role-menu create` 建立按鈕式選單。
- 每個選單 1–5 個 role options；role 與 label 必須成對。
- 可設定 ISO 8601 `available_from`／`available_until`；開始前與結束後拒絕操作。
- 成員按一次加入角色，再按一次移除。
- 選單與 options 保存於 `role_menus`、`role_menu_options`，Bot 重啟後仍可處理既有按鈕。
- Bot 需有 Manage Roles，角色必須可管理且不得命中敏感權限 policy。

目前沒有 list、edit、delete 指令；手動刪 Discord 訊息不會同步刪 DB 紀錄。

## 8. 歡迎與離開紀錄各自獨立開關

- `/config welcome enabled:<bool> channel:<文字頻道>` 控制歡迎訊息。
- 歡迎格式為 `歡迎 @成員 來到 伺服器名稱！`。
- `/config leave-log enabled:<bool> channel:<文字頻道>` 控制離開紀錄。
- 離開紀錄包含成員 tag 與 Discord user ID。
- 頻道不存在或不可寫時不吞錯，會留下 structured error log。

## 9. Embed 草稿把編輯、預覽與送出拆開

- `/embed draft` 建立只供建立者操作的 ephemeral 草稿面板。
- 可編輯標題、描述、footer、色碼、圖片與縮圖 URL。
- 需先指定可寫入的目標文字／公告頻道。
- 預覽後仍能返回修改；確認送出後草稿鎖定，避免重複發送。
- 草稿只存在記憶體，受 `EMBED_DRAFT_TTL_MINUTES` 控制，預設 60 分鐘。
- 模板保存於 `embed_templates`；同 guild、同名稱會更新既有模板。
- `/embed template list` 列出模板，`/embed template use` 載入成新草稿。

目前沒有模板刪除指令，也沒有 Embed fields 編輯介面。

## 10. Honeypot 是小型安全網，不是完整 moderation 平台

- `/honeypot add` 將文字頻道設為誘捕頻道，動作為 timeout 或 ban。
- timeout 可設定分鐘數；省略時使用 `HONEYPOT_TIMEOUT_SECONDS`，並受 Discord 28 天平台上限約束。
- 非工作人員發言後，Bot 依序嘗試刪除訊息、執行處置、寫入 `moderation_logs`，再視設定送到管理紀錄頻道。
- 伺服器擁有者與持有 Manage Messages 的成員視為工作人員。
- `/honeypot list` 顯示目前設定，`/honeypot remove` 移除。
- 新增 honeypot 時會嘗試張貼公開警告；警告貼不出去不代表設定未保存，管理員必須立即補權限、手動警告或移除設定。

## 11. `/config` 是目前唯一的 guild 設定入口

`/config view` 顯示：

- 活躍成員身分組。
- high／low 門檻與五種活動權重。
- exempt roles。
- 歡迎、離開與管理紀錄頻道。
- 動態語音入口。

所有 `/config` subcommands 僅限 Administrator。任何 operator 可能調整的 channel、role、threshold、weight、cron、TTL 或 cap 都必須來自 guild DB config 或經驗證的 env，不得寫死 ID。

## 12. 八張 PostgreSQL 表保存需要跨重啟延續的狀態

- `guild_config`：每 guild 的頻道、角色、門檻、權重與豁免設定。
- `activity_daily`：每日活躍彙整。
- `role_menus`：Role Menu 主資料。
- `role_menu_options`：Role Menu 按鈕與角色對應。
- `embed_templates`：可重用 Embed 模板。
- `moderation_logs`：管理動作紀錄。
- `honeypot_channels`：誘捕頻道設定。
- `dynamic_voice_channels`：Bot 建立的動態語音頻道與 owner。

Bot 透過 postgres.js 直接連 Supabase PostgreSQL，使用 SSL 並設定 `prepare: false` 以相容 Supavisor transaction pooler。Data API 是否暴露是另一條安全邊界：`public` schema 若暴露，必須限制 anon／authenticated grants 並啟用符合實際存取模型的 RLS。repo 內的 manual hardening SQL 預設拒絕 Data API roles，但需由 operator 在 live project 驗證後手動套用。

## 13. 環境變數只放跨 guild 的 runtime tunables

必要：

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DATABASE_URL`

選填：

- `DISCORD_GUILD_ID`：開發時註冊到單一測試 guild。
- `LOG_LEVEL`、`NODE_ENV`。
- `ACTIVITY_TIME_ZONE`、聊天 cooldown、voice／interaction／image／music caps。
- `ACTIVE_MEMBER_WINDOW_DAYS`、`ACTIVE_MEMBER_CRON`。
- `EMBED_DRAFT_TTL_MINUTES`。
- `HONEYPOT_TIMEOUT_SECONDS`。

Secret 只放 `.env` 或部署平台 secret store；不得寫入原始碼、文件、log、issue 或截圖。

## 14. 錯誤必須可見，外部副作用必須可追

- Event handler 各自 containment error，透過 structured logger 紀錄 guild、user、channel 與可讀錯誤。
- DB 與 Discord 跨系統流程採最小 rollback／補償，不假裝有分散式 transaction。
- Slash command 回覆管理設定時使用 ephemeral，避免把管理細節灑到公開頻道。
- Live login、slash-command registration、正式 migration、bulk role／channel／permission 變更由 operator 執行。

## 15. 驗收要同時看離線檢查與測試 guild 行為

### 已完成的離線驗證

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test`：24 tests passed
- `git diff --check`
- Drizzle 已產生 `0001_abnormal_exiles.sql` 與 metadata。

### 動態語音測試 guild 驗收

- [ ] 套用 `0001_abnormal_exiles.sql`。
- [ ] 註冊更新後的 slash commands。
- [ ] `/config dynamic-voice` 可啟用、停用與顯示入口。
- [ ] 真人加入入口後只建立一個同分類語音頻道。
- [ ] 預設名稱正確，超長 DisplayName 不超過 Discord 上限。
- [ ] 建立者可改名稱與該頻道 permission overwrites。
- [ ] 建立者被移入新頻道，不會在已離開入口時被拉回。
- [ ] 有其他成員時保留頻道；最後一人離開後刪除。
- [ ] 手動刪頻道會清 DB 紀錄。
- [ ] Bot 重啟後保留有人頻道、刪除空頻道、清除不存在的紀錄。
- [ ] 缺少 Manage Channels／Manage Roles／Move Members 時 error log 可定位問題。

### 全功能上線前驗收

- [ ] 活躍度、high／low 門檻與 exempt roles 符合預期。
- [ ] Role Menu 在開始前、開放中、結束後都符合規則。
- [ ] 歡迎與離開紀錄可到達指定頻道。
- [ ] Embed 可預覽、返回、確認送出且不重複。
- [ ] Honeypot 先以測試帳號驗證 timeout，再決定是否驗證 ban。
- [ ] Supabase live project 已確認 exposed schemas、grants、連線角色與八張表 RLS。

## 16. 下一個里程碑是部署與實機驗收，不是繼續長功能

目前程式、migration、測試與文件已具備動態語音功能的完整基線，但尚未執行正式 DB migration、真實 Bot login、slash-command registration 或 Discord 測試 guild 驗收。下一步應先完成這些 operator 動作並記錄結果；在權限、角色階層與重啟生命週期跑通前，不擴張到 Web dashboard、經濟系統或更多娛樂功能。
