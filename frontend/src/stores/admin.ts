import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as adminApi from '../api/admin'

interface CategoryStat { category_id: number; category_name: string; count: number }
interface UploadTrendItem { date: string; count: number }
interface RecentActivity { id: number; title: string; file_type: string; uploader: string; created_at: string }

interface AdminStats {
  totalDocs: number
  totalCategories: number
  totalUsers: number
  categoryStats: CategoryStat[]
  uploadTrend: UploadTrendItem[]
  recentActivities: RecentActivity[]
}

interface AdminUser { id: number; username: string; role: string; document_count: number; created_at: string }

export const useAdminStore = defineStore('admin', () => {
  const stats = ref<AdminStats | null>(null)
  const users = ref<AdminUser[]>([])
  const totalUsers = ref(0)
  const loading = ref(false)

  async function fetchStats() {
    const { data } = await adminApi.getStats()
    stats.value = data as AdminStats
  }

  async function fetchUsers(params?: Record<string, unknown>) {
    loading.value = true
    try {
      const { data } = await adminApi.getUsers(params)
      users.value = data.items
      totalUsers.value = data.total
    } finally {
      loading.value = false
    }
  }

  async function updateUserPassword(userId: number, password: string) {
    await adminApi.updatePassword(userId, password)
  }

  return { stats, users, totalUsers, loading, fetchStats, fetchUsers, updateUserPassword }
})
