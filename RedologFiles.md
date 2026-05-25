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
