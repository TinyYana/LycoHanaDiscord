# 彼岸花 Discord Bot v3.0

彼岸花社群的日常營運 Bot。把活躍度、身分組、歡迎訊息、Embed 和基本防護集中在同一套流程裡，少一點散落的人工操作，也不要為了一個社群工具養出一整座後台。

**繁體中文** · [English](./README.md)

## 這個專案在做什麼

這是我為彼岸花 Discord 社群整理的第三版 Bot。它處理那些會一直重複、但又不值得每天手動盯著做的事情：記錄活躍痕跡、發放活躍成員身分組、讓成員自行領取身分組，以及留下必要的管理紀錄。

目前的範圍刻意壓在「社群營運核心」。它不是通用型 Discord Bot 平台，也沒有另外做 Web 管理介面；設定主要透過 slash commands 和環境變數完成。

## 目前功能

- **活躍度痕跡**：按日彙整聊天、圖片、音樂分享、回覆／反應與語音時間，不保存原始訊息內容。
- **活躍成員身分組**：用高低兩個門檻發放與回收身分組，避免分數在邊界附近時反覆切換，也能設定豁免身分組。
- **自助身分組選單**：管理員可以建立按鈕選單，並選擇性設定開放時間。
- **歡迎與離開紀錄**：歡迎訊息可開關，離開紀錄只送到管理員指定的私人頻道。
- **Embed 草稿與模板**：先在只有管理員看得到的草稿面板預覽、確認，再送到指定頻道；模板會保存到資料庫，未送出的草稿只存在記憶體。
- **誘捕頻道（honeypot）**：非工作人員在誘捕頻道發言時，自動刪除訊息並依設定禁言或封鎖，同時留下管理紀錄。
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

   開發時建議另外設定 `DISCORD_GUILD_ID`。Bot 啟動時會把 slash commands 註冊到該伺服器，更新通常會立即出現；沒設定時則註冊為全域指令。

   `DATABASE_URL` 可以使用 Supabase 的 direct connection（5432）或 transaction pooler（6543）。程式會強制使用 SSL，並關閉 prepared statements 以相容兩種連線方式。不要提交 `.env`，也不要把 Bot token 或資料庫密碼貼進 issue、log 或截圖。

4. 套用資料庫 migration：

   ```bash
   pnpm db:migrate
   ```

5. 建置並啟動：

   ```bash
   pnpm build
   pnpm --filter @lycohana/bot start
   ```

開發時可以直接執行：

```bash
pnpm dev
```

Bot 每次啟動都會同步 slash-command definitions，接著才登入 Discord。

## 環境變數

完整範例與預設值請看 [`.env.example`](./.env.example)。

| 變數                       | 必填 | 用途                                  |
| -------------------------- | ---- | ------------------------------------- |
| `DISCORD_TOKEN`            | 是   | Discord Bot token                     |
| `DISCORD_CLIENT_ID`        | 是   | Discord Application ID                |
| `DATABASE_URL`             | 是   | PostgreSQL / Supabase 連線字串        |
| `DISCORD_GUILD_ID`         | 否   | 開發時只註冊到單一伺服器              |
| `NODE_ENV`                 | 否   | `development`、`production` 或 `test` |
| `LOG_LEVEL`                | 否   | `debug`、`info`、`warn` 或 `error`    |
| `ACTIVITY_*`               | 否   | 時區、聊天冷卻、語音與互動上限        |
| `ACTIVE_MEMBER_*`          | 否   | 活躍成員計算視窗與排程                |
| `EMBED_DRAFT_TTL_MINUTES`  | 否   | 記憶體內 Embed 草稿存活時間           |
| `HONEYPOT_TIMEOUT_SECONDS` | 否   | 誘捕頻道的預設禁言秒數                |

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

聊天冷卻、進行中的語音區段和未送出的 Embed 草稿都只放在記憶體裡。Bot 重啟後這些暫存狀態會消失；已完成的每日彙整、伺服器設定、模板和管理紀錄則留在 PostgreSQL。這是目前刻意接受的取捨，省下一套暫存狀態的維護成本。

## 常用開發指令

| 指令                | 用途                             |
| ------------------- | -------------------------------- |
| `pnpm build`        | 建置所有 workspace packages      |
| `pnpm dev`          | 監看檔案並啟動 Bot               |
| `pnpm typecheck`    | 執行 TypeScript type check       |
| `pnpm lint`         | 執行 ESLint                      |
| `pnpm format`       | 使用 Prettier 寫入格式           |
| `pnpm format:check` | 檢查格式但不修改檔案             |
| `pnpm db:generate`  | 依 Drizzle schema 產生 migration |
| `pnpm db:migrate`   | 將既有 migrations 套用到資料庫   |

## 授權

這個 repository 使用 [TinyYana Universal Software License 1.0](./LICENSE)。你可以閱讀、使用、修改與整合程式碼，也可以放進個人或商業專案；若要直接把這套 Bot、本身的功能或介面包裝成主要營利產品，請先取得我的書面同意。

README 只是摘要，實際權利與限制以 `LICENSE` 為準。授權或商業使用問題可以寄到 [admin@tinyyana.com](mailto:admin@tinyyana.com)。
