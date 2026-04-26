# Routers module
from app.routers.auth import router as auth_router
from app.routers.payment import router as payment_router
from app.routers.orders import router as orders_router
from app.routers.orders import compat_router as orders_compat_router
from app.routers.admin_dashboard import router as admin_dashboard_router
from app.routers.admin_orders import router as admin_orders_router
from app.routers.admin_products import router as admin_products_router
from app.routers.admin_customers import router as admin_customers_router
from app.routers.admin_coupons import router as admin_coupons_router
from app.routers.admin_returns import router as admin_returns_router
from app.routers.admin_content import router as admin_content_router
from app.routers.admin_settings import router as admin_settings_router
from app.routers.admin_reports import router as admin_reports_router
from app.routers.recommendations import recommendations_router
from app.routers.analytics import analytics_router
from app.routers.support import router as support_router
from app.routers.support import admin_router as admin_support_router
from app.routers.notifications import router as notifications_router
from app.routers.faq import router as faq_router
from app.routers.faq import admin_router as admin_faq_router
from app.routers.meilisearch_compat import router as meilisearch_compat_router
from app.routers.premium_recommendations import router as premium_recommendations_router
from app.routers.next_gen_recommendations import router as next_gen_recommendations_router
from app.routers.user_preferences import router as user_preferences_router
from app.routers.wishlist_sharing import router as wishlist_sharing_router
from app.routers.wishlist_collections import router as wishlist_collections_router
from app.routers.alerts import router as alerts_router
from app.routers.alerts import admin_router as admin_alerts_router
from app.routers.outfits import router as outfits_router
from app.routers.outfits import admin_router as admin_outfits_router
from app.routers.reviews import router as reviews_router
from app.routers.reviews import admin_router as admin_reviews_router
from app.routers.gift_cards import router as gift_cards_router
from app.routers.gift_cards import admin_router as admin_gift_cards_router
from app.routers.loyalty import router as loyalty_router
from app.routers.loyalty import admin_router as admin_loyalty_router
from app.routers.referrals import router as referrals_router
from app.routers.promotions import router as promotions_router
from app.routers.promotions import admin_router as admin_promotions_router
from app.routers.bundles import router as bundles_router
from app.routers.bundles import admin_router as admin_bundles_router
from app.routers.newsletter import router as newsletter_router
from app.routers.stock_alerts import router as stock_alerts_router
from app.routers.product_qa import router as product_qa_router
from app.routers.product_qa import admin_router as admin_product_qa_router

__all__ = [
    "auth_router",
    "payment_router",
    "orders_router",
    "orders_compat_router",
    "admin_dashboard_router",
    "admin_orders_router",
    "admin_products_router",
    "admin_customers_router",
    "admin_coupons_router",
    "admin_returns_router",
    "admin_content_router",
    "admin_settings_router",
    "admin_reports_router",
    "recommendations_router",
    "analytics_router",
    "support_router",
    "admin_support_router",
    "notifications_router",
    "faq_router",
    "admin_faq_router",
    "meilisearch_compat_router",
    "premium_recommendations_router",
    "next_gen_recommendations_router",
    "user_preferences_router",
    "wishlist_sharing_router",
    "wishlist_collections_router",
    "alerts_router",
    "admin_alerts_router",
    "outfits_router",
    "admin_outfits_router",
    "reviews_router",
    "admin_reviews_router",
    "gift_cards_router",
    "admin_gift_cards_router",
    "loyalty_router",
    "admin_loyalty_router",
    "referrals_router",
    "promotions_router",
    "admin_promotions_router",
    "bundles_router",
    "admin_bundles_router",
    "newsletter_router",
    "stock_alerts_router",
    "product_qa_router",
    "admin_product_qa_router"
]
