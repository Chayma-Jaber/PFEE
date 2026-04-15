/**
 * Local Development Environment Configuration
 * Use this for local testing with the FastAPI backend
 */
export const environementLocal = {
    // Local FastAPI backend
    api: 'http://localhost:8000',

    // Search API (Meilisearch or local)
    apiSearchDev: 'http://localhost:8000',

    // Token for search (not needed locally)
    tokenSearchDev: '',

    // Local redirect
    redirectUrlLocal: 'http://localhost:4200/checkout/order-confirmation',

    // Analytics (disabled locally)
    googleAnalyticsId: '',

    // AI Chatbot endpoint
    apiChatbot: 'http://localhost:8000/api/chat',

    // Feature flags
    useLocalAuth: true,
    enableAnalytics: false,
    debugMode: true
};
