import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { list as listDocs, create as createDoc, deleteDoc } from '../api/document'
import { getCategories, getTags } from '../api/admin'

interface DocItem { id: number; title: string; file_type: string; file_size: number; file_url?: string; created_at: string; uploader?: { username: string }; category?: { name: string }; tags?: { id: number; name: string }[]; isFavorited?: boolean }
interface OptionItem { id: number; name: string }

export const useDocumentStore = defineStore('document', () => {
  const documents = ref<DocItem[]>([])
  const categories = ref<OptionItem[]>([])
  const tags = ref<OptionItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(12)
  const loading = ref(false)

  const filters = reactive({
    title: '',
    category_id: null as number | null,
    tags: '' as string,
  })

  async function fetchDocuments() {
    loading.value = true
    try {
      const params: Record<string, unknown> = {
        page: page.value,
        pageSize: pageSize.value,
      }
      if (filters.title) params.title = filters.title
      if (filters.category_id) params.category_id = filters.category_id
      if (filters.tags) params.tags = filters.tags

      const { data } = await listDocs(params)
      documents.value = data.items
      total.value = data.total
    } finally {
      loading.value = false
    }
  }

  async function fetchCategories() {
    const { data } = await getCategories()
    categories.value = data
  }

  async function fetchTags() {
    const { data } = await getTags()
    tags.value = data
  }

  async function uploadDocuments(formData: FormData) {
    const { data } = await createDoc(formData)
    await fetchDocuments()
    return data
  }

  async function removeDocument(id: number) {
    await deleteDoc(id)
    await fetchDocuments()
  }

  function setPage(p: number) {
    page.value = p
    fetchDocuments()
  }

  function setFilters(f: Partial<typeof filters>) {
    Object.assign(filters, f)
    page.value = 1
    fetchDocuments()
  }

  // For admin doc management
  async function fetchForAdmin(params?: Record<string, unknown>) {
    loading.value = true
    try {
      const { listDocs: listAdminDocs } = await import('../api/admin')
      const { data } = await listAdminDocs(params)
      documents.value = data.items
      total.value = data.total
    } finally {
      loading.value = false
    }
  }

  return {
    documents, categories, tags, total, page, pageSize, loading,
    filters, fetchDocuments, fetchCategories, fetchTags,
    uploadDocuments, removeDocument, setPage, setFilters, fetchForAdmin,
  }
})
