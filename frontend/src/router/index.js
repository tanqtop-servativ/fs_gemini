import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase'
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
            path: '/jobs',
            name: 'jobs',
            component: () => import('../views/JobsView.vue'),
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
        },
        {
            path: '/analytics',
            name: 'analytics',
            component: () => import('../views/AnalyticsDashboardView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/worker',
            name: 'worker-home',
            component: () => import('../views/WorkerHomeView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/power-user',
            name: 'power-user',
            component: () => import('../views/PowerUserView.vue'),
            meta: { requiresAuth: true }
        }
    ]
})

router.beforeEach(async (to, from, next) => {
    // Direct check to Supabase - this is synchronous from localStorage cache
    const { data: { session } } = await supabase.auth.getSession()
    const isAuthenticated = !!session

    if (to.meta.requiresAuth && !isAuthenticated) {
        next('/login')
    } else if (to.path === '/login' && isAuthenticated) {
        next('/')
    } else {
        next()
    }
})

export default router
