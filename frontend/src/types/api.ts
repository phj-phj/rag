// ── 通用 ──

export interface OptionItem {
  id: number
  name: string
}

export interface UserBrief {
  id: number
  username: string
}

// ── 文档 ──

export interface DocItem {
  id: number
  title: string
  file_type: string
  file_size: number
  file_url?: string
  created_at: string
  uploader?: UserBrief
  category?: OptionItem
  tags?: OptionItem[]
  isFavorited?: boolean
  is_featured?: boolean
}

export interface DocListResponse {
  items: DocItem[]
  total: number
  page: number
  pageSize: number
}

export interface DocContentResponse {
  text: string
  html: string
  file_type: string
  images: string[]
}

export interface DocumentListParams {
  page?: number
  pageSize?: number
  title?: string
  category_id?: number | null
  tags?: string
  is_featured?: string
}

// ── 聊天 ──

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  docId?: number
  docTitle?: string
}

export interface ChatAskResponse {
  answer: string
  model: string
  docId: number
  docTitle: string
}

// ── 用户管理 ──

export interface UserItem {
  id: number
  username: string
  role: string
  document_count: number
  created_at: string
}

// ── 统计 ──

export interface DashboardStats {
  totalDocs: number
  totalCategories: number
  totalUsers: number
}

// ── 认证 ──

export interface AuthUser {
  id: number
  username: string
  role: 'user' | 'admin'
}

export interface AuthResponse {
  token: string
  user: AuthUser
}
