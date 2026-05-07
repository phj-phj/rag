<template>
  <div class="document-library">
    <!-- TOP BAR -->
    <header class="topbar">
      <div class="logo">
        Pap<em>ier</em>
      </div>
      <ul class="top-nav">
        <li>
          <router-link
            to="/"
            class="active"
          >
            文档库
          </router-link>
        </li>
        <li><a href="#">集合</a></li>
        <li><a href="#">最近</a></li>
        <li><a href="#">共享给我</a></li>
        <li><a href="#">每日训练</a></li>
      </ul>
      <div class="topbar-right">
        <div class="search-box">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <circle
              cx="11"
              cy="11"
              r="8"
            />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="搜索文档..."
          >
        </div>
        <router-link
          to="/admin"
          class="btn-admin"
        >
          后台页面
        </router-link>
        <button class="btn-upload">
          + 上传文档
        </button>
        <div class="avatar">
          P
        </div>
      </div>
    </header>

    <!-- SIDEBAR -->
    <nav class="sidebar">
      <div class="sidebar-section">
        <div class="sidebar-title">
          浏览
        </div>
        <ul class="sidebar-list">
          <li>
            <a
              href="#"
              class="active"
            >
              <svg
                class="sidebar-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              全部文档
              <span class="sidebar-count">128</span>
            </a>
          </li>
          <li>
            <a href="#">
              <svg
                class="sidebar-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              收藏
              <span class="sidebar-count">12</span>
            </a>
          </li>
          <li>
            <a href="#">
              <svg
                class="sidebar-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              最近浏览
              <span class="sidebar-count">24</span>
            </a>
          </li>
        </ul>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-title">
          分类
        </div>
        <ul class="sidebar-list">
          <li
            v-for="cat in categories"
            :key="cat.name"
          >
            <a href="#">
              <span
                class="sidebar-tag"
                :style="{ background: cat.color }"
              />
              {{ cat.name }}
              <span class="sidebar-count">{{ cat.count }}</span>
            </a>
          </li>
        </ul>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-title">
          标签
        </div>
        <ul class="sidebar-list">
          <li
            v-for="tag in tags"
            :key="tag"
          >
            <a href="#"># {{ tag }}</a>
          </li>
        </ul>
      </div>
    </nav>

    <!-- MAIN CONTENT -->
    <main class="main">
      <div class="page-header">
        <h1>文档库</h1>
        <p>浏览和管理你所有的共享文档</p>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="stat-card"
        >
          <div class="stat-label">
            {{ stat.label }}
          </div>
          <div
            class="stat-value"
            v-html="stat.value"
          />
          <div :class="['stat-change', stat.changeType]">
            {{ stat.change }}
          </div>
        </div>
      </div>

      <!-- Featured -->
      <div class="featured">
        <div class="featured-label">
          精选文档
        </div>
        <h2>{{ featured.title }}</h2>
        <p>{{ featured.author }}</p>
        <div class="featured-meta">
          <span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle
                cx="12"
                cy="7"
                r="4"
              />
            </svg>
            {{ featured.author }}
          </span>
          <span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
              />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {{ featured.updatedAt }}
          </span>
          <span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle
                cx="12"
                cy="12"
                r="3"
              />
            </svg>
            {{ featured.views }} 次浏览
          </span>
        </div>
      </div>

      <!-- Recent docs -->
      <div class="section-header">
        <h2>最近更新</h2>
        <a href="#">查看全部 →</a>
      </div>

      <div class="doc-grid">
        <div
          v-for="doc in documents"
          :key="doc.id"
          class="doc-card"
        >
          <div :class="['doc-type', doc.type.toLowerCase()]">
            {{ doc.type }}
          </div>
          <h3>{{ doc.title }}</h3>
          <p class="excerpt">
            {{ doc.excerpt }}
          </p>
          <div class="doc-footer">
            <div class="doc-author">
              <div
                class="doc-author-avatar"
                :style="{ background: doc.authorAvatar }"
              >
                {{ doc.author[0] }}
              </div>
              <span>{{ doc.author }}</span>
            </div>
            <span class="doc-date">{{ doc.date }}</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
interface Category {
  name: string
  color: string
  count: number
}

interface Stat {
  label: string
  value: string
  change: string
  changeType: 'up' | 'down'
}

interface Featured {
  title: string
  author: string
  updatedAt: string
  views: string
}

interface Document {
  id: number
  type: 'PDF' | 'DOC' | 'PPT' | 'SHEET'
  title: string
  excerpt: string
  author: string
  authorAvatar: string
  date: string
}

const categories: Category[] = [
  { name: '技术文档', color: '#7a3b3b', count: 34 },
  { name: '产品需求', color: '#c4873b', count: 21 },
  { name: '会议纪要', color: '#6b7c5e', count: 45 },
  { name: '设计规范', color: '#5a4d3a', count: 16 },
  { name: '周报月报', color: '#6b8db5', count: 12 },
]

const tags: string[] = ['前端开发', '后端架构', 'UI 设计', '项目管理', '数据分析']

const stats: Stat[] = [
  { label: '总文档数', value: '128', change: '+12 本月', changeType: 'up' },
  { label: '活跃分享', value: '46', change: '+8 本周', changeType: 'up' },
  { label: '团队成员', value: '23', change: '+3 本月', changeType: 'up' },
  { label: '存储用量', value: '4.2<small style="font-size:0.5em;color:var(--warm-gray)">GB</small>', change: '78% 已用', changeType: 'down' },
]

const featured: Featured = {
  title: '2026 年度产品路线图 — 核心战略与里程碑',
  author: '彭海军',
  updatedAt: '3 天前更新',
  views: '2,847',
}

const documents: Document[] = [
  {
    id: 1,
    type: 'PDF',
    title: '前端性能优化白皮书 v3.0',
    excerpt: '涵盖 Core Web Vitals 优化策略、代码分割最佳实践、图片与字体加载方案的完整指南。',
    author: '李思远',
    authorAvatar: 'linear-gradient(135deg,#7a3b3b,#a06a28)',
    date: '2 小时前',
  },
  {
    id: 2,
    type: 'DOC',
    title: '用户增长策略 — Q2 复盘与 Q3 规划',
    excerpt: '基于上半年数据表现，对获客渠道、留存策略和变现路径的深度分析与调整建议。',
    author: '王晓涵',
    authorAvatar: 'linear-gradient(135deg,#6b7c5e,#4a6741)',
    date: '5 小时前',
  },
  {
    id: 3,
    type: 'PPT',
    title: 'Design System 2.0 组件库升级提案',
    excerpt: '从 Token 体系重构、组件 API 统一、到无障碍合规的全面升级方案。',
    author: '赵雨萱',
    authorAvatar: 'linear-gradient(135deg,#c4873b,#8b5e34)',
    date: '昨天',
  },
  {
    id: 4,
    type: 'SHEET',
    title: 'API 接口性能基准测试数据',
    excerpt: '各核心接口在不同并发量下的响应时间、错误率及资源消耗统计。',
    author: '陈墨白',
    authorAvatar: 'linear-gradient(135deg,#2c2418,#5a4d3a)',
    date: '昨天',
  },
  {
    id: 5,
    type: 'PDF',
    title: '微服务架构迁移可行性评估报告',
    excerpt: '对现有单体架构拆分为微服务的技术评估，包含成本分析和分阶段迁移路径。',
    author: '刘浩然',
    authorAvatar: 'linear-gradient(135deg,#6b8db5,#4a6b8a)',
    date: '3 天前',
  },
  {
    id: 6,
    type: 'DOC',
    title: '移动端适配规范与多端一致性方案',
    excerpt: '覆盖 iOS/Android/H5 三端的 UI 适配标准、交互差异处理及自动化测试策略。',
    author: '林紫薇',
    authorAvatar: 'linear-gradient(135deg,#7a3b3b,#5a2828)',
    date: '4 天前',
  },
]
</script>

<style scoped>
.document-library {
  --parchment: #f5f0e8;
  --cream: #ece5d8;
  --warm-gray: #b8ae9e;
  --ink: #2c2418;
  --ink-light: #5a4d3a;
  --amber: #c4873b;
  --amber-deep: #a06a28;
  --burgundy: #7a3b3b;
  --sage: #6b7c5e;
  --sidebar-w: 280px;
  --topbar-h: 64px;
  --grain: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
}

/* GRAIN OVERLAY */
.document-library::after {
  content: '';
  position: fixed;
  inset: 0;
  background: var(--grain);
  background-size: 256px;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.5;
}

/* TOP BAR */
.topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--topbar-h);
  background: var(--ink);
  display: flex;
  align-items: center;
  padding: 0 32px;
  z-index: 100;
  border-bottom: 2px solid var(--amber);
}

.topbar::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--grain);
  background-size: 256px;
  opacity: 0.3;
  pointer-events: none;
}

.logo {
  font-family: 'Playfair Display', serif;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--parchment);
  letter-spacing: 0.04em;
  margin-right: 48px;
  position: relative;
}

.logo em {
  color: var(--amber);
  font-style: italic;
}

.top-nav {
  display: flex;
  gap: 4px;
  list-style: none;
  height: 100%;
  align-items: center;
}

.top-nav li a {
  color: var(--warm-gray);
  text-decoration: none;
  font-size: 0.87rem;
  font-weight: 500;
  padding: 8px 18px;
  border-radius: 6px;
  transition: all 0.25s ease;
  letter-spacing: 0.02em;
  position: relative;
}

.top-nav li a:hover,
.top-nav li a.active {
  color: var(--parchment);
  background: rgba(196, 135, 59, 0.15);
}

.top-nav li a.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 2px;
  background: var(--amber);
  border-radius: 1px;
}

.topbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-box {
  position: relative;
}

.search-box input {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--parchment);
  padding: 8px 16px 8px 36px;
  border-radius: 20px;
  font-family: inherit;
  font-size: 0.85rem;
  width: 220px;
  transition: all 0.3s ease;
  outline: none;
}

.search-box input::placeholder {
  color: var(--warm-gray);
}

.search-box input:focus {
  width: 300px;
  background: rgba(255, 255, 255, 0.12);
  border-color: var(--amber);
}

.search-box svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--warm-gray);
}

.btn-admin {
  color: var(--warm-gray);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 6px;
  transition: all 0.25s ease;
}

.btn-admin:hover {
  color: var(--parchment);
  background: rgba(255, 255, 255, 0.08);
}

.btn-upload {
  background: var(--amber);
  color: var(--ink);
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  letter-spacing: 0.02em;
}

.btn-upload:hover {
  background: var(--amber-deep);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(196, 135, 59, 0.3);
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--amber), var(--burgundy));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--parchment);
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: transform 0.2s;
}

.avatar:hover {
  transform: scale(1.08);
}

/* SIDEBAR */
.sidebar {
  position: fixed;
  top: var(--topbar-h);
  left: 0;
  bottom: 0;
  width: var(--sidebar-w);
  background: var(--cream);
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  overflow-y: auto;
  padding: 24px 0;
  z-index: 50;
}

.sidebar::-webkit-scrollbar {
  width: 4px;
}

.sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar::-webkit-scrollbar-thumb {
  background: var(--warm-gray);
  border-radius: 2px;
}

.sidebar-section {
  margin-bottom: 28px;
  padding: 0 20px;
}

.sidebar-title {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--warm-gray);
  margin-bottom: 12px;
  padding-left: 12px;
}

.sidebar-list {
  list-style: none;
}

.sidebar-list li a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--ink-light);
  font-size: 0.9rem;
  font-weight: 400;
  transition: all 0.2s ease;
  position: relative;
}

.sidebar-list li a:hover {
  background: rgba(196, 135, 59, 0.08);
  color: var(--ink);
}

.sidebar-list li a.active {
  background: rgba(196, 135, 59, 0.12);
  color: var(--amber-deep);
  font-weight: 500;
}

.sidebar-list li a.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--amber);
  border-radius: 0 2px 2px 0;
}

.sidebar-icon {
  width: 20px;
  height: 20px;
  opacity: 0.7;
  flex-shrink: 0;
}

.sidebar-list li a:hover .sidebar-icon,
.sidebar-list li a.active .sidebar-icon {
  opacity: 1;
}

.sidebar-count {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--warm-gray);
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.sidebar-tag {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
}

/* MAIN CONTENT */
.main {
  margin-top: var(--topbar-h);
  margin-left: var(--sidebar-w);
  height: calc(100vh - var(--topbar-h));
  overflow-y: auto;
  padding: 36px 40px;
}

.main::-webkit-scrollbar {
  width: 6px;
}

.main::-webkit-scrollbar-track {
  background: transparent;
}

.main::-webkit-scrollbar-thumb {
  background: var(--warm-gray);
  border-radius: 3px;
}

.page-header {
  margin-bottom: 36px;
  animation: fadeUp 0.6s ease both;
}

.page-header h1 {
  font-family: 'Playfair Display', serif;
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 8px;
}

.page-header p {
  color: var(--ink-light);
  font-size: 0.95rem;
  font-weight: 300;
}

/* FEATURED */
.featured {
  background: var(--ink);
  border-radius: 16px;
  padding: 36px 40px;
  margin-bottom: 36px;
  position: relative;
  overflow: hidden;
  animation: fadeUp 0.6s 0.1s ease both;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.featured:hover {
  transform: translateY(-2px);
}

.featured::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(196, 135, 59, 0.2) 0%, transparent 70%);
  pointer-events: none;
}

.featured::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--grain);
  background-size: 256px;
  opacity: 0.4;
  pointer-events: none;
}

.featured-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--amber);
  font-weight: 600;
  margin-bottom: 12px;
}

.featured h2 {
  font-family: 'Playfair Display', serif;
  font-size: 1.7rem;
  color: var(--parchment);
  font-weight: 600;
  margin-bottom: 10px;
  position: relative;
  z-index: 1;
}

.featured p {
  color: var(--warm-gray);
  font-size: 0.92rem;
  line-height: 1.6;
  max-width: 560px;
  position: relative;
  z-index: 1;
}

.featured-meta {
  display: flex;
  gap: 20px;
  margin-top: 20px;
  position: relative;
  z-index: 1;
}

.featured-meta span {
  font-size: 0.8rem;
  color: var(--warm-gray);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* SECTION HEADER */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  animation: fadeUp 0.6s 0.2s ease both;
}

.section-header h2 {
  font-family: 'Playfair Display', serif;
  font-size: 1.35rem;
  font-weight: 600;
}

.section-header a {
  font-size: 0.82rem;
  color: var(--amber);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.section-header a:hover {
  color: var(--amber-deep);
}

/* DOC CARDS GRID */
.doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 48px;
}

.doc-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  animation: fadeUp 0.5s ease both;
}

.doc-card:nth-child(1) { animation-delay: 0.25s; }
.doc-card:nth-child(2) { animation-delay: 0.3s; }
.doc-card:nth-child(3) { animation-delay: 0.35s; }
.doc-card:nth-child(4) { animation-delay: 0.4s; }
.doc-card:nth-child(5) { animation-delay: 0.45s; }
.doc-card:nth-child(6) { animation-delay: 0.5s; }

.doc-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--amber);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.doc-card:hover::before {
  transform: scaleX(1);
}

.doc-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(44, 36, 24, 0.08);
  border-color: rgba(196, 135, 59, 0.2);
}

.doc-type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 4px 10px;
  border-radius: 4px;
  margin-bottom: 14px;
}

.doc-type.pdf {
  background: rgba(122, 59, 59, 0.08);
  color: var(--burgundy);
}

.doc-type.doc {
  background: rgba(107, 124, 94, 0.1);
  color: var(--sage);
}

.doc-type.ppt {
  background: rgba(196, 135, 59, 0.1);
  color: var(--amber-deep);
}

.doc-type.sheet {
  background: rgba(44, 36, 24, 0.06);
  color: var(--ink-light);
}

.doc-card h3 {
  font-family: 'Source Serif 4', serif;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 8px;
  line-height: 1.4;
  transition: color 0.2s;
}

.doc-card:hover h3 {
  color: var(--amber-deep);
}

.doc-card .excerpt {
  font-size: 0.84rem;
  color: var(--warm-gray);
  line-height: 1.55;
  margin-bottom: 16px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.doc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}

.doc-author {
  display: flex;
  align-items: center;
  gap: 8px;
}

.doc-author-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: #fff;
}

.doc-author span {
  font-size: 0.8rem;
  color: var(--ink-light);
}

.doc-date {
  font-size: 0.76rem;
  color: var(--warm-gray);
}

/* STATS ROW */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 40px;
  animation: fadeUp 0.6s 0.15s ease both;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.stat-card:hover {
  border-color: rgba(196, 135, 59, 0.15);
  box-shadow: 0 4px 16px rgba(44, 36, 24, 0.05);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--warm-gray);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
  font-weight: 500;
}

.stat-value {
  font-family: 'Playfair Display', serif;
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--ink);
}

.stat-change {
  font-size: 0.78rem;
  margin-top: 4px;
  font-weight: 500;
}

.stat-change.up {
  color: var(--sage);
}

.stat-change.down {
  color: var(--burgundy);
}

/* ANIMATIONS */
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* RESPONSIVE */
@media (max-width: 900px) {
  .sidebar {
    display: none;
  }

  .main {
    margin-left: 0;
  }

  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
