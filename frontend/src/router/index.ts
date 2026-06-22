import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'DocumentLibrary',
      component: () => import('../views/DocumentLibrary.vue'),
    },
    {
      path: '/chat',
      name: 'ChatView',
      component: () => import('../views/ChatView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/recent',
      name: 'RecentDocs',
      component: () => import('../views/RecentDocs.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/auth/Login.vue'),
      meta: { guest: true },
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('../views/auth/Register.vue'),
      meta: { guest: true },
    },
    {
      path: '/training',
      name: 'DailyTraining',
      component: () => import('../views/DailyTraining.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/docs/:id',
      name: 'DocViewer',
      component: () => import('../views/DocViewer.vue'),
    },
    {
      path: '/collected',
      name: 'CollectedQuestions',
      component: () => import('../views/CollectedQuestions.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      name: 'AdminDashboard',
      component: () => import('../views/AdminDashboard.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/docs',
      name: 'AdminDocs',
      component: () => import('../views/admin/DocManage.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/users',
      name: 'AdminUsers',
      component: () => import('../views/admin/UserManage.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/questions',
      name: 'AdminQuestions',
      component: () => import('../views/admin/QuestionBank.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()

  console.log('[router] beforeEach', to.path, 'isAuthenticated=', authStore.isAuthenticated, 'token=', authStore.token)

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    console.warn('[router] 未登录，跳转 /login')
    next('/login')
    return
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next('/')
    return
  }

  if (to.meta.guest && authStore.isAuthenticated) {
    next('/')
    return
  }

  next()
})

export default router
