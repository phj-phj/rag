import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import AdminDashboard from '../views/AdminDashboard.vue'
import DocumentLibrary from '../views/DocumentLibrary.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'DocumentLibrary',
    component: DocumentLibrary,
  },
  {
    path: '/admin',
    name: 'Admin',
    component: AdminDashboard,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
