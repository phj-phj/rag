# Papier — 文档分享平台

一个基于 Vue 3 + Node.js + MySQL 的团队文档管理与分享平台，提供文档上传、分类管理、标签筛选、搜索、收藏等功能。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite + Vue Router + Pinia |
| 后端 | Node.js + Express |
| 数据库 | MySQL |
| UI | 自定义 CSS（基于 index.html 设计稿） |

## 功能模块

- **顶部导航栏**：Logo、导航菜单（文档库/集合/最近/共享给我）、搜索框、上传文档按钮、用户头像
- **侧边栏**：浏览区（全部文档/收藏/最近浏览）、分类区（技术文档/产品需求/会议纪要/设计规范/周报月报）、标签区
- **统计卡片**：总文档数、活跃分享、团队成员、存储用量
- **精选文档**：置顶推荐文档展示
- **文档卡片列表**：文档类型标识、标题、摘要、作者、更新时间
- **交互功能**：搜索筛选、文档上传、收藏管理、响应式布局

## 分步实施计划

- [x] 第一步：项目初始化
- [ ] 第二步：数据库设计
- [ ] 第三步：后端 API
- [ ] 第四步：前端页面
- [ ] 第五步：交互与功能

---

## 第一步：项目初始化

### 1. 前端项目搭建（Vite + Vue 3）

```bash
cd AI-web
npm create vite@latest frontend -- --template vue
cd frontend
npm install
npm install vue-router pinia axios
```

项目结构：

```
frontend/
├── src/
│   ├── assets/          # 静态资源
│   ├── components/      # 公共组件
│   ├── views/           # 页面组件
│   ├── router/          # 路由配置
│   ├── stores/          # Pinia 状态管理
│   ├── utils/           # 工具函数（axios 封装等）
│   ├── App.vue
│   └── main.js
├── index.html
├── vite.config.js
└── package.json
```

关键配置：

- `vite.config.js`：配置代理，将 `/api` 请求转发到后端
- `src/router/index.js`：配置页面路由（文档库、集合、最近、共享给我）
- `src/utils/request.js`：封装 axios 实例，统一处理请求/响应拦截

### 2. 后端项目搭建（Node.js + Express）

```bash
mkdir backend
cd backend
npm init -y
npm install express mysql2 cors dotenv nodemon
```

项目结构：

```
backend/
├── config/              # 配置文件（数据库连接等）
│   └── db.js
├── routes/              # 路由
├── controllers/         # 控制器
├── models/              # 数据模型
├── middleware/           # 中间件
├── app.js               # Express 应用入口
├── .env                 # 环境变量
└── package.json
```

关键配置：

- `config/db.js`：MySQL 连接池配置
- `app.js`：Express 应用注册路由、中间件、跨域配置
- `.env`：数据库连接信息（HOST、PORT、USER、PASSWORD、DATABASE）
- `package.json`：添加 `"dev": "nodemon app.js"` 启动脚本

### 3. MySQL 数据库连接

```bash
# 安装 MySQL（如尚未安装）
# 创建数据库
mysql -u root -p
```

```sql
CREATE DATABASE papier DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

`.env` 文件配置：

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=papier
```

`config/db.js` 示例：

```js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
```

### 4. 启动验证

```bash
# 启动后端
cd backend
npm run dev

# 启动前端
cd frontend
npm run dev
```

访问 `http://localhost:5173` 确认前端页面正常加载，后端无报错即为初始化完成。
