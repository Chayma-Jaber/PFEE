/**
 * BARSHA Next-Generation Recommendations Module
 * ==============================================
 * Version: 3.0.0
 *
 * Premium recommendation components for luxury fashion e-commerce.
 *
 * Components:
 * - NextGenRecommendationsComponent: Base recommendation component
 * - PDPRecommendationsComponent: Product detail page orchestrator
 * - HomepageRecommendationsComponent: Homepage orchestrator
 * - CartRecommendationsNextGenComponent: Cart/checkout recommendations
 * - PostPurchaseRecommendationsComponent: Order confirmation recommendations
 * - AccountRecommendationsComponent: User account/profile recommendations
 */

// Core Components
export * from './next-gen-recommendations.component';

// Page-Specific Orchestrators
export * from './pdp-recommendations.component';
export * from './homepage-recommendations.component';

// Journey-Specific Components
export * from './cart-recommendations.component';
export * from './post-purchase-recommendations.component';
export * from './account-recommendations.component';
