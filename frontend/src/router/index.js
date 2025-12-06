import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/login',
            name: 'login',
            component: LoginView
        },
        {
            path: '/',
            name: 'home',
            component: HomeView,
            meta: { requiresAuth: true }
        },
        {
            path: '/calendar',
            name: 'calendar',
            // route level code-splitting
            // this generates a separate chunk (About.[hash].js) for this route
            // which is lazy-loaded when the route is visited.
            component: () => import('../views/CalendarView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/activity',
            name: 'activity',
            component: () => import('../views/ActivityFeedView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/jobs/:id',
            name: 'job-detail',
            component: () => import('../views/JobDetailView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/admin',
            name: 'admin',
            component: () => import('../views/AdminView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/people',
            name: 'people',
            component: () => import('../views/PeopleView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/properties',
            name: 'properties',
            component: () => import('../views/PropertiesView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/job-templates',
            name: 'job-templates',
            component: () => import('../views/JobTemplatesView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/service-templates',
            name: 'service-templates',
            component: () => import('../views/ServiceTemplatesView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/service-opportunities',
            name: 'service-opportunities',
            component: () => import('../views/ServiceOpportunitiesView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/bom-templates',
            name: 'bom-templates',
            component: () => import('../views/BOMTemplatesView.vue'),
            meta: { requiresAuth: true }
        }
    ]
})

router.beforeEach(async (to, from, next) => {
    const { user, loading, initAuth } = useAuth()

    // Wait for initial load if needed (simple check)
    if (loading.value) {
        // In a real app we might wait for the promise, but useAuth init is async inside mount.
        // For simplicity, we assume Supabase client has local storage state immediately available 
        // or we might need a dedicated auth loader.
        // checking supabase.auth.getSession() is usually fast.
    }

    // Direct check to Supabase for the guard to be safe
    // (Or rely on the user ref if we trust it's sync enough, but usually better to check storage)
    // Let's rely on the composable's user ref which we expect App.vue to have started.
    // Actually, router guard happens BEFORE App mount sometimes? 
    // Safety:
    const session = await import('../lib/supabase').then(m => m.supabase.auth.getSession())
    const isAuthenticated = !!session.data.session

    if (to.meta.requiresAuth && !isAuthenticated) {
        next('/login')
    } else if (to.path === '/login' && isAuthenticated) {
        next('/')
    } else {
        next()
    }
})

export default router
