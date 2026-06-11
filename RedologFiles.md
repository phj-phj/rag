# RedologFiles — 开发日志

## 2026-05-07

### 项目初始化

- 使用 Vite + Vue 3 创建前端项目（`frontend/`）
- 使用 Node.js + Express 创建后端项目骨架（`backend/`）

### TypeScript 配置

- 安装 typescript、vue-tsc、@types/three
- 创建 tsconfig.json、tsconfig.app.json、tsconfig.node.json
- 创建 vite-env.d.ts Vue 类型声明
- 将 vite.config.js 转换为 vite.config.ts
- 将 main.js 转换为 main.ts
- 将 router/index.js 转换为 router/index.ts

### 前端页面

- **文档库页面**（DocumentLibrary.vue）：将原 index.html 设计稿转换为 Vue 组件
  - 顶部导航栏（Logo、导航菜单、搜索框、后台页面跳转、上传按钮、头像）
  - 侧边栏（浏览区、分类区、标签区）
  - 统计卡片（总文档数、活跃分享、团队成员、存储用量）
  - 精选文档区域
  - 文档卡片列表（类型标识、标题、摘要、作者、时间）

- **后台管理页面**（AdminDashboard.vue）：数据概览页面
  - 统计卡片组件（StatsCards.vue）
  - Three.js 3D 柱状图组件（CategoryChart.vue）：文档分类占比可视化
  - ECharts 折线图组件（UploadTrend.vue）：最近 7 天上传趋势
  - 最近活动列表

### 路由配置

- `/` → 文档库页面（DocumentLibrary.vue）
- `/admin` → 后台管理页面（AdminDashboard.vue）

### 后端骨架

- 创建 backend 目录结构：config、routes、controllers、models、middleware
- 创建 app.js（Express 入口）
- 创建 .env（数据库连接配置）
- 创建 config/db.js（MySQL 连接池）

### 样式方案

- 前端使用 Tailwind CSS
- 文档库页面保留原设计稿的自定义 CSS 变量体系

## 2026-05-14

### 后端重构：JS → TypeScript

- 删除旧的 `backend/app.js` 和 `backend/config/db.js`
- 新建 TypeScript 项目结构：`backend/src/`
  - `app.ts` — Express 入口
  - `config/` — DB 连接与 OSS 配置
  - `controllers/` — 业务逻辑处理
  - `middlewares/` — authMiddleware、uploadMiddleware
  - `models/` — ORM 实体定义（Users, Documents, Categories, Tags, Favorites）
  - `routes/` — 路由分发
  - `services/` — OSS 上传等服务
  - `seed.ts` — 种子数据
- 更新 `backend/package.json`（添加 TypeScript 相关依赖）

### 前端架构搭建

- **API 层**（`frontend/src/api/`）：
  - `client.ts` — Axios 实例（JWT 拦截器、错误处理）
  - `auth.ts`、`document.ts`、`admin.ts`、`favorite.ts` — 按业务划分的请求函数
- **状态管理**（`frontend/src/stores/`）：Pinia stores — `auth.ts`、`admin.ts`、`document.ts`
- **路由守卫**：更新 `router/index.ts`，JWT 校验 + admin 角色检查
- **布局组件**：新建 `AdminLayout.vue`

### 页面开发

- **登录页**：`views/auth/Login.vue`
- **后台管理页**：
  - `views/admin/Dashboard.vue` — 数据概览
  - `views/admin/DocManage.vue` — 文档查询、修改元数据、替换上传
  - `views/admin/UserManage.vue` — 用户管理与密码重置
- 删除旧的 `AdminDashboard.vue`

### 组件更新

- 新建 `TagSelector.vue`（标签选择器）、`UploadDialog.vue`（上传对话框，含大小/数量限制）
- 重构 `DocumentLibrary.vue`（820 行变更，整合 API 与状态管理）
- 更新图表组件：`CategoryChart.vue`、`StatsCards.vue`、`UploadTrend.vue`
- 更新 `main.ts`、`vite.config.ts`

### 文档

- 更新 `CONTEXT.md`（项目规格说明，151 行变更）

## 2026-05-15

### MySQL 环境重建

- 彻底卸载旧版 MySQL（8.0.28 便携版 + 9.7 安装版双服务冲突，同时开机自启）
- 安装 MySQL 8.0.36 至 `C:\mysql\mysql-8.0.36-winx64\`，端口 3306
- 创建管理员 `phj`（全部权限），数据库 `papier`（utf8mb4）
- 更新 `backend/.env` 数据库连接配置
- 运行 `npm run seed` 初始化表及种子数据（默认分类/用户/标签）

### 依赖修复

- **uuid@14 ESM 不兼容修复**：`uuid@14` 为纯 ESM 模块，与项目 CommonJS（tsconfig `module: commonjs`）冲突
  - `backend/src/middlewares/upload.ts`：`import { v4 as uuidv4 } from 'uuid'` → `import crypto from 'crypto'`，`uuidv4()` → `crypto.randomUUID()`
  - `backend/package.json`：移除 `uuid`、`@types/uuid` 依赖

### 后台仪表盘改造

- **恢复 AdminDashboard.vue**：上次提交误删，现重新作为主仪表盘页面
  - 接入 Three.js 3D 旋转柱状图（CategoryChart.vue）— 分类占比，场景自动旋转
  - 接入 ECharts 折线图（UploadTrend.vue）— 7 日上传趋势，渐变填充
  - 最近活动流从硬编码数据改为从 `adminStore.fetchStats()` 获取真实数据
  - 彩色头像渐变（用户名哈希分配）+ 文件类型标签 + 相对时间格式化
- 修复图表无数据时不渲染的问题：移除 `v-if="adminStore.stats"` 条件，图表组件自行处理空状态
- **后端 `admin.controller.ts`**：`getStats` 接口最近活动新增 `file_type` 字段

### 状态管理更新

- `frontend/src/stores/admin.ts`：扩展 `AdminStats` 接口，包含 `categoryStats`、`uploadTrend`、`recentActivities` 完整类型

### 后台管理页面重设计（frontend-design skill）

- **DocManage.vue 重写**：
  - 统一 Header 导航栏（与 AdminDashboard 一致）
  - 搜索栏卡片式设计（SVG 图标 + 焦点 amber 边框）
  - 表格增强：彩色文件类型标签（PDF红/DOC绿等）、用户头像渐变色、标签琥珀色调
  - 操作按钮 hover 显示、加载旋转动画、空状态插画
  - 编辑弹窗：毛玻璃背景 + 缩放动画
- **UserManage.vue 重写**：
  - 统计小卡片（平台用户/管理员/普通用户）
  - 用户列表：头像渐变色 + 角色指示器（admin 琥珀/user 蓝，带圆点）
  - 修改密码弹窗：用户头像 + 成功反馈动画
  - 统一风格 Header

### 路由重构

- 移除 AdminLayout 包裹：三页面各自拥有独立 Header，不再通过 sidebar 嵌套
- 路由简化为 5 条：
  - `/` → DocumentLibrary
  - `/login` → Login
  - `/admin` → AdminDashboard（独立页）
  - `/admin/docs` → DocManage（独立页）
  - `/admin/users` → UserManage（独立页）
- 修复旧路由引用：`/admin/dashboard` → `/admin`（DocumentLibrary.vue、Login.vue）

### 文件清理

- 删除 `frontend/src/views/admin/Dashboard.vue`（被 AdminDashboard.vue 替代）
- 删除 `frontend/src/components/HelloWorld.vue`（Vite 模板残留，无任何引用）
- 保留 `frontend/src/layouts/AdminLayout.vue`（后续可能复用）

### 退出登录功能

- 全部 4 个页面添加头像下拉退出菜单：
  - DocumentLibrary、AdminDashboard、DocManage、UserManage
  - 点击头像 → 弹出下拉（用户名 + 角色 + 退出按钮）
  - 点击页面空白处自动关闭
  - 调用 `authStore.logout()` 清除 token，跳转 `/login`
- 新增点击外部关闭指令逻辑（`onClickOutside` + `document.addEventListener`）

## 2026-05-18

### TXT 文件阅读器

- **DocViewer.vue**：新建 TXT 文件内容展示页面，editorial/杂志风格排版
  - 纸色暖底（`#faf7f2`）+ 琥珀点缀（`#d97706`），思源宋体标题
  - `<pre>` 标签原样展示文本内容，`white-space: pre-wrap` 保留换行
  - 文章头部：文件类型徽章 + 分类标签 + 标题 + 上传者/日期/大小
  - 非 TXT 文件显示下载按钮占位
  - 顶部导航栏含返回/下载按钮 + 头像退出菜单
- **路由**：新增 `/docs/:id` → DocViewer.vue

### 文档库侧边栏计数修复

- **根因**：`total` 变量被"全部文档"和"收藏"视图共用，切换时被覆盖
- **修复**：
  - 新增 `allTotal` ref，通过独立 `loadAllTotal()` 函数获取（`listDocs({pageSize:1})`），与筛选逻辑解耦
  - 新增 `sidebarAllTotal` computed，优先用 `dashboardStats.totalDocs`（来自 stats API），回退到 `allTotal`
  - `clearFilters`、`toggleFavorites`、`onUploadClose`、`onMounted` 均调用 `loadAllTotal()`
  - 上传后同步刷新 stats、categories、favTotal
- **后端 `admin.routes.ts`**：`GET /api/admin/stats` 改为公开接口（移到 `router.use(authenticate)` 之前），不再需要登录

### 中文文件名编码修复

- **后端 `document.controller.ts`**：新增 `decodeFilename()` 函数
  - 浏览器上传中文文件名时，`Content-Disposition` 头中 UTF-8 字节被当 latin1 解析
  - 用 `Buffer.from(name, 'latin1').toString('utf8')` 转回正确的中文

### TXT 文件类型识别修复

- **后端上传**：`file_type` 存的是 MIME 后缀（`text/plain` → `plain`），不是 `txt`
- **前端修复**：`DocumentLibrary.vue` 和 `DocViewer.vue` 的 TXT 判断同时检查 `txt` 和 `plain`

### 分类 API 增强

- **backend `category.routes.ts`**：重写为返回每个分类的文档计数（`docCount`），侧边栏分类旁终于显示数量

### HTML 预览文件

- `files-preview.html`：文档库页面的前端设计稿（网格/列表视图切换）
- `txt-viewer-preview.html`：TXT 阅读器的前端设计稿（编辑风格）
- `file-viewer-preview.html`：文件详情页的早期设计稿

## 2026-05-19

### 文件上传与解析增强

- **移除 PPT/Excel 支持**：
  - 后端 `upload.ts`：移除 4 个 PPT/Excel MIME 类型和 EXT_MAP 映射
  - 前端 `UploadDialog.vue`：移除 accept 属性中的 `.ppt/.pptx/.xls/.xlsx`，更新提示文字
  - `DocumentLibrary.vue` / `AdminDashboard.vue`：删除 PPT/Excel 的 CSS 样式和 TAG_STYLES

- **修复 Word 文件上传 bug**：
  - `document.controller.ts`：`file_type` 从 `file.mimetype.split('/')[1]` 改为 `path.extname(file.filename).slice(1)`
  - 根因：MIME 子类型解析对 Word 文档产生错误值（`application/msword` → `"msword"` 而非 `"doc"`）

- **文本提取服务**（新文件 `backend/src/services/extraction.service.ts`）：
  - PDF 文字提取：`unpdf.extractText`
  - PDF 内嵌图片提取：`unpdf.extractImages` → base64（简历等含照片的文档可展示图片）
  - DOCX 文字提取：JSZip + XML 解析 `word/document.xml`
  - DOCX 内嵌图片提取：JSZip 解压 `word/media/` → base64
  - 依赖：`unpdf`、`jszip`

- **图片格式扩展**：后端 ALLOWED_TYPES 新增 `image/webp`、`image/bmp`

- **文档内容 API**：`GET /api/documents/:id/content` — 返回 `{ text, file_type, images }`

- **前端上传校验增强**：`UploadDialog.vue` 的 `addFiles()` 改为先验后加（预扫描全部文件，超量/超大列出具体文件名）

- **DocViewer 多文件类型支持**：
  - `fileTypeCategory` computed 支持 txt/pdf/word/image/unsupported 五类
  - PDF/Word：文字 + 内嵌图片展示
  - 图片：原生 `<img>` 展示
  - `DocumentLibrary.vue` 的 `openDoc()` 将所有可预览类型路由到 DocViewer

### 全站响应式适配

- **DocumentLibrary.vue**：汉堡菜单（900px 断点）、移动导航覆盖层（slide-down 动画）、侧边栏 FAB 切换按钮（圆形浮动按钮，640px 显示）、侧边栏滑入/关闭、resize 自动适配
- **DocViewer.vue**：768px / 640px 双断点，内边距/字号/嵌入图片尺寸递减
- **UploadDialog.vue**：640px 弹窗边距收紧
- **Login.vue**：`mx-4` 防止小屏贴边
- **AdminLayout.vue**：768px 隐藏侧边栏

### 用户注册功能

- **后端**：`auth.controller.ts` 新增 `register()` — 用户名/密码校验、唯一性检查、bcrypt 哈希、注册即签发 JWT 自动登录
- **路由**：`POST /api/auth/register`
- **前端**：新页面 `Register.vue`（用户名+密码+确认密码、客户端校验、成功后自动登录跳转）、Login.vue 添加"去注册"链接

### "最近文档"页面

- **后端**：`document.controller.ts` 的 `list()` 新增 `uploader_id` 查询参数支持
- **前端**：新页面 `RecentDocs.vue` — 仅展示当前用户上传的文档，全宽布局无侧边栏，含搜索/空状态/分页/响应式
- **路由**：`/recent`（`requiresAuth: true`）
- DocumentLibrary 桌面+移动端"最近"链接改为 `<router-link to="/recent">`

### HTML 预览文件

- `recent-preview.html`："最近文档"页面的前端设计稿（与 DocumentLibrary 一致的深棕顶栏+琥珀色系）

## 2026-05-20

### PDF 文本提取（后端）

- **pdf-parse 集成**：`backend/package.json` 新增 `pdf-parse: ^1.1.1`，通过 `require()` + 类型断言导入（该包无 TS 类型声明）
- **提取服务**（`extraction.service.ts`）新增函数：
  - `extractPdfText()` — 读取 PDF buffer → `pdfParse()` → `cleanText()` → `filterRepeatedLines()`，供 AI 问答使用
  - `extractPdfHtml()` — 同上 + `textToHtml()` 转为结构化 HTML（段落 `<p>`、标题 `<h3>`、列表 `<ul><li>`、代码 `<pre><code>`、分页 `<hr>`）
  - `filterRepeatedLines()` — 按页拆分，统计每行出现频率，超过 60% 页面重复的行标记为页眉/页脚自动删除
  - `isPageNumber()` — 过滤页码模式：纯数字、"1/100"、"Page 1 of 100"、"第 1 页"、"- 1 -"
  - `escapeHtml()` / `textToHtml()` — 纯文本转富文本 HTML，智能段落合并、短行保护、代码块检测
- **内容 API**（`document.controller.ts`）：`getContent` 端点 PDF 跳过逻辑替换为 `extractPdfHtml()` + `extractPdfText()`
- **AI 问答**（`chat.controller.ts`）：PDF 拒绝错误替换为 `extractPdfText()`，支持对 PDF 文档提问

### PDF Canvas 逐页渲染（前端）

- **pdfjs-dist 集成**：`frontend/package.json` 新增 `pdfjs-dist: ^5.7.284`，`vite.config.ts` 配置 `optimizeDeps.exclude` + Worker 独立 chunk
- **DocViewer.vue 重写 PDF 渲染**：
  - 从浏览器原生 `<embed>` 改为 pdfjs-dist Canvas 逐页渲染，100% 保留原始排版
  - 动态 `createElement('canvas')` + `appendChild()` 模式，避免 Vue `v-for` + `:ref` 的 DOM 时序问题
  - 连续滚动布局：所有页面垂直排列，每页底部标注页码
  - 缩放工具栏：`- / 百分比 / +`，`setScale()` 触发全部页面重渲染
  - `devicePixelRatio` 适配：Canvas 内部分辨率 × dpr，CSS 尺寸不变，高分屏清晰
  - `Map.prototype.getOrInsertComputed` polyfill：pdfjs-dist 5.7 依赖 Chrome 专有 API，注入兼容代码
- **时序修复**：`renderAllPages()` 从 `loadPdf()` 移到 `fetchDoc()` 的 `loading = false` 之后，确保容器 DOM 就绪

### 前端类型统一

- **新建** `frontend/src/types/api.ts`：13 个共享 interface（`DocItem`、`OptionItem`、`UserBrief`、`DocListResponse`、`DocContentResponse`、`DocumentListParams`、`ChatMessage`、`ChatAskResponse`、`UserItem`、`DashboardStats`、`AuthUser`、`AuthResponse`）
- **消除重复**：`DocItem` 从 4 处内联定义合并为 1 处 import，`OptionItem` 从 2 处合并
- **更新 8 个文件**：`stores/auth.ts`、`api/document.ts`、`views/DocViewer.vue`、`views/DocumentLibrary.vue`、`views/RecentDocs.vue`、`views/ChatView.vue`、`views/admin/DocManage.vue`、`views/admin/UserManage.vue`
- `DocManage.vue` 保留 `AdminDocItem`（admin API 返回 camelCase `createdAt`，与用户端 API 的 snake_case `created_at` 不同）

## 2026-05-25

### DocumentReader 公共组件提取

- **问题**：ChatView 通过 `<iframe>` 嵌入 `/docs/:id` 加载 DocViewer，导致 AI 助手侧面板中显示完整页面外壳（返回/下载按钮、头像菜单）
- **方案**：将文件渲染逻辑从 DocViewer.vue 抽取为独立组件，ChatView 直接引用
- **新建** `frontend/src/components/DocumentReader.vue`：
  - 包含文章头部（标题、类型徽章、分类、上传者、日期、大小）+ 所有文件渲染（PDF/Word/TXT/图片/不支持类型）+ 加载/错误状态
  - `embedded` prop：嵌入模式下去除外层 padding、shadow、底部 footer，适配侧面板窄屏
  - 通过 `@loaded` 事件向上传递文档数据，供父组件下载按钮使用
- **精简** `frontend/src/views/DocViewer.vue`（~1038 行 → ~200 行）：只保留顶部导航栏（返回/下载/头像）、引用 `<DocumentReader />`
- **改造** `frontend/src/views/ChatView.vue`：`<iframe>` 替换为 `<DocumentReader :embedded="true" />`，侧面板头部新增"在文档库中打开"外链按钮（`<router-link>`）
- **修复** 侧面板高度：`.doc-panel` 添加 `min-height: 0` + `overflow-y: auto`，长文档在面板内滚动而非撑长页面
- Git commit: `2c8c461` — refactor: 提取 DocumentReader 公共组件，消除 AI 助手中的页面外壳

### RAG 第 1 步：文档语义分块

- **目标**：文档上传后自动切块，每块 ≤ 250 字，embedding 可用时按语义边界切分
- **新建** `backend/src/models/DocumentChunk.ts`：
  - 字段：`document_id`、`chunk_index`、`content`、`token_count`、`strategy`（semantic/paragraph）、`heading`（章节标题）、`position_start/end`
  - 通过 `sequelize.sync()` 自动建表 `Document_Chunks`
- **新建** `backend/src/services/chunking.service.ts`：
  - 优先语义分块：句子分割 → embedding 向量 → 相邻句子余弦相似度 → 低于阈值 0.5 切断 → 控制 min/max 块大小合并
  - 回退段落分块：embedding API 不可用时自动降级为按段落+句子边界切分
  - 每块 console 输出前 100 字预览 + 章节标题 + 策略类型
- **新建** `backend/src/services/embedding.service.ts`：
  - 使用 SiliconFlow API（`BAAI/bge-large-zh-v1.5`，1024 维），OpenAI 兼容格式
  - HuggingFace 尝试失败：直连返回 401（2025 年起强制登录），国内镜像 hf-mirror.com 同样 401
- **修改** `backend/src/controllers/document.controller.ts`：
  - 上传完成后异步调用 `chunkDocument()` 触发切块
  - 新增 `getChunks()` 调试 API：`GET /api/documents/:id/chunks` 返回所有 chunk 含前 100 字预览
- **修改** `backend/src/routes/document.routes.ts`：注册 `/:id/chunks` 路由（放在 `/:id` 之前避免参数冲突）
- **修改** `backend/src/services/extraction.service.ts`：新增 `getDocumentTextForChunking()` 公共函数
- **修改** `backend/src/models/index.ts`：注册 DocumentChunk 关联与导出
- **配置** `backend/.env`：新增 `SILICONFLOW_BASE_URL`、`SILICONFLOW_API_KEY`、`SILICONFLOW_EMBED_MODEL`

### 验证结果

- 上传语义分块测试文档（三个话题：闭包 → 事件循环 → 上下文管理器）
- 生成 5 个 chunk，全部标记为 `semantic` 策略，话题边界正确识别
- 章节标题（"第二章 闭包原理"等）正确检测并关联到对应 chunk
- 每个 chunk ≤ 250 字（62t / 77t / 90t / 26t / 128t）
- `curl /api/documents/:id/chunks` 返回完整切块数据

### RAG 计划

- 编写 `rag-implementation.md`：5 步详细实现计划（切块 → 向量化 → LanceDB 检索 → 改造聊天接口 → 可选优化）
- 参考 [llm-stacks.com](https://llm-stacks.com/docs/intro) RAG 学习指南，适配为 Node.js 技术栈
- 决定不上全栈框架（LangChain/LlamaIndex），原因：单一 LLM 提供商无需抽象层，纯函数链路更易维护

## 2026-05-28

### RAG 全链路实现

- **语义分块**（`chunking.service.ts`）：句子 → embedding → 相似度断点，最大 250 字/块，SiliconFlow BAAI/bge-large-zh-v1.5（1024维）
- **向量存储**（LanceDB）：嵌入式向量数据库，余弦距离检索，`backend/lancedb_data/`
- **检索服务**（`retrieval.service.ts`）：问题向量化 → LanceDB 搜索 Top-K → 补充文档标题
- **聊天改造**：`chat.controller.ts` 从单文档查全文改为 `retrieve()` 检索全部文档片段，`chat.service.ts` prompt 接收多 chunk
- **前端适配**：`ChatMessage.docs` 数组替代单 `docId`/`docTitle`，多来源按钮

### AI 助手流式输出

- **后端 SSE**（`chat.service.ts` `askDocumentStream()`）：`stream: true` → 异步生成器逐 token 推送
- **前端流式消费**（`ChatView.vue`）：`fetch` + `ReadableStream`，第一个 token 到达时创建消息气泡，逐字追加渲染
- 异常处理：连接失败/读取中断/无 token 均有可见错误提示
- 加载体验：提问后仅显示动画，AI 开始输出才出现消息气泡（不再预占"思考中"占位）

### 响应式导航栏统一

- `RecentDocs.vue`：汉堡菜单移到 logo 右侧，补齐"AI 助手"导航项，移动端覆盖层统一
- `ChatView.vue`：补全导航栏（文档库/AI助手/最近/集合/共享给我/每日训练），新增汉堡菜单和移动端覆盖层
- 三个页（DocumentLibrary / RecentDocs / ChatView）响应式断点统一为 `900px`

### 上线前优化

- **CORS 白名单**（`app.ts`）：`cors({ origin, credentials })`，不再允许任意域
- **前端 API 地址**（`client.ts`）：`VITE_API_BASE_URL` 环境变量，不再硬编码 localhost
- **日志隐私**：`chat.controller.ts`、`retrieval.service.ts`、`chunking.service.ts` 中去掉用户提问文本和 chunk 内容
- **`.env.example`**：配置模板，真实密钥不暴露
- **`.gitignore`**：补 `lancedb_data/`、`backend/uploads/`、`backend/dist/`

### 生产环境部署

- **服务器**：阿里云 ECS 2核2G Ubuntu 22.04，IP: `47.95.112.34`
- **架构**：Nginx（前端静态 + API 代理 + SSE 流式关闭缓冲）→ pm2（papier-api）→ Node.js + Express → MySQL + LanceDB
- **部署配置**：
  - `deploy/nginx.conf`：前端 `/root/frontend/dist/`、API 代理 `localhost:3000`、SSE `proxy_buffering off`、50M 上传限制
  - `deploy/ecosystem.config.js`：pm2 进程管理（500M 内存限制、自动重启、日志路径）
  - `deploy/setup.sh`：一键部署脚本
  - `deploy/DEPLOY.md`：详细部署计划书
- **验证通过**：登录、上传、文档浏览、AI 流式问答均正常

## 2026-06-01

### AI 模块全面优化

本次优化覆盖检索全链路，从 chunk 质量 → 检索精度 → 排序准确性 → 响应速度四层递进。

### 调试体系搭建

- **新建** `backend/src/utils/debug.ts`：统一调试工具，通过 `DEBUG_AI=true` 环境变量控制
  - `debugPhase` / `debugInfo` — 阶段标记与关键信息
  - `debugRetrieval` / `debugConfidence` / `debugLLM` / `debugTiming` — 检索结果、置信度、LLM 耗时、总耗时
  - `debugRoute` — 快速/深度路由判定日志
- **日志落盘**：`backend/logs/` 目录，保留最近 3 次运行（`ai-debug-{1,2,3}.log`），滚动覆盖
- **接入点**：`retrieval.service.ts`（向量维度、搜索耗时）、`chat.controller.ts`（全阶段日志，ask + askStream）

### 配置修复

- **`.env` Embedding 变量名修复**：`SILICONFLOW_*` → `EMBED_*`（代码实际读取的变量名），否则 embedding 调用无 API Key
- **MIMO Base URL 修正**：`xiaomimo.com` → `xiaomimimo.com`（少了一个 `mi`，导致 401）
- **智谱更换**：SiliconFlow BGE-large-zh-v1.5（余额不足 403）→ 智谱 embedding-2（1024 维，免费额度，已有 Key）

### P0 — 基础修复

- **Prompt 去标签化**（`chat.service.ts`）：
  - chunk 标注从 `[参考资料1：《标题》]` 改为 `【标题】`
  - 移除"不要提及参考资料"禁令，改为"像人一样自然回答"
  - maxTokens：1024 → 2048（MIMO pro 推理模型需要额外空间）
- **低分 chunk 过滤**（`chat.controller.ts`）：score < 0.1 的 chunk 不送 LLM，空结果直接返回"未找到"
- **精确检索**（`retrieval.service.ts`）：去掉 `.nprobes(20).refineFactor(5)`，100+ 文档用暴力搜索，修复 IVF_PQ 近似导致 score 全为 0.00x 的 bug
- **LanceDB 启动修复**（`app.ts`）：`ensureIndexes()` → 延迟 500ms → `compactTable()` 顺序执行，避免并发事务冲突导致进程退出

### P1 — 检索增强

- **文档切片三改进**（`chunking.service.ts`）：
  - NLP 句子边界：题号模式（`1.` / `(1)` / `一、` 等）作为强断点，不在句子中间切断
  - 题库适配：检测到 ≥3 个题号时，强制按题号边界分段，不拆散 Q&A
  - 重叠窗口 20%：chunk 尾部拼接至下个 chunk 头部，保留上下文边界
- **MMR 多样性去重**（`retrieval.service.ts`）：粗召 20 条 → MMR 精选 5 条，同文档惩罚 + 文本 Jaccard 重叠度计算
- **Query 泛化**（`rewrite.service.ts`）：axios 调用 MIMO v2.5 改写用户问题为检索关键词，拼接原问题做 embedding 检索
- **混合检索**（`retrieval.service.ts`）：
  - LanceDB FTS 全文索引（`ensureIndexes` 中创建）
  - 向量 20 条 + FTS 检索并行 → RRF 融合（Reciprocal Rank Fusion）
  - FTS 与向量同权（weight=1:1）

### P2 — 用户体验

- **Reranker 精排**（`rerank.service.ts`）：Qwen3-Reranker-0.6B（SiliconFlow），粗召 → RRF 融合 → Rerank 重打分 → MMR 精选
  - 效果：HashMap 查询 top-1 从 `面经4.9.pdf (score=0.164)` 变为 `test-doc.txt (score=0.993)`，区分度从 1.3× 提升至 497×
  - Reranker 配置独立（`RERANK_*` 环境变量），失败时退回粗排结果
- **快速/深度双路由**（`router.service.ts` + `chat.controller.ts`）：
  - 纯规则打分（不调 LLM）：简单词 -1 / 复杂词 +2 / 长度 / 问号数 / 术语密度
  - 快速通道（≥2 分）：检索结果直接拼接返回，不调 LLM，< 4s
  - 深度通道（< 2 分）：走完整 LLM 链路
  - ask 和 askStream 双接口均已集成
- **单文档展示**：AI 回答后只展示相似度最高的 1 篇文档来源
- **置信度阈值校准**：匹配智谱 embedding-2 的分数区间（≥0.3 high / ≥0.15 medium / <0.15 low）

### 检索链路验证

完整链路（深度通道）：
```
收到问题 → 路由判定(2分=深度) → Query改写 → 双路检索(FTS+向量) 
→ RRF融合 → Rerank精排 → MMR精选 → LLM生成 → 返回答案+top1文档
耗时: ~10s (检索~1s + LLM~9s)
```

日志示例：
```
[ai-debug] ── 路由: 深度通道 🧠 (得分=2, 复杂词:机制+术语密集) ──
[ai-debug]   双路检索耗时: 194ms
[ai-debug]   向量命中: 20 | FTS命中: 4
[ai-debug] ✓ [0.993] [test-doc.txt] Java HashMap 原理详解...
[ai-debug] ✓ 命中置信度: high (平均分 0.907)
```

### 文档

- 更新 `docs/ai-optimization.md`：P0-P3 完整优化清单
- 更新 `SETUP.md`：本地开发环境搭建指南
- 更新 `backend/.env.example`：Embedding 配置改为智谱变量名

## 2026-06-02

### AI 助手污染修复

- **问题**：AI 助手聊天框返回内容被题库文档的原始 Q&A 文本污染，输出类似 `【面经4.9.pdf】 完成，data/methods 可用...` 的乱码
- **根因**：AI判断问题复杂度，复杂度低于一定的区间走简单路线，简单路线不做思考，直接输出切片文档
- **修复**：取消简单路线和复杂路线之分
- **清理存量污染**：编写 `clean-questionbank-chunks.ts`，删除 paper.pdf（49）、4.20金山一面.pdf（7）、面经4.9.pdf（207）共 **263 个污染 chunks**（MySQL + LanceDB 双向清理）
- **文档类型检测增强**（`document-classifier.service.ts`）：新增题号密度快速判定，每 20 行中出现 1 个以上题号模式（`1.`、`（2）`、`一、`）直接判为题库文档，避免依赖 embedding API 的语义连贯性分析误判

### chat.service.ts 恢复与解耦

- **恢复原始提示词**：从 `D:\AI\AI-web` 备份恢复 `SYSTEM_PROMPT` 和 `TRAINING_SYSTEM_PROMPT` 原始内容
- **训练提示词移出**：`TRAINING_SYSTEM_PROMPT` 从 `chat.service.ts` 中移除，改为函数参数 `systemPrompt` 传入
  - `askDocumentForTraining(question, chunks)` → `askDocumentForTraining(question, chunks, systemPrompt)`
  - `startTrainingStream(question, chunks)` → `startTrainingStream(question, chunks, systemPrompt)`
- **各模块提示词独立**：
  - AI 助手 → `chat.service.ts` 的 `SYSTEM_PROMPT`
  - 训练出题 → `training.controller.ts` 的 `TRAINING_PROMPT`（含禁止引用规则 5-6）
  - 预生成 → `question-generation.service.ts` 的 `GENERATION_PROMPT`
  - 题目提取 → `question-extraction.service.ts` 的 `EXTRACTION_PROMPT`

### 项目清理

- **删除死文件**（7个）：`backend/app.js`、`backend/config/db.js`、`frontend/src/layouts/AdminLayout.vue`、根目录 `index.html`、`recent-preview.html`、`daily-training-preview.html`
- **清理 `backend/package.json`**：移除失效的 `ensure-indexes` 脚本（源文件不存在）
- **清理根 `package.json`**：移除 `marked`、`pdfjs-dist`（前端专属依赖）、`husky`、`lint-staged`（`.husky/` 目录不存在，从未生效）、`"prepare"` 脚本、`"lint-staged"` 配置块
- **导航栏清理**：删除 DocumentLibrary、ChatView、RecentDocs 三个页面的"集合"和"共享给我"导航项（桌面 + 移动端，共 12 处）

### 首页排序修复

- **问题**：首页"最近更新"文档列表不展示文档
- **修复**：
  - `document.controller.ts`：列表排序从 `updated_at DESC` 改为 `created_at DESC`，按上传先后顺序展示
  - `admin.controller.ts`：管理后台文档列表同步改为 `created_at DESC`
  - `validators/validate.ts`：Express 5 的 `req.query` 为只读属性，`(req as any).query = result.data` 改为 `(req as any).parsedQuery = result.data`
  - `document.controller.ts`：`list()` 函数改为读取 `parsedQuery` 备选 `req.query`

### 训练模块优化

- **出题数量保证**：
  - 非流式 `aiGenerateAdhoc`：要求 LLM 生成 `count × 1.5` 道题，打乱后截断到精确 `count`
  - 流式 `generateStream`：多要 50%，只输出前 `needCount` 道
  - 预生成 `preGenerateQuestions`：每块分配量 `× 1.4`，prompt 改为"生成至少 X 道"
- **数量输入框**：预设按钮（10/20/30）改为自定义数字输入框（1-50），隐藏上下箭头，宽度对齐难度按钮
- **`question-utils.ts`**：
  - `parseExtractionResponse` 重写：剥离代码块 → 直接解析 → 正则提取数组 → 逐对象正则提取，四层兜底
  - 新增 `stripQuestionNumber()` 去除题目前导序号（`31.`、`（2）`、`一、`）
- **`question-extraction.service.ts`**：提取题干时调用 `stripQuestionNumber()` 清洗序号
- **`question-generation.service.ts`**：预生成 prompt 新增禁止引用规则（题干/答案禁止"根据面经""参考资料显示"等表述）

### 前端架构改进

- **AppTopbar 组件提取**（`components/AppTopbar.vue`）：
  - 从 5 个页面（DocumentLibrary、ChatView、RecentDocs、DailyTraining、CollectedQuestions）提取重复的头部导航栏为独立组件
  - `activeRoute` prop 控制当前高亮导航项（home/chat/recent/training/collected）
  - `#controls` 插槽支持页面注入专属控件（搜索框、上传按钮、后台管理链接）
  - 内置头像下拉菜单、退出登录、移动端汉堡菜单 + 覆盖层导航
  - 所有 topbar/mobile-nav/avatar/logout 逻辑只维护一份
- **问答表格清理**：QuestionCard 组件移除 `knowledge_point` 分类标签

### "已收录"页面

- **后端 API**（`training.controller.ts` + `training.routes.ts`）：
  - `GET /api/training/questions` — 已收录题目列表（分页 + 知识点搜索 + 来源类型筛选 + 难度筛选）
  - `GET /api/training/questions/stats` — 统计（总收录数/文档提取数/AI 预生成数/覆盖知识点数）
- **前端页面**（`views/CollectedQuestions.vue`）：
  - 4 张统计卡片 + 筛选栏（知识点搜索 / 来源类型 / 难度星级）+ 题目卡片列表（展开查看答案/markdown 渲染）+ 动态窗口分页器
  - 路由 `/collected`，全站 5 个页面均添加"已收录"导航链接
- **静态预览**（`docs/收录页面预览.html`）：独立 HTML 设计稿，含 12 道模拟题目和完整交互

### 构建验证

- 前后端 TypeScript 编译均通过（`tsc --noEmit` + `vue-tsc --noEmit`）
- 后端 API 健康检查 `/health` 正常，MySQL 连接正常
- 训练 API `/api/training/generate` 正常返回题目
- Questions 表统计：总计 252 题（提取 48 + 预生成 204）

## 2026-06-03

### 生产环境部署

- **服务器**：阿里云 ECS 2核2G Ubuntu 22.04.5 LTS，公网 IP `47.95.112.34`
- **环境**：Node.js v18 → v20.20.2（`@tailwindcss/oxide` 要求 ≥20）、MySQL 8.0、Nginx 1.18、pm2 5.x
- **架构**：Nginx（前端静态 + `/api/*` 反向代理 + `/uploads/*` 静态文件）→ pm2（papier-api）→ Node.js + Express → MySQL + LanceDB
- **部署步骤**：打包上传 → 解压 → `npm install` → 后端 `tsc` 编译 → `npm run seed` 建表 → 前端 `vite build` → Nginx 配置 → pm2 启动
- **采坑记录**：
  - Windows tar/gzip 兼容问题 → 改用 `Compress-Archive` 生成 zip
  - zip 从 Windows 解压后 `node_modules/.bin/` 文件丢失可执行权限 → `chmod -R +x`
  - Node 18 不满足 `@tailwindcss/oxide` 的 engine 要求 → 升级到 Node 20
  - 前端构建 OOM（2G 内存跑 Vite + Tailwind 不够）→ `fallocate -l 2G /swapfile` 添加 swap
  - npm 从 GitHub 下载 `sharp` 二进制超时 → 设置 npmmirror 淘宝镜像
  - pm2 配置路径 `cwd: './backend'` 相对于执行目录 → 必须在 `/var/www/papier` 目录执行 `pm2 start`
- **Nginx 修复**：`client_max_body_size 10M`（默认 1M，超过无法上传）、SSE 流式 `proxy_buffering off`
- **验证通过**：登录、文档上传、AI 流式问答均正常

### 题目管道调试日志增强

- **目标**：题目提取/预生成过程可视化，每步骤耗时和结果一目了然
- **修改文件**：
  - `document.controller.ts` — `chunkDocument` 中题目管道入口：文档文本长度、token 估算、分类结果、提取/预生成题数、总耗时
  - `question-generation.service.ts` — `preGenerateQuestions`：文件路径、文本长度、切块数、每块 LLM 请求耗时、解析题数、累计写入数据库题数
  - `question-extraction.service.ts` — `extractQuestionsFromDocument`：同上结构，统一 `[提取]` 标签
  - `question-utils.ts` — `parseExtractionResponse`：JSON 解析成功时打印有效题数/总数，失败时打印文本首尾各 200 字
- **embedding 与题目管道解耦**：向量化/indexing 失败不再阻断下游题目生成（try-catch 包裹，失败日志继续执行）

### 预生成密度调整

- **原逻辑**：`targetCount = tokenCount / 100`（每 100 token 生成 1 题），再 `perChunk = Math.ceil((targetCount / chunks.length) * 1.4)`
- **第一次简化**：`perChunk = 3`（硬编码），目标题数改为 `tokenCount / 500`
- **第二次简化**：`perChunk = 5`，移除 `targetCount` 参数，入口只检查 `tokenCount >= 100`
- **效果**：每块固定生成 5 道论述题，避开了之前 112 题/文档的过度生成
- **同步修复**：`reprocess-docs.ts` 中相同调用点更新为新签名

### 后台题库管理页面

- **后端 API**（`admin.controller.ts` + `admin.routes.ts`）：
  - `GET /api/admin/questions` — 分页列表（page/pageSize/keyword/source_type），仅返回 `extracted` 和 `ai_pregenerated` 类型
  - `DELETE /api/admin/questions/:id` — 单题删除
  - `POST /api/admin/questions/batch-delete` — 批量删除（`{ ids: number[] }`）
- **前端页面**（`views/admin/QuestionBank.vue`）：
  - 4 张统计卡片（题库总数/题库提取/AI 预生成/知识点数），数据来自 `GET /api/training/questions/stats`
  - 搜索栏：关键词搜索 + 来源类型筛选（全部/题库提取/AI 预生成）
  - 数据表格：题干+答案预览、来源标签（绿/蓝）、知识点、时间、删除按钮
  - 多选功能：每行复选框 + 表头全选（支持半选态）+ 选中行高亮
  - 批量删除：选中后标题右侧出现红色"删除已选 (N)"按钮 → 确认弹窗 → 调用批量删除 API
  - 翻页清空选中，搜索清空选中
- **路由**：`/admin/questions`（`requiresAuth` + `requiresAdmin`）
- **导航**：AdminDashboard、DocManage、UserManage 三页均添加"题库管理"导航链接

### Embedding API 修复

- **问题**：智谱 embedding API（`embedding-2`，`open.bigmodel.cn`）返回 400，导致语义分块/分类器降级
- **修复**：更换 API Key 为新的有效密钥（`7b7e84...`），embedding 恢复正常
- **影响**：分类器语义判定恢复、向量检索恢复、语义分块恢复

## 2026-06-04

### 单元测试体系建设

- **从零搭建测试框架**：`backend/vitest.config.ts`，`npm test` / `npm run test:watch` 命令
- **新建** `backend/src/__tests__/unit/`（74 个用例）：
  - `chunking.service.test.ts`（23 用例）：`cosineSimilarity`、`findBreakpoints`、`estimateTokens`、`splitLongSentence`、`addOverlap`
  - `question-utils.test.ts`（22 用例）：`splitForExtraction`、`parseExtractionResponse`、`stripQuestionNumber`、`extractKnowledgePoint`
  - `chat.service.test.ts`（13 用例）：`IncrementalJsonParser` 流式 JSON 解析状态机
  - `retrieval.service.test.ts`（16 用例）：`rrfMerge`、`mmrSelect`、`jaccardOverlap`
- **抓到真实 bug**：`splitForExtraction(text, 0)` 死循环至数组溢出，添加 `maxLen <= 0 || !text` 守卫修复

### Winston 日志统一

- **背景**：项目有 3 个互不通信的日志系统——100+ `console.log`、Winston（仅 2 处使用）、`debug.ts`（手写文件轮转）
- **改造**：22 个文件中所有 `console.xxx` → `logger.xxx`
- **`utils/logger.ts`**：新增 `createModuleLogger(module)` 工厂函数、`DEBUG_AI=true` 时增加 `logs/ai-debug.log` 输出、dev 模式 `printf` 格式显示 `[module]` 标签、生产模式 JSON
- **`utils/debug.ts`**：删除手写 `fs.WriteStream` 管理（`initLogFile`/`writeLine`/`logStream`），8 个函数改用 `logger.debug`
- **效果**：每次上传文档可看到完整链路（切块 → 向量化 → 分类 → 题目生成），终端实时 + 文件持久化
- **Docker 日志挂载**：`docker-compose.yml` 新增 `./backend/logs:/app/logs` 绑定挂载

### 文档级联删除

- **新建** `backend/src/services/document-cleanup.service.ts`：统一 `deleteDocumentCascade()`，按序清理 LanceDB 向量 → MySQL 切块 → MySQL 题目 → 物理文件
- **修复两个 bug**：
  - `document.controller.ts` `remove()`：漏删 Questions
  - `admin.controller.ts` `deleteDocument()`：只删了物理文件，漏删向量 + 切块 + 题目

### Docker 构建修复

- 移除死依赖 `@xenova/transformers`（间接依赖 `sharp`，GitHub 下载二进制国内超时）
- 移除多余 `@types/bcryptjs`
- MySQL 认证插件 `caching_sha2_password` → `mysql_native_password`
- 修复 `check-db.js` 缺失（Dockerfile 新增 `COPY check-db.js ./`）
- `backend/.dockerignore` 新建（排除 `.env`、`src/__tests__/`、`logs/` 等）

### 日志生命周期

- Winston File transport 添加 `options: { flags: 'w' }`，项目启动时清空旧日志

### 切块参数调优

- `maxSize` 250 → 500 字/块
- `minSize` 80 → 150 字
- 每块出题 `perChunk` 5 → 3

## 2026-06-05

### localStorage Token → httpOnly Cookie

- **背景**：JWT 存在 `localStorage`，XSS 攻击可直接窃取
- **后端**（5 文件）：
  - `package.json`：新增 `cookie-parser` + `@types/cookie-parser`
  - `app.ts`：`app.use(cookieParser())`
  - `middlewares/auth.ts`：`authenticate()` 优先从 `req.cookies?.token` 读，fallback 到 Authorization header（向后兼容）
  - `controllers/auth.controller.ts`：`login()`/`register()` 不再返回 token，改 `res.cookie('token', token, { httpOnly, secure: isProduction, sameSite: 'lax', maxAge: 7d })`，body 只返 `{ user }`；新增 `me()` 和 `logout()`
  - `routes/auth.routes.ts`：新增 `GET /api/auth/me` 和 `POST /api/auth/logout`
- **前端**（5 文件）：
  - `api/client.ts`：`axios.create({ withCredentials: true })`，删除整个 request 拦截器（不再设 Authorization header），删除 401 中的 `localStorage.removeItem`
  - `api/chat.ts`：`fetch()` 加 `credentials: 'include'`，删除手动 Authorization header（2 处）
  - `stores/auth.ts`：`initFromStorage()` → `async initAuth()` 调 `/api/auth/me`；`login()`/`logout()` 不再操作 localStorage
  - `main.ts`：`authStore.initFromStorage()` → `await authStore.initAuth()`
  - `views/auth/Register.vue`：删除 2 行 `localStorage.setItem`
- **共删除 13 处 localStorage token 操作**

### 集成测试体系

- 安装 `supertest` + `@types/supertest`
- **新建** `backend/src/__tests__/helpers/test-setup.ts`：`initTestDb()` 统一初始化 `papier_test` 数据库（`sync({ force: true })` + 种子数据），防并行竞态的 Promise 锁
- **新建** `backend/src/__tests__/integration/`（16 个用例）：
  - `auth.test.ts`（9 用例）：注册/登录/me/登出
  - `documents.test.ts`（7 用例）：列表/上传/详情/删除 + 权限校验
- **`app.ts` 改造**：`NODE_ENV=test` 时跳过 `app.listen()` 和 LanceDB 初始化
- **`vitest.config.ts`**：`fileParallelism: false`（防 DB 并行冲突）、`env` 覆盖、`setupFiles`

### Swagger API 文档

- 安装 `swagger-jsdoc` + `swagger-ui-express`
- **新建** `backend/src/config/swagger.ts`：完整 OpenAPI 3.0 定义，39 个端点按 8 组展示
- `app.ts` 挂载 `/api-docs` 路由

### 登录校验全覆盖

- **后端**：`chat.routes.ts` 4 端点 + `training.routes.ts` 4 端点注入 `authenticate` 中间件
- **前端**：ChatView / DailyTraining / CollectedQuestions 三个路由加 `meta: { requiresAuth: true }`
- AppTopbar 未登录时显示"登录"按钮（`v-else`）

### Text2SQL

- **新建** `backend/src/services/intent-classifier.service.ts`：关键词白名单（`统计`、`多少`、`排名` 等 24 个），命中 ≥2 个判定为 `data_query`
- **新建** `backend/src/services/text2sql.service.ts`：LLM 生成 SQL（`temperature: 0`）→ 校验（只允许 SELECT、禁止多语句）→ `sequelize.query()` 执行 → 结果格式化
- 安全：表名白名单（9 张表）、自动追加 `LIMIT 100`、INSERT/UPDATE/DELETE/DROP 检测拦截
- `chat.controller.ts`：`ask()` 和 `askStream()` 在路由判定后加入意图分支，`data_query` 走 SQL 路径早返回

## 2026-06-08

### 已收录页面掌握筛选

- **后端** `training.controller.ts`：
  - `listQuestions` 新增 `practice_status` 筛选（`mastered` → 查已掌握的；`review` → 查需复习的），每用户独立，通过 PracticeRecord 过滤
  - 每题返回 `userStatus` 字段（`'mastered'` / `'review'` / `null`）
  - `record()` 改用 `findOne` → `create/update`（根治 `upsert` 重复记录导致同题同时出现在掌握和复习）
  - 添加 `res.set('Cache-Control', 'no-store')` 避免浏览器缓存导致筛选不刷新
- **前端** `CollectedQuestions.vue`：
  - 新增筛选组（全部/已掌握/需复习）
  - 每道题卡片添加"已掌握""需复习"按钮，`handleMarkStatus` 调用 `recordPractice`
  - 按钮状态由 `userStatus` 驱动高亮
- **数据库清理**：删除 PracticeRecords 重复数据，添加唯一索引 `(user_id, question_id)`
- **AI 训练排除已掌握**：`generate()` 和 `generateStream()` 生成前查询 PracticeRecord 排除已掌握的题

### LanceDB 存储文档标题

- **问题**：检索日志中大量 `[未知文档]`，LanceDB 不存标题，回查 MySQL 找不到（孤立 chunk）
- **修复**：
  - `indexChunks` 新增 `documentTitle` 参数，写入 LanceDB
  - `document.controller.ts` 调用时传入 `doc.title`
  - `reindex-all.ts` 和 `rebuild-all.ts` 同步更新
  - `retrieve()` 优先读 `r.documentTitle`，无则回退 MySQL

### 题目提取质量优化

- `question-extraction.service.ts`：
  - 提示词重写：加 few-shot 示例、明确"必须有问号或提问词"、排除章节标题
  - 切块大小 4000 → 2000 字
  - 答案 < 100 字过滤丢弃

### 难度投票算法

- 中位数 → **众数**（出现最多的值，平局取最大值）
- 锁定阈值 20 → **10 次**
- 满 10 次清空 votes，拒绝新投票

### 前端体验修复

- **收起动画**：max-height CSS hack 改为 JS 实际高度 + 双帧重排，消除收起时的"先跳后收"问题（QuestionCard + CollectedQuestions）
- **padding-top 固定**：移除 `.expanded` 状态控制的 `padding-top`，消除收起时的 14px 跳动
- **星星常态可见**：未评分星颜色 `#e5e0d8` → `#d1ccc0`，在白色卡面上清晰可见

### 路由守卫时序修复

- **bug**：`app.use(router)` 触发初始导航 → `beforeEach` 先于 `initAuth()` 执行 → `isAuthenticated=false` → 刷新页面跳转登录
- **修复**：`main.ts` 中 `app.use(router)` + `app.mount('#app')` 移入 `initAuth().then()` 回调内

### 文档与部署

- **CONTEXT.md** 完全重写：从 AI 开发规格转为 GitHub 项目介绍（功能亮点、架构图、技术栈、快速开始）
- **CLAUDE.md** 更新：补齐 AI 依赖、数据库、测试命令
- **SETUP.md** 修正：默认账号引用统一为 `13691620597 / qweasdzxc05811`
- **seed.ts** 账号更新：`admin / admin123` → `13691620597 / qweasdzxc05811`
- **全新部署验证**：`docker compose down -v` 清空所有数据卷 → `docker compose up -d --build` 重建成功，seed 自动执行

### 已提交

- Git commit `b300668`：28 文件，715 行新增，258 行删除
- 分支：`dev/web`

## 2026-06-09

### 生产环境重新部署

- **服务器**：阿里云 ECS 2核2G Ubuntu 22.04，IP `47.95.112.34`
- **全新清空重来**：`pm2 delete all` → `rm -rf /var/www/papier` → 重新打包上传

### 部署采坑记录

- **httpOnly Cookie `secure` 开关**：原逻辑 `secure: isProduction`（`NODE_ENV=production` 即强制 secure），但服务器跑 HTTP 没配 HTTPS，浏览器拒绝发送 secure cookie → `/api/auth/me` 返回 401 → 刷新页面跳转登录。修复：改为 `isHttps(req)` 按实际请求协议判断（检查 `req.secure` 和 `X-Forwarded-Proto` 头）。同时 `clearCookie` 同步修复
- **解压未覆盖源文件**：unzip 行为不确定导致旧代码残留，最终清空目录从头来
- **MySQL 权限**：`.env` 默认 `DB_USER=phj`，服务器 MySQL 无此用户 → seed 失败。改用 `sudo mysql` 创建 `papier@localhost` 用户授权
- **前端构建 OOM**：2G 内存 Vite 卡死，改用**本地 Windows 构建前端 dist** → `scp -r` 上传到服务器，避免服务器端编译
- **上传 500**：`uploads/` 目录未创建 → `mkdir -p`
- **AI 输出空白**：`.env` 中 MIMO 配置错误 — `MIMO_BASE_URL=platform.deepseek.com`（应为 `api.deepseek.com/v1`），`MIMO_MODEL=deepseek-deepseek-v4-pro`（模型名不存在）。后切换至**阿里云百炼**平台（`dashscope.aliyuncs.com/compatible-mode/v1`），模型用 `deepseek-v3.2`
- **reindex 循环引用崩溃**：Winston `printf` 中 `JSON.stringify(rest)` 遇到 `ClientRequest` 循环引用对象报错。源文件 logger.ts 修复为 try-catch 包裹
- **Embedding 变量名不匹配**：`.env` 只有旧变量名 `SILICONFLOW_*`，代码实际读 `EMBED_*` → 401。补上 `EMBED_BASE_URL`、`EMBED_API_KEY`、`EMBED_MODEL` 配置
- **LanceDB 无数据**：新部署未建索引 → `npx ts-node src/reindex-all.ts`（259 chunk）

### 最终架构

```
浏览器 → Nginx (:80)
           ├─ /          → /var/www/papier/frontend/dist/
           ├─ /api/*     → proxy_pass 127.0.0.1:3000
           ├─ /api/chat/ask/stream     → proxy_buffering off (SSE)
           ├─ /api/chat/train/stream   → proxy_buffering off (SSE)
           ├─ /api/training/generate/stream → proxy_buffering off (SSE)
           └─ /uploads/* → alias /var/www/papier/backend/uploads/
           
pm2 → papier-api (Node.js :3000)
  ├─ MySQL (papier@localhost)
  ├─ LanceDB (lancedb_data/)
  └─ AI: 阿里云百炼 deepseek-v3.2 + 智谱 embedding-2
```

### 当前运行状态

- 登录/注册正常（httpOnly Cookie 区分 HTTP/HTTPS）
- 文档上传正常（uploads 目录已创建）
- AI 助手：待 reindex 完成 + embedding 连通后可用
- 上传包大小 657K（tar.gz，排除 node_modules）

### 部署命令速查

```bash
# 打包
tar --exclude='node_modules' --exclude='dist' --exclude='.git' \
    --exclude='lancedb_data' --exclude='uploads' --exclude='logs' \
    -czf papier-deploy.tar.gz backend frontend deploy

# 上传
scp papier-deploy.tar.gz root@47.95.112.34:/var/www/

# 服务器部署
cd /var/www && tar -xzf papier-deploy.tar.gz
mkdir -p /var/www/papier && mv backend frontend deploy /var/www/papier/
cd /var/www/papier/backend
cp .env.example .env    # 编辑填入真实配置
npm install && npm run build && npm run seed
# 前端本地构建后 scp -r dist 上传到 /var/www/papier/frontend/dist
cp /var/www/papier/deploy/nginx.conf /etc/nginx/sites-available/papier
nginx -t && systemctl reload nginx
cd /var/www/papier && pm2 start deploy/ecosystem.config.js && pm2 save
```

## 2026-06-10

### AI 助手多轮对话记忆

- **前端**（`ChatView.vue` + `api/chat.ts`）：发请求时从 `messages` 数组提取完整 Q&A 历史，放入 body 的 `history` 字段
- **后端**（`chat.controller.ts` + `chat.service.ts`）：`buildMessages()` 新增 `history` 参数，拼成多轮 messages 发给 LLM
- **根因修复**：Zod `askSchema` 只有 `question` 和 `documentId`，`validate()` 中间件用 `safeParse` 替换 `req.body`，`history` 和 `thinking` 被静默丢弃。加字段到 schema 修复
- **Docker 前端缓存问题**：`docker compose build --no-cache` 需搭配 `docker builder prune -f` 才能真正清除缓存。`docker compose down && docker compose up -d --build` 不够

### 对话历史相关性筛选

- **`filterHistory()`**（`chat.service.ts`）：发送精简 prompt 给 LLM，判断哪些历史 Q&A 与当前问题相关。只传问题文本（不传答案），LLM 返回序号如"1,3"
- **筛选 prompt**：详细指令教 LLM 判断相关性、识别元问题。筛选失败兜底返回全部历史
- **日志透视**：`[chat] 历史筛选: 3组 → 结果: 1,2` `[chat] 保留 2/3 组: 1,2`
- **效果验证**：问"事件循环"时 3 组历史保留 2 组（筛掉不相关的），问"react和vue使用场景"时保留 1,2 组（筛掉事件循环）

### AI 智能路由：一次 LLM 调用判断三条路

- **`routeWithLLM()`**（`chat.service.ts`）：替代 `classifyIntent`（关键词匹配）+ `thinkWithHistory`（独立思考）两步为一次 LLM 调用
- **三路分发**：`SQL`（数据统计）→ Text2SQL 执行 → 返回 / `DOCS`（需查文档）→ RAG / 直接回答（元问题/对话本身）
- **执行顺序**：Text2SQL → 思考 → RAG，SQL 优先避免被思考误判
- **流式 SSE 统一**：SQL 和 direct 路径也走 SSE 格式（`res.json` 切换到 `res.write` + SSE headers），前端 `askStream` 不再收到 JSON 解析失败

### 题目提取 Prompt v3：质量标准

**问题**：旧 prompt "题干原样保留" → 提取结果含大量不合格的题——口语注释（"(这我上哪知道了)"、"(疯了吧问这个)"）、代指不明（"为什么会这样呢"、"怎么优化这些指标"）、无对象/无问号（"技术发展趋势看法"、"应用场景"）

**新版规则**：
1. 总原则：每道题自问"单独拿出来，没看过原文的人能看懂吗？"，看不懂直接丢弃
2. 所指对象清晰：不能有依赖上下文的指代词（"这个""这种""这样""它""你项目"等）
3. 疑问要求明确：必须以问号（？）结尾，提问意图清楚
4. 题干必须完整：不能截断，不能有未闭合括号
5. 两个不合格例子（❌）+ 一个合格例子（✅），LLM 对照学习

**效果**（同文档前后对比）：
- 带括号口语注释：12 道 → **0**
- 无对象/无问号：8 道 → **0**
- 题干截断：2 道 → **0**
- 总题数：114 → 101（少 13 道，全是该丢的）

### Text2SQL 密码安全修复

- **问题**：问"数据库里有哪些用户"时返回了 password 哈希值
- **修复**：
  - SQL prompt 新增"禁止查询 Users 表的 password 字段"
  - 运行时兜底：查询结果中如有 `password` 字段，force 删除后返回

### 其他优化

- **SYSTEM_PROMPT 放宽**：回答从"3-5 句话"改为"3-8 句话，详细完整"
- **模型默认值统一**：6 个文件中 `deepseek-chat` → `deepseek-v3.2`
- **路由守卫时序修复**：`main.ts` 中 `app.use(router)` + `app.mount('#app')` 移入 `initAuth().then()` 回调，修复刷新页面跳转登录
- **`.env` 加 `MIMO_TRAIN_MODEL`**：Docker 容器中提取/预生成全部失败，根因是训练模型未设置环境变量

### 已提交

- `f29bad4` feat: AI 智能路由 + 对话历史筛选 + 多轮对话记忆 (3 文件, 117+ 15-)
- `ac2be1b` feat: AI 助手多轮对话记忆 + 历史相关性筛选 (9 文件, 130+ 30-)

## 2026-06-11

### PDF 移动端兼容

**问题**：pdfjs-dist 6.x 在移动端（iOS Safari、Android WebView）无法渲染 PDF，根因是 6.x 依赖 ESM Worker（`.mjs`）、`Array.prototype.at()`、`Map.prototype.getOrInsertComputed` 等现代 API，老移动浏览器不支持。

**尝试过的方案**（均失败）：
- `@okkkde/pdfjs-dist`（社区 fork）— 不行
- Vite `build.target: es2020` — Worker 不受 Vite 控制，不生效
- `@vitejs/plugin-legacy` — 与 Vite 5 版本不兼容，babel 报错
- `core-js/actual` 全量 polyfill — 干扰 pdfjs-dist，getDocument 报错
- 手动 `Array.at()` polyfill — 只解决一个 API，还有其他兼容问题
- `<iframe>` 移动端降级 — 体验差，用户不接受

**最终方案**：降级到 `pdfjs-dist@3.11.174`
- 3.x 使用传统 Worker 脚本（`.js`），不使用 ESM Worker
- API 完全兼容（`getDocument`、`page.render`、`GlobalWorkerOptions.workerSrc` 完全一样）
- 删除 `getOrInsertComputed` polyfill（3.x 不需要）
- DocumentReader bundle 从 479KB → 339KB（-29%）

**改动文件**：
- `frontend/package.json`：`pdfjs-dist` 6.0.227 → 3.11.174
- `frontend/vite.config.ts`：Worker 路径 `pdf.worker.mjs` → `pdf.worker.js`
- `frontend/src/components/DocumentReader.vue`：Worker 路径 + 删 polyfill

### PDF 页码标注移除

- 项目在每页 Canvas 下方渲染了页码（`<span class="pdf-page-num">`），PDF 原文自带页码 → 双份数字
- 删除 `num.className = 'pdf-page-num'` 创建代码和 CSS 样式块

### 上传限制扩大

- **单文件** 10MB → **50MB**（multer `fileSize`）
- **总请求体** 10M → **200M**（nginx `client_max_body_size`，多文件叠加场景）
- Express 5 的 `express.json()` 和 `express.urlencoded()` 设 `limit: '50mb'`
- **multipart 请求绕过 body parser**：Express 5 的 json/urlencoded parser 可能误截 multipart 大请求 → 加 `content-type` 检测跳过
- 前端 `UploadDialog.vue` 校验同步更新（50MB / 200M / 10 文件）
- 前端 nginx 重建需单独执行：`docker compose build --no-cache frontend && docker compose up -d frontend`（后端重建时前端可能被缓存跳过）

### 题目提取 Prompt v3.1

加"独立可理解 + 无模糊指代"规则：
- 指代词规则从名单改为通用——"替换指代词后题干不通顺的不合格"
- 题干必须以问号结尾、不能截断
- 加"题干独立可读"自检句

### 预生成密度

- `perChunk` 3 → **2**（每块生成 2 道题）

### 已提交

- `c52c80c` fix: pdfjs-dist 降级 3.x + 移除页码标注 + 提取 prompt 优化 (5 文件, 655+ 291-)
- 分支：`dev/Android`

### 服务器部署：nginx + 上传 + embedding + AI 模型

- **nginx root 路径修复**：部署 nginx.conf 后 `root` 指向 `/var/www/papier/dist`，实际路径为 `/var/www/papier/frontend/dist/` → SPA 回退循环导致 500
- **上传 413 排查**：前端 Docker 重建未生效（容器时间戳 03:06 未更新）→ 单独 `docker compose build --no-cache frontend && docker compose up -d frontend`
- **Embedding 限流修复**：智谱免费版 1 QPS 限流，`embedTexts()` 无重试 → 加 429 自动重试（5 次，间隔递增 2s/4s/6s/8s）
- **预生成/提取全部失败**：错误消息为空（LangChain Error 不可枚举）→ 改为 `constructor.name + message + response.status + Object.keys(err)` 格式日志 → 最终发现 `deepseek-v3.2` 免费额度耗尽 403
- **模型切换**：7 个文件 `deepseek-v3.2` → `deepseek-v4-flash`（`.env` + 6 个服务文件：chat、rewrite、text2sql、extraction、generation、embedding）
- **`MIMO_TRAIN_MODEL` 配置**：服务器 `.env` 首次漏配，预生成 33 块全部瞬失败 0 题 → 补上 `MIMO_TRAIN_MODEL=deepseek-v4-flash`

### 已提交

- `1c77e22` docs: 开发日志更新至 2026-06-11
