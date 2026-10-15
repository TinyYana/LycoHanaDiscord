# 彼岸花 Discord Bot v3.0

彼岸花社群的日常營運 Bot。把活躍度、身分組、歡迎訊息、Embed 和基本防護集中在同一套流程裡，少一點散落的人工操作，也不要為了一個社群工具養出一整座後台。

**繁體中文** · [English](./README.md) · [管理員使用手冊](./docs/USER_GUIDE.zh-TW.md) · [完整功能規格](./docs/SPEC.zh-TW.md)

## 這個專案在做什麼

這是我為彼岸花 Discord 社群整理的第三版 Bot。它處理那些會一直重複、但又不值得每天手動盯著做的事情：記錄活躍痕跡、發放活躍成員身分組、讓成員自行領取身分組，以及留下必要的管理紀錄。

目前的範圍刻意壓在「社群營運核心」。它不是通用型 Discord Bot 平台，設定主要透過 slash commands 和環境變數完成。唯一的例外是一個**只在本機提供的管理面板**（見[本機管理面板](#本機管理面板)），沒有對外開放的 Web 管理介面。

## 目前功能

- **活躍度痕跡**：按日彙整聊天、圖片、音樂分享、回覆／反應與語音時間，不保存原始訊息內容。
- **活躍成員身分組**：用高低兩個門檻發放與回收身分組，避免分數在邊界附近時反覆切換，也能設定豁免身分組。
- **自助身分組選單**：管理員可以建立按鈕選單，並選擇性設定開放時間。
- **歡迎與離開紀錄**：歡迎訊息可開關，離開紀錄只送到管理員指定的私人頻道。
- **Embed 草稿與模板**：先在只有管理員看得到的草稿面板預覽、確認，再送到指定頻道；模板會保存到資料庫，未送出的草稿只存在記憶體。
- **誘捕頻道（honeypot）**：非工作人員在誘捕頻道發言時，自動刪除訊息並依設定禁言或封鎖，同時留下管理紀錄。
- **動態語音頻道**：成員加入指定入口後，建立由該成員管理的語音頻道；最後一人離開時自動刪除。
- **伺服器個別設定**：頻道、門檻、權重與身分組 ID 都存進資料庫，不寫死在原始碼裡。

## 技術組成

- Node.js 20+、TypeScript、discord.js v14
- pnpm workspace monorepo
- Drizzle ORM、PostgreSQL（目前使用 Supabase）
- Zod、Pino、node-cron

```text
apps/bot/         Discord client、指令、事件、排程與互動流程
packages/db/      Drizzle schema、migration、資料庫 client 與 repositories
packages/domain/  不依賴 discord.js 的計分、門檻、時間與驗證邏輯
```

## 開始之前

你會需要：

- Node.js 20 或更新版本
- pnpm
- 一個 Discord Application / Bot
- 一個 PostgreSQL 資料庫；目前的設定與 migration 以 Supabase PostgreSQL 為準

在 Discord Developer Portal 的 Bot 設定中，請開啟：

- **Server Members Intent**
- **Message Content Intent**

邀請 Bot 時需要 `bot` 與 `applications.commands` scopes。權限則依你啟用的功能給予即可，常用的有：

- View Channels、Send Messages、Embed Links
- Manage Roles（活躍成員與自助身分組）
- Manage Channels、Manage Roles、Move Members（動態語音頻道）
- Manage Messages、Moderate Members、Ban Members（誘捕頻道）

Bot 的身分組必須排在它要管理的身分組與成員之上。沒有這個層級，再多權限也不會突然變成魔法。

## 安裝與啟動

1. 安裝 dependencies：

   ```bash
   pnpm install
   ```

2. 複製環境變數範例：

   ```powershell
   Copy-Item .env.example .env
   ```

   macOS / Linux 可以使用：

   ```bash
   cp .env.example .env
   ```

3. 填入 `.env` 最少需要的三個值：

   ```dotenv
   DISCORD_TOKEN=
   DISCORD_CLIENT_ID=
   DATABASE_URL=postgresql://...
   ```

   開發時建議另外設定 `DISCORD_GUILD_ID`，slash commands 會註冊到該伺服器，更新通常會立即出現；沒設定時則註冊為全域指令。

   `DATABASE_URL` 可以使用 Supabase 的 direct connection（5432）或 transaction pooler（6543）。程式會強制使用 SSL，並關閉 prepared statements 以相容兩種連線方式。不要提交 `.env`，也不要把 Bot token 或資料庫密碼貼進 issue、log 或截圖。

4. 套用資料庫 migration：

   ```bash
   pnpm db:migrate
   ```

5. 建置並啟動：

   ```bash
   pnpm build
   pnpm start
   ```

開發時可以直接執行：

```bash
pnpm dev
```

### 正式環境啟動與更新

PM2 需全域安裝（`npm i -g pm2`）。

1. 首次啟動：`pnpm build && pm2 start ecosystem.config.cjs`
2. 日常更新：`pnpm bot:update && pnpm bot:pm2`
3. 不用 PM2：`pnpm bot:update && pnpm start`（Windows 可用 `run.bat update`）

`bot:update` 會執行 `git pull`、`pnpm install --frozen-lockfile`、`pnpm build`，**不會**動資料庫：若拉下來的版本在 `packages/db/drizzle/` 有新檔案，重啟前請多跑 `pnpm db:migrate`。`bot:pm2` 執行 `pm2 startOrRestart ecosystem.config.cjs`（沒在跑就啟動，已在跑就重啟）。

### Slash commands 註冊

Bot 啟動時會對指令定義（含 application 與 guild 目標）算 hash，只有和 `.runtime/commands.hash`（已 gitignore）不同時才註冊。一般重啟會跳過註冊，拉到新指令時則自動同步；註冊失敗只記錄錯誤，Bot 仍會登入。`COMMANDS_REGISTER_MODE` 可設 `auto`（預設）、`always`、`off`；`pnpm commands:register` 會強制註冊並更新 hash。

活躍成員功能、`/config` 門檻與權重、PM2 metrics 的文字放在 `apps/bot/messages/zh-TW.json`，修改後不必重啟即生效（slash command 選項說明在下次註冊時生效；PM2 metric 名稱在下次啟動時生效）。

## 本機管理面板

Bot 執行時會在 **http://127.0.0.1:2615/** 提供一個管理頁面（只聽 loopback）。

- **能做：** 看運行狀態（Discord 是否就緒、ping、伺服器數、最近一次掃描的狀態／時間／原因、發放／回收／失敗累計）；依伺服器查看每位候選成員的活躍判定（有效高標／低標、計分窗口、回收停用原因、分數、是否持有身分組、豁免、動作與原因），可用使用者 ID 或名稱篩選；修改活躍身分組、高標／低標、權重與豁免身分組。保存走和 `/config` 相同的驗證（錯誤會擋下並逐欄顯示；低標 = 0 這類警告照存並顯示），存完會從資料庫讀回並以讀回值顯示。下一次排程掃描就會用新設定。
- **不能做：** 套用身分組。成員判定是**預覽，不會套用**——不會發放或回收任何身分組，也沒有套用按鈕。沒有 shell、SQL、批次改身分組或遠端存取。
- **設定：** `ADMIN_PANEL_PORT`（預設 `2615`）改埠號；`ADMIN_PANEL_ENABLED=false` 停用。Host 固定 `127.0.0.1`，不可調。埠號被占用時會在日誌寫出錯誤與提示，Bot 照常運作、只是沒有面板。
- **遠端主機：** 不要開放這個埠。請自行用 SSH tunnel，例如 `ssh -L 2615:127.0.0.1:2615 user@server`，再在本機開 `http://127.0.0.1:2615/`。
- **安全：** 每個請求的 Host 都必須是 `127.0.0.1:<port>` 或 `localhost:<port>`；寫入另需相符的 Origin、`Content-Type: application/json` 與頁面取得的每次啟動隨機 CSRF token。錯誤只回傳訊息 key，細節只寫進 Bot 日誌。
- 頁面文字在 `apps/bot/messages/zh-TW.json`（`admin.*`）；`apps/bot/src/admin/public/` 的 HTML/CSS/JS 每次請求都從磁碟讀，修改後重新整理即可。

## 環境變數

完整範例與預設值請看 [`.env.example`](./.env.example)。

| 變數                       | 必填 | 用途                                   |
| -------------------------- | ---- | -------------------------------------- |
| `DISCORD_TOKEN`            | 是   | Discord Bot token                      |
| `DISCORD_CLIENT_ID`        | 是   | Discord Application ID                 |
| `DATABASE_URL`             | 是   | PostgreSQL / Supabase 連線字串         |
| `DISCORD_GUILD_ID`         | 否   | 開發時只註冊到單一伺服器               |
| `NODE_ENV`                 | 否   | `development`、`production` 或 `test`  |
| `LOG_LEVEL`                | 否   | `debug`、`info`、`warn` 或 `error`     |
| `ACTIVITY_*`               | 否   | 時區、聊天冷卻、語音與互動上限         |
| `ACTIVE_MEMBER_*`          | 否   | 活躍成員計算視窗與排程                 |
| `EMBED_DRAFT_TTL_MINUTES`  | 否   | 記憶體內 Embed 草稿存活時間            |
| `HONEYPOT_TIMEOUT_SECONDS` | 否   | 誘捕頻道的預設禁言秒數                 |
| `COMMANDS_REGISTER_MODE`   | 否   | `auto`（預設）、`always` 或 `off`      |
| `COMMANDS_HASH_FILE`       | 否   | 已註冊指令的 hash 檔                   |
| `MESSAGES_FILE`            | 否   | 介面文字檔（熱重載）                   |
| `SHUTDOWN_TIMEOUT_MS`      | 否   | 關機逾時上限，需小於 PM2 kill_timeout  |
| `ADMIN_PANEL_ENABLED`      | 否   | 本機管理面板：`true`（預設）或 `false` |
| `ADMIN_PANEL_PORT`         | 否   | 本機管理面板埠號（預設 `2615`）        |

這個 Bot 直接連 PostgreSQL，不需要 Supabase Data API。若 Supabase 專案仍將 `public` schema 暴露給 Data API，請另外限制 API roles 的權限或啟用符合實際存取模型的 RLS；不要因為表格只給 Bot 用，就假設它從外面一定碰不到。

## Slash commands

| 指令                  | 誰可以使用 | 用途                                       |
| --------------------- | ---------- | ------------------------------------------ |
| `/ping`               | 所有人     | 確認 Bot 在線並查看延遲                    |
| `/activity me`        | 所有人     | 查看自己的本月活躍痕跡                     |
| `/activity stats`     | 管理員     | 查看整體活躍概況與門檻分佈                 |
| `/config ...`         | 管理員     | 設定活躍身分組、門檻、權重、豁免與各類頻道 |
| `/role-menu create`   | 管理員     | 建立限時或常駐的自助身分組選單             |
| `/embed draft`        | 管理員     | 建立、預覽並送出 Embed 草稿                |
| `/embed template ...` | 管理員     | 列出或載入已保存模板                       |
| `/honeypot ...`       | 管理員     | 新增、移除或查看誘捕頻道                   |

## 資料與隱私邊界

活躍度只保存每位成員每天的數量彙整，不保存訊息本文。圖片與音樂分享的辨識仍需要讀取附件資訊和訊息內容，因此 Bot 需要 Message Content Intent，但分析完不會把內容寫入資料庫。

聊天冷卻、進行中的語音區段和未送出的 Embed 草稿都只放在記憶體裡。Bot 重啟後這些暫存狀態會消失；已完成的每日彙整、伺服器設定、動態語音頻道歸屬、模板和管理紀錄則留在 PostgreSQL。保存動態語音歸屬，是為了讓 Bot 重啟後仍能安全清理自己建立的空頻道，不必靠名稱猜測。

## 常用開發指令

| 指令                     | 用途                             |
| ------------------------ | -------------------------------- |
| `pnpm build`             | 建置所有 workspace packages      |
| `pnpm dev`               | 監看檔案並啟動 Bot               |
| `pnpm typecheck`         | 執行 TypeScript type check       |
| `pnpm lint`              | 執行 ESLint                      |
| `pnpm format`            | 使用 Prettier 寫入格式           |
| `pnpm format:check`      | 檢查格式但不修改檔案             |
| `pnpm db:generate`       | 依 Drizzle schema 產生 migration |
| `pnpm db:migrate`        | 將既有 migrations 套用到資料庫   |
| `pnpm start`             | 啟動已建置的 Bot                 |
| `pnpm bot:update`        | `git pull`、安裝依賴並建置       |
| `pnpm bot:pm2`           | 以 PM2 啟動或重啟 Bot            |
| `pnpm commands:register` | 強制註冊 slash commands          |

## 授權

這個 repository 使用 [TinyYana Universal Software License 1.0](./LICENSE)。你可以閱讀、使用、修改與整合程式碼，也可以放進個人或商業專案；若要直接把這套 Bot、本身的功能或介面包裝成主要營利產品，請先取得我的書面同意。

README 只是摘要，實際權利與限制以 `LICENSE` 為準。授權或商業使用問題可以寄到 [admin@tinyyana.com](mailto:admin@tinyyana.com)。
