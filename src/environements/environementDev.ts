// export const environementDev={

//  apiSearchDev:'https://test-cache.barsha.com.tn' ,

//     api :'https://test-main.barsha.com.tn',

//     tokenSearchDev:'79cc93dd207a527d5d5526e34b87998b0b0d71bf2a032c2f4be1ceaba58cb79f',

//     redirectUrlLocal:'https://sunevit.tn/barsha/fr/profile',


//     googleAnalyticsId: 'G-2P3LY9HVJ0',

// }


// ## environement sunevit :

// export const environementDev={

//  apiSearchDev:'https://test-cache.barsha.com.tn' ,

//     api :'https://test-main.barsha.com.tn',

//     tokenSearchDev:'79cc93dd207a527d5d5526e34b87998b0b0d71bf2a032c2f4be1ceaba58cb79f',

//     redirectUrlLocal:'https://sunevit.tn/barsha/fr/profile',


// googleAnalyticsId: 'G-2P3LY9HVJ0'
// }



// ## environement Prod :

// Set to true to use local backend (for development/testing)
const USE_LOCAL_BACKEND = true;

export const environementDev = USE_LOCAL_BACKEND ? {
    // LOCAL DEVELOPMENT MODE
    apiSearchDev: 'http://localhost:8002',
    api: 'http://localhost:8002',
    tokenSearchDev: '',
    useMockSearchData: true,
    redirectUrlLocal: 'http://localhost:4200/checkout/order-confirmation',
    googleAnalyticsId: '',
    // Route all AI requests through the main Nest backend.
    // The backend proxies /api/chat, /api/visual-search and /api/like-this to the AI service.
    apiChatbot: 'http://localhost:8002/api/chat',
    backendAiUrl: 'http://localhost:8001',
    useLocalAuth: true,
    enableAnalytics: true
} : {
    // PRODUCTION MODE
    apiSearchDev: 'https://cache-data.barsha.com.tn',
    api: 'https://main.barsha.com.tn',
    tokenSearchDev: '660ac272a4c62f4138f96bc52d33f1d6de8a182712321c667f516312f2db200c',
    useMockSearchData: false,
    redirectUrlLocal: 'https://barsha.com.tn/fr/checkout/order-confirmation',
    googleAnalyticsId: 'G-2P3LY9HVJ0',
    // Production should also go through the main public backend, not localhost.
    apiChatbot: 'https://main.barsha.com.tn/api/chat',
    backendAiUrl: 'https://ai.barsha.com.tn',
    useLocalAuth: false,
    enableAnalytics: true
}

// pour Builder popur sunevit:
// ng build --configuration production --base-href /barsha/fr/
// pour Builder popur prod:
// ng build --configuration production --base-href /fr/




