#!/bin/bash
# Papier 一键部署脚本（在服务器上执行）
set -e

echo "=== Papier 部署脚本 ==="

# 1. 安装系统依赖
echo "[1/6] 安装系统依赖..."
sudo apt update
sudo apt install -y nodejs npm nginx mysql-server
sudo npm install -g cnpm pm2

# 2. 创建目录结构
echo "[2/6] 创建目录..."
sudo mkdir -p /var/www/papier
sudo chown -R $USER:$USER /var/www/papier

# 3. 部署后端
echo "[3/6] 部署后端..."
cp -r backend /var/www/papier/
cd /var/www/papier/backend
cnpm install --production
npm run build
mkdir -p logs

# 提示用户配置 .env
echo ""
echo "⚠️  请编辑 /var/www/papier/backend/.env 填入真实配置："
echo "   DB_PASSWORD=你的数据库密码"
echo "   JWT_SECRET=随机字符串"
echo "   MIMO_API_KEY=你的MIMO密钥"
echo "   SILICONFLOW_API_KEY=你的SiliconFlow密钥"
echo "   CORS_ORIGIN=https://你的域名"
echo ""
read -p "按回车继续..."

# 4. 初始化数据库 + 向量索引
echo "[4/6] 初始化数据库..."
npm run seed
npx ts-node src/rebuild-all.ts

# 5. 部署前端
echo "[5/6] 部署前端..."
cd /var/www/papier
cp -r frontend dist-temp
cd dist-temp
cnpm install
# 设置生产环境 API 地址（如果前后端同域则不需要）
npm run build
cp -r dist /var/www/papier/dist
cd /var/www/papier
rm -rf dist-temp

# 6. 配置 Nginx + 启动
echo "[6/6] 配置 Nginx + 启动服务..."
sudo cp deploy/nginx.conf /etc/nginx/sites-available/papier
sudo ln -sf /etc/nginx/sites-available/papier /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

cd /var/www/papier
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup

echo ""
echo "=== 部署完成 ==="
echo "检查状态：pm2 status"
echo "查看日志：pm2 logs papier-api"
echo "Nginx 日志：sudo tail -f /var/log/nginx/access.log"
