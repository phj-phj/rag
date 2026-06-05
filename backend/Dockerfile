FROM node:20-slim

# 安装 netcat（用于 TCP 端口检测）
RUN apt-get update && apt-get install -y netcat-openbsd && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安装依赖
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com
RUN npm install

# 复制源码并编译
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

# 创建必要目录
RUN mkdir -p uploads logs

EXPOSE 3000

# 等待 MySQL 就绪 → 首次初始化数据库 → 启动
CMD sh -c "\
  echo '等待 MySQL 就绪...' && \
  while ! nc -z mysql 3306; do sleep 2; done && \
  echo 'MySQL 就绪' && \
  if node check-db.js; then npm run seed; fi && \
  node dist/app.js"
