# ── 阶段一：Vite 构建 ──
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && \
    npm install
COPY . .
RUN npm run build

# ── 阶段二：Nginx 服务 ──
FROM nginx:alpine

# 复制构建产物
COPY --from=build /app/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY nginx-docker.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
