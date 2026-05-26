# Papier 部署上线计划书

## 一、服务器准备

### 最低配置

| 项目 | 要求 |
|------|------|
| CPU | 2 核 |
| 内存 | 2 GB（LanceDB 向量检索需常驻内存） |
| 硬盘 | 40 GB（含上传文件存储） |
| 系统 | Ubuntu 22.04 LTS |
| 带宽 | 按需（用户上传下载文件） |

推荐：阿里云/腾讯云轻量应用服务器，选择"应用镜像 → Node.js"可省去装 Node 的步骤。

---

## 二、部署架构

```
浏览器
   │
   ▼
┌─────────────────┐
│  Nginx (:80)    │
│  /            → 前端静态文件 /var/www/papier/dist/
│  /api/*       → 反向代理 localhost:3000
│  /uploads/*   → 静态文件 /var/www/papier/backend/uploads/
└──────┬─────────┘
       │
       ▼
┌─────────────────┐
│  pm2            │
│  papier-api     │
│  (Node.js :3000)│
└──────┬─────────┘
       │
       ▼
┌─────────────────┐
│  MySQL (:3306)  │
└─────────────────┘
```

---

## 三、部署步骤

### 3.1 服务器环境

```bash
# 安装 Node.js 18+、MySQL、Nginx
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs nginx mysql-server

# 安装全局工具
sudo npm install -g cnpm pm2
```

### 3.2 上传代码

```bash
# 在本地打包（排除 node_modules）
cd AI-web
tar --exclude='node_modules' --exclude='.git' --exclude='lancedb_data' \
    -czf papier.tar.gz backend/ frontend/ deploy/

# 上传到服务器
scp papier.tar.gz root@你的服务器IP:/var/www/
ssh root@你的服务器IP
cd /var/www && tar -xzf papier.tar.gz && mv AI-web papier
```

### 3.3 配置环境变量

编辑 `/var/www/papier/backend/.env`：

```env
PORT=3000
CORS_ORIGIN=https://你的域名.com

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=papier

JWT_SECRET=随机生成一个长字符串
JWT_EXPIRES_IN=7d

MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
MIMO_API_KEY=你的MIMO密钥
MIMO_MODEL=mimo-v2.5-pro

SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_API_KEY=你的SiliconFlow密钥
SILICONFLOW_EMBED_MODEL=BAAI/bge-large-zh-v1.5
```

### 3.4 构建

```bash
# 后端
cd /var/www/papier/backend
cnpm install --production
npm run build          # tsc 编译到 dist/

# 数据库初始化
npm run seed           # 建表 + 种子数据

# 前端
cd /var/www/papier/frontend
cnpm install
npm run build          # 产出 dist/
```

### 3.5 启动服务

```bash
# 用 pm2 启动后端
cd /var/www/papier
pm2 start deploy/ecosystem.config.js
pm2 save              # 保存进程列表
pm2 startup           # 开机自启

# 配置 Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/papier
sudo ln -sf /etc/nginx/sites-available/papier /etc/nginx/sites-enabled/
# 编辑 nginx.conf，把 your-domain.com 替换为真实域名
sudo nginx -t && sudo systemctl reload nginx
```

### 3.6 向量索引重建

```bash
cd /var/www/papier/backend
npx ts-node src/rebuild-all.ts
# 这会读取所有文档 → 切块 → embedding → 写入 LanceDB
```

---

## 四、配置文件清单

| 文件 | 用途 |
|------|------|
| `deploy/nginx.conf` | Nginx 配置（前端静态文件 + API 代理 + SSE 流式支持） |
| `deploy/ecosystem.config.js` | pm2 进程管理（自动重启、日志、内存限制） |
| `deploy/setup.sh` | 一键部署脚本 |
| `backend/.env.example` | 环境变量模板 |

---

## 五、关键注意事项

### SSE 流式输出

Nginx 默认会缓冲 `proxy_pass` 的响应，导致流式输出失效。`nginx.conf` 中已对 `/api/chat/ask/stream` 单独关闭缓冲：

```nginx
proxy_buffering off;
proxy_cache off;
```

### LanceDB 数据

LanceDB 数据目录 `backend/lancedb_data/` 不上传（在 `.gitignore` 中）。部署后必须执行 `rebuild-all.ts` 重建。

### 前端 API 地址

- **同域部署**（前后端同域名）：前端 `baseURL` 默认 `/api`，无需额外配置
- **不同域**：前端构建时设置 `VITE_API_BASE_URL=https://api.你的域名.com`

### HTTPS

建议用 Let's Encrypt 免费证书：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 六、上线后检查清单

- [ ] `curl https://域名.com/api/documents` 返回 JSON
- [ ] 浏览器访问页面正常，能登录
- [ ] 上传一个文档 → 检查是否能切块
- [ ] AI 助手提问 → 流式输出正常，来源文档标注正确
- [ ] 移动端汉堡菜单正常
- [ ] pm2 status 显示 online
- [ ] SSL 证书生效（HTTPS 绿锁）
