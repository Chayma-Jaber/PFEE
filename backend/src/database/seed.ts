/**
 * Barsha E-Commerce - Realistic seed script
 * Supports the database configured in backend/.env (MSSQL or SQLite).
 * Run with: npm run seed
 */
import { DataSource, DataSourceOptions, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as fs from 'fs';

import { User, UserRole } from '../users/entities/user.entity';
import { Address } from '../users/entities/address.entity';
import { Category } from '../categories/entities/category.entity';
import { Product, Famille } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { FAQ } from '../faq/entities/faq.entity';
import { Banner } from '../admin/entities/banner.entity';
import {
  Coupon,
  CouponAppliesTo,
  CouponDiscountType,
} from '../promotions/entities/coupon.entity';
import { CouponUsage } from '../promotions/entities/coupon-usage.entity';
import {
  Promotion,
  PromotionType,
  DiscountType,
} from '../promotions/entities/promotion.entity';
import {
  Order,
  OrderSource,
  OrderStatus,
  PaymentMethodType,
  PaymentStatus,
} from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { ReturnRequest, ReturnStatus } from '../orders/entities/return-request.entity';
import {
  Payment,
  PaymentMethod,
  PaymentState,
} from '../payments/entities/payment.entity';
import { PaymentLog } from '../payments/entities/payment-log.entity';
import {
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../support/entities/support-ticket.entity';
import { TicketMessage, SenderType } from '../support/entities/ticket-message.entity';
import { ProductReview, FitRating } from '../reviews/entities/product-review.entity';
import { ProductQA } from '../product-qa/entities/product-qa.entity';
import { LoyaltyAccount, LoyaltyTier } from '../loyalty/entities/loyalty-account.entity';
import { LoyaltyTransaction, TransactionType } from '../loyalty/entities/loyalty-transaction.entity';
import { GiftCard } from '../gift-cards/entities/gift-card.entity';
import { StoreCredit } from '../gift-cards/entities/store-credit.entity';
import { NewsletterSubscriber, SubscriptionSource } from '../newsletter/entities/newsletter-subscriber.entity';
import { Notification, NotificationType } from '../notifications/entities/notification.entity';
import { Outfit } from '../outfits/entities/outfit.entity';
import { WishlistCollection } from '../wishlist/entities/wishlist-collection.entity';
import { WishlistItem } from '../wishlist/entities/wishlist-item.entity';
import { ProductAlert, AlertType } from '../alerts/entities/product-alert.entity';
import { StockAlert } from '../alerts/entities/stock-alert.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import {
  Referral,
  ReferralStatus,
  RewardType,
} from '../referrals/entities/referral.entity';
import { EditorialRecommendation } from '../recommendations/entities/recommendation.entity';
import { AdminLog } from '../analytics/entities/admin-log.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { ProductStock } from '../warehouses/entities/product-stock.entity';
import { FraudSignal, FraudStatus } from '../fraud/entities/fraud-signal.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { SubscriptionCycle } from '../subscriptions/entities/subscription-cycle.entity';
import {
  DynamicPriceRule,
  DynamicPricingScope,
  DynamicPricingStrategy,
} from '../dynamic-pricing/entities/dynamic-price-rule.entity';
import { DynamicPriceChange } from '../dynamic-pricing/entities/dynamic-price-change.entity';
import { FeatureFlag } from '../feature-flags/entities/feature-flag.entity';
import { FeatureFlagEvent } from '../feature-flags/entities/flag-event.entity';
import { Seller, SellerStatus } from '../marketplace/entities/seller.entity';
import { SellerPayout } from '../marketplace/entities/seller-payout.entity';
import { B2BAccount, B2BPaymentTerms, B2BStatus, B2BTier } from '../b2b/entities/b2b-account.entity';
import { B2BQuote, QuoteStatus } from '../b2b/entities/b2b-quote.entity';
import { ProductDrop, DropStatus } from '../preorder/entities/product-drop.entity';
import { PreorderReservation, ReservationStatus } from '../preorder/entities/preorder-reservation.entity';
import { Configurator } from '../configurator/entities/configurator.entity';
import { ConfiguratorSlot } from '../configurator/entities/configurator-slot.entity';
import { LifecycleEnrollment } from '../lifecycle/entities/lifecycle-enrollment.entity';
import { LifecycleSequence, LifecycleTrigger } from '../lifecycle/entities/lifecycle-sequence.entity';
import { Supplier } from '../replenishment/entities/supplier.entity';
import { PurchaseOrder, PurchaseOrderStatus } from '../replenishment/entities/purchase-order.entity';
import { ProductSupplier } from '../replenishment/entities/product-supplier.entity';
import { CmsPage, CmsPageStatus } from '../cms/entities/cms-page.entity';
import { CmsRevision } from '../cms/entities/cms-revision.entity';
import { GdprRequest, GdprRequestStatus, GdprRequestType } from '../gdpr/entities/gdpr-request.entity';
import { FiscalReceipt, FiscalReceiptStatus } from '../fiscal/entities/fiscal-receipt.entity';
import { DomainEvent } from '../platform/events/entities/domain-event.entity';
import {
  AdminTask,
  AuditDiff,
  CustomerNote,
  CustomerSignal,
  CustomerTag,
  DailyDeal,
  DeliverySlot,
  PickupLocation,
  UgcPost,
} from '../wave4/wave4.entities';

type RawDeclinaison =
  | string
  | {
      couleur?: string | null;
      color?: string | null;
      taille?: string | null;
      size?: string | null;
      stock?: number | string | null;
    };

type RawProduct = {
  id: number | string;
  reference?: string | null;
  nom?: string | null;
  name?: string | null;
  genre?: string | null;
  famille?: string | null;
  prix?: number | string | null;
  price?: number | string | null;
  prix_promo?: number | string | null;
  currentPrice?: number | string | null;
  categorie?: Array<string | { nom?: string; name?: string }> | null;
  description?: string | null;
  image?: string | null;
  firstImg?: string | null;
  secondImg?: string | null;
  composition?: string | null;
  stock?: number | string | null;
  declinaisons?: RawDeclinaison[] | null;
  couleurs?: Array<string | { name?: string }> | null;
  colors?: Array<string | { name?: string }> | null;
  tailles?: Array<string | { name?: string }> | null;
  sizes?: Array<string | { name?: string }> | null;
};

const CUSTOMER_PASSWORD = 'Customer123!';
const STAFF_PASSWORD = 'Manager123!';
const ADMIN_PASSWORD = 'Admin123!';
const DEMO_PASSWORD = 'Demo123!';

const CITY_DATA = [
  { city: 'Tunis', postal: '1002', streets: ['Rue de Marseille', 'Rue d Alger', 'Avenue Habib Bourguiba'] },
  { city: 'La Marsa', postal: '2070', streets: ['Rue de la Plage', 'Avenue Taieb Mhiri', 'Rue de Tunis'] },
  { city: 'Sousse', postal: '4000', streets: ['Rue Ibn Khaldoun', 'Avenue Hedi Chaker', 'Rue des Orangers'] },
  { city: 'Sfax', postal: '3000', streets: ['Route de l Aeroport', 'Rue de Mahdia', 'Rue de Gremda'] },
  { city: 'Nabeul', postal: '8000', streets: ['Avenue Mongi Slim', 'Rue Habib Thameur', 'Rue des Jasmins'] },
  { city: 'Monastir', postal: '5000', streets: ['Avenue de l Environnement', 'Rue Farhat Hached', 'Rue Ibn Sina'] },
];

const CUSTOMER_PROFILES = [
  { email: 'demo@barsha.com.tn', first_name: 'Wassim', last_name: 'Demo', phone: '+21611111111', gender: 'male' },
  { email: 'sarah.benali@gmail.com', first_name: 'Sarah', last_name: 'Ben Ali', phone: '+21622334455', gender: 'female' },
  { email: 'ahmed.trabelsi@gmail.com', first_name: 'Ahmed', last_name: 'Trabelsi', phone: '+21655667788', gender: 'male' },
  { email: 'fatma.bouazizi@yahoo.fr', first_name: 'Fatma', last_name: 'Bouazizi', phone: '+21698112233', gender: 'female' },
  { email: 'youssef.hammami@outlook.com', first_name: 'Youssef', last_name: 'Hammami', phone: '+21650443322', gender: 'male' },
  { email: 'amira.jebali@gmail.com', first_name: 'Amira', last_name: 'Jebali', phone: '+21629887766', gender: 'female' },
  { email: 'mehdi.chaabane@gmail.com', first_name: 'Mehdi', last_name: 'Chaabane', phone: '+21655998877', gender: 'male' },
  { email: 'ines.maaloul@gmail.com', first_name: 'Ines', last_name: 'Maaloul', phone: '+21622556677', gender: 'female' },
  { email: 'karim.gharbi@gmail.com', first_name: 'Karim', last_name: 'Gharbi', phone: '+21698223344', gender: 'male' },
  { email: 'aya.kefi@gmail.com', first_name: 'Aya', last_name: 'Kefi', phone: '+21621009988', gender: 'female' },
  { email: 'riadh.selmi@gmail.com', first_name: 'Riadh', last_name: 'Selmi', phone: '+21695001122', gender: 'male' },
  { email: 'mariem.sassi@gmail.com', first_name: 'Mariem', last_name: 'Sassi', phone: '+21622221100', gender: 'female' },
  { email: 'walid.hamdi@gmail.com', first_name: 'Walid', last_name: 'Hamdi', phone: '+21654223311', gender: 'male' },
];

const STAFF_PROFILES = [
  { email: 'admin@barsha.com.tn', first_name: 'Admin', last_name: 'Barsha', phone: '+21600000000', role: UserRole.SUPER_ADMIN },
  { email: 'support@barsha.com.tn', first_name: 'Sonia', last_name: 'Support', phone: '+21670001122', role: UserRole.SUPPORT_AGENT },
  { email: 'orders@barsha.com.tn', first_name: 'Omar', last_name: 'Orders', phone: '+21670002233', role: UserRole.ORDER_MANAGER },
  { email: 'marketing@barsha.com.tn', first_name: 'Meriem', last_name: 'Marketing', phone: '+21670003344', role: UserRole.MARKETING_MANAGER },
  { email: 'catalog@barsha.com.tn', first_name: 'Khaled', last_name: 'Catalog', phone: '+21670004455', role: UserRole.CATALOG_MANAGER },
];

const REVIEW_TITLES = [
  'Tres bon achat',
  'Belle qualite',
  'Produit conforme',
  'Je recommande',
  'Taille bien',
  'Bonne surprise',
];

const REVIEW_COMMENTS = [
  'Tres beau produit, finition soignee et livraison rapide.',
  'La matiere est agreable et la coupe tombe tres bien.',
  'Couleur conforme aux photos, je suis satisfaite de mon achat.',
  'Bon rapport qualite prix, article pratique au quotidien.',
  'Produit confortable et elegant, parfait pour sortir.',
  'Commande recue rapidement, taille correcte et belle presentation.',
];

const QA_QUESTIONS = [
  'Est-ce que ce modele taille normalement ?',
  'La matiere est-elle legere pour l ete ?',
  'Le tissu est-il transparent ?',
  'Peut-on porter ce produit en mi-saison ?',
  'La coupe convient-elle aux silhouettes fines ?',
];

const QA_ANSWERS = [
  'Oui, le produit taille normalement. Nous conseillons votre taille habituelle.',
  'Oui, la matiere est legere et agreable pour une utilisation quotidienne.',
  'Non, le tissu reste suffisamment opaque dans la plupart des situations.',
  'Oui, c est une piece facile a porter en mi-saison avec une veste legere.',
];

const SUPPORT_SUBJECTS = [
  'Probleme de livraison',
  'Article endommage a la reception',
  'Question sur le remboursement',
  'Demande de changement de taille',
  'Paiement non confirme',
  'Information sur une commande',
];

const NOTIFICATION_MESSAGES = [
  {
    type: NotificationType.ORDER,
    title: 'Commande confirmee',
    message: 'Votre commande a ete confirmee et sera preparee tres prochainement.',
  },
  {
    type: NotificationType.ORDER,
    title: 'Commande expediee',
    message: 'Votre colis est en route et sera livre sous peu.',
  },
  {
    type: NotificationType.PROMOTION,
    title: 'Offre exclusive',
    message: 'Profitez d une remise speciale reservee aux clients fideles.',
  },
  {
    type: NotificationType.SUPPORT,
    title: 'Reponse du support',
    message: 'Notre equipe a mis a jour votre demande de support.',
  },
  {
    type: NotificationType.SYSTEM,
    title: 'Compte mis a jour',
    message: 'Vos preferences et informations de profil ont ete synchronisees.',
  },
];

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    const value = trimmed.slice(equalIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getEntityGlobs() {
  return [
    path.resolve(__dirname, '../**/*.entity{.ts,.js}'),
    path.resolve(__dirname, '../wave4/wave4.entities{.ts,.js}'),
  ];
}

function resolveSqlitePath() {
  const databaseUrl = process.env.DATABASE_URL || '';
  const dbName = process.env.DB_NAME || '';
  const explicitPath =
    databaseUrl.replace(/^sqlite:\/\/\//, '') ||
    process.env.DB_PATH ||
    (dbName.endsWith('.db') ? dbName : '') ||
    'barsha.db';

  return path.isAbsolute(explicitPath)
    ? explicitPath
    : path.resolve(process.cwd(), explicitPath);
}

function buildDataSourceOptions(): DataSourceOptions {
  loadLocalEnv();

  const dbType = (process.env.DB_TYPE || 'mssql').toLowerCase();
  const databaseUrl = process.env.DATABASE_URL || '';

  if (dbType === 'sqlite' || databaseUrl.startsWith('sqlite://')) {
    return {
      type: 'sqlite',
      database: resolveSqlitePath(),
      entities: getEntityGlobs(),
      synchronize: false,
      logging: false,
    };
  }

  const hasExplicitPort = typeof process.env.DB_PORT !== 'undefined';
  const instanceName =
    hasExplicitPort ? undefined : process.env.DB_INSTANCE_NAME || 'SQLEXPRESS';

  return {
    type: 'mssql',
    host: process.env.DB_HOST || 'localhost',
    ...(hasExplicitPort ? { port: parseInt(process.env.DB_PORT || '1433', 10) } : {}),
    username: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'admin123',
    database: process.env.DB_NAME || 'barsha',
    entities: getEntityGlobs(),
    synchronize: false,
    logging: false,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      ...(instanceName ? { instanceName } : {}),
    },
    extra: {
      trustServerCertificate: true,
    },
  };
}

function normalizeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return fallback;
}

function normalizePrice(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function toFamille(rawValue?: string | null): Famille {
  const value = normalizeString(rawValue).toLowerCase();
  if (value.includes('femme') || value.includes('woman') || value.includes('women')) {
    return Famille.WOMEN;
  }
  if (value.includes('homme') || value.includes('man') || value.includes('men')) {
    return Famille.MEN;
  }
  if (value.includes('enfant') || value.includes('kid') || value.includes('kids')) {
    return Famille.KIDS;
  }
  return Famille.UNISEX;
}

function inferCategorySlug(product: RawProduct): string | null {
  const famille = toFamille(product.genre || product.famille);
  if (famille === Famille.WOMEN) {
    return 'femme';
  }
  if (famille === Famille.MEN) {
    return 'homme';
  }
  if (famille === Famille.KIDS) {
    return 'enfant';
  }
  return null;
}

function normalizeKeywordText(value: string): string {
  return normalizeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => normalizeString(value)).filter(Boolean)),
  );
}

function inferLogicalSizes(product: RawProduct): string[] {
  const explicitSizes = uniqueValues(
    (product.tailles || product.sizes || []).map((item) =>
      typeof item === 'string' ? item : item?.name,
    ),
  );

  if (explicitSizes.length > 0) {
    return explicitSizes;
  }

  const productText = normalizeKeywordText(
    [
      product.nom,
      product.name,
      product.reference,
      product.description,
      ...(product.categorie || []).map((item) =>
        typeof item === 'string' ? item : item?.nom || item?.name,
      ),
    ]
      .filter(Boolean)
      .join(' '),
  );

  const famille = toFamille(product.genre || product.famille);

  const hasKeyword = (keywords: string[]) =>
    keywords.some((keyword) => productText.includes(keyword));

  const oneSizeKeywords = [
    'PARFUM',
    'SAC',
    'POCHETTE',
    'CASQUETTE',
    'BONNET',
    'CHAPEAU',
    'FOULARD',
    'ECHARPE',
    'PORTEFEUILLE',
    'BIJOU',
    'COLLIER',
    'BRACELET',
    'LUNETTE',
    'ACCESSOIRE',
  ];
  if (hasKeyword(oneSizeKeywords)) {
    return ['STD'];
  }

  if (hasKeyword(['CEINTURE'])) {
    return ['S', 'M', 'L'];
  }

  if (hasKeyword(['CHAUSSURE', 'SNEAKER', 'BASKET', 'MULE', 'ESCARPIN', 'SANDALE', 'BOTTE', 'BOTTINE'])) {
    if (famille === Famille.MEN) {
      return ['40', '41', '42', '43', '44', '45'];
    }
    if (famille === Famille.KIDS) {
      return ['28', '29', '30', '31', '32', '33', '34'];
    }
    return ['36', '37', '38', '39', '40', '41'];
  }

  if (famille === Famille.KIDS) {
    return ['4A', '6A', '8A', '10A', '12A', '14A'];
  }

  if (famille === Famille.MEN) {
    return ['S', 'M', 'L', 'XL', 'XXL'];
  }

  if (
    hasKeyword([
      'T SHIRT',
      'TSHIRT',
      'TEE',
      'TOP',
      'CHEMISE',
      'BLOUSE',
      'POLO',
      'ROBE',
      'JUPE',
      'DEBARDEUR',
      'BODY',
    ])
  ) {
    return ['XXS', 'XS', 'S', 'M', 'L', 'XL'];
  }

  return ['XS', 'S', 'M', 'L', 'XL'];
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildVariantStock(
  product: RawProduct,
  couleur: string,
  taille: string,
  sizeIndex: number,
  sizeCount: number,
): number {
  if (sizeCount <= 1 || ['STD', 'TU', 'UNIQUE'].includes(taille.toUpperCase())) {
    return 4 + (hashString(`${product.id}-${couleur}-${taille}`) % 15);
  }

  const center = (sizeCount - 1) / 2;
  const distance = Math.abs(sizeIndex - center);

  let min = 1;
  let max = 5;
  if (distance < 0.75) {
    min = 8;
    max = 16;
  } else if (distance < 1.5) {
    min = 4;
    max = 10;
  }

  const hash = hashString(`${product.id}-${couleur}-${taille}`);
  let stock = min + (hash % (max - min + 1));

  if (distance >= 2 && hash % 5 === 0) {
    stock = 0;
  }

  return stock;
}

function computeEan13CheckDigit(base12: string): string {
  const sum = base12
    .split('')
    .map((char) => Number.parseInt(char, 10))
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);

  return String((10 - (sum % 10)) % 10);
}

function generateVariantEan13(productId: number | string, colorIndex: number, sizeIndex: number): string {
  const productPart = normalizeString(productId).replace(/\D/g, '').padStart(5, '0').slice(-5);
  const colorPart = String(colorIndex).padStart(2, '0').slice(-2);
  const sizePart = String(sizeIndex).padStart(2, '0').slice(-2);
  const base12 = `619${productPart}${colorPart}${sizePart}`;
  return `${base12}${computeEan13CheckDigit(base12)}`;
}

function variantSignature(couleur?: string | null, taille?: string | null): string {
  return `${normalizeKeywordText(couleur || 'UNIQUE')}__${normalizeKeywordText(taille || 'STD')}`;
}

function buildVariantSku(productSku: string, couleur: string, taille: string): string {
  const colorSlug = slugify(couleur || 'unique').toUpperCase() || 'UNIQUE';
  const sizeSlug = slugify(taille || 'std').toUpperCase() || 'STD';
  return `${productSku}-${colorSlug}-${sizeSlug}`.slice(0, 100);
}

function buildVariants(product: RawProduct): Array<{ couleur: string; taille: string; stock: number }> {
  const fromDeclinaisons = Array.isArray(product.declinaisons) ? product.declinaisons : [];
  if (fromDeclinaisons.length > 0) {
    const explicitSizeDeclinaisons = fromDeclinaisons.filter(
      (item) => typeof item !== 'string' && normalizeString(item?.taille || item?.size),
    );

    if (explicitSizeDeclinaisons.length > 0) {
      const sizeOrder = uniqueValues(
        explicitSizeDeclinaisons.map((item) =>
          typeof item === 'string' ? item : item?.taille || item?.size,
        ),
      );

      return explicitSizeDeclinaisons.map((item) => {
        const couleur = normalizeString(
          typeof item === 'string' ? item : item?.couleur || item?.color,
          'UNIQUE',
        ) || 'UNIQUE';
        const taille = normalizeString(
          typeof item === 'string' ? item : item?.taille || item?.size,
          'STD',
        ) || 'STD';
        const sizeIndex = Math.max(0, sizeOrder.indexOf(taille));
        const stock = Math.max(
          0,
          Math.trunc(
            normalizePrice(
              typeof item === 'string' ? null : item?.stock,
              buildVariantStock(product, couleur, taille, sizeIndex, sizeOrder.length || 1),
            ),
          ),
        );

        return {
          couleur,
          taille,
          stock,
        };
      });
    }

    const colors = uniqueValues(
      fromDeclinaisons.map((item) =>
        typeof item === 'string' ? item : item?.couleur || item?.color,
      ),
    );
    const safeColors = colors.length ? colors : ['UNIQUE'];
    const logicalSizes = inferLogicalSizes(product);

    return safeColors.flatMap((couleur) =>
      logicalSizes.map((taille, sizeIndex) => ({
        couleur,
        taille,
        stock: buildVariantStock(product, couleur, taille, sizeIndex, logicalSizes.length),
      })),
    );
  }

  const colors = uniqueValues(
    (product.couleurs || product.colors || []).map((item) =>
      typeof item === 'string' ? item : item?.name,
    ),
  );
  const sizes = inferLogicalSizes(product);

  const safeColors = colors.length ? colors : ['UNIQUE'];
  const safeSizes = sizes.length ? sizes : ['STD'];

  return safeColors.flatMap((couleur) =>
    safeSizes.map((taille, sizeIndex) => ({
      couleur,
      taille,
      stock: buildVariantStock(product, couleur, taille, sizeIndex, safeSizes.length),
    })),
  );
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function pickMany<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

function daysAgo(days: number): Date {
  const now = new Date();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function randomPastDate(minDaysAgo: number, maxDaysAgo: number): Date {
  return daysAgo(randomInt(minDaysAgo, maxDaysAgo));
}

function buildOrderReference(index: number): string {
  return `ORD-2026-${String(index).padStart(6, '0')}`;
}

async function upsertUser(
  userRepo: Repository<User>,
  email: string,
  password: string,
  data: Partial<User>,
) {
  const existingUser = await userRepo.findOne({ where: { email } });
  const password_hash = await bcrypt.hash(password, 10);

  return userRepo.save(
    userRepo.create({
      ...existingUser,
      ...data,
      email,
      password_hash,
      is_active: true,
      is_verified: true,
    }),
  );
}

async function seedUsers(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);

  for (const staff of STAFF_PROFILES) {
    const password = staff.email === 'admin@barsha.com.tn' ? ADMIN_PASSWORD : STAFF_PASSWORD;
    await upsertUser(userRepo, staff.email, password, {
      first_name: staff.first_name,
      last_name: staff.last_name,
      phone: staff.phone,
      role: staff.role,
    });
  }

  for (const profile of CUSTOMER_PROFILES) {
    const password = profile.email === 'demo@barsha.com.tn' ? DEMO_PASSWORD : CUSTOMER_PASSWORD;
    await upsertUser(userRepo, profile.email, password, {
      first_name: profile.first_name,
      last_name: profile.last_name,
      phone: profile.phone,
      gender: profile.gender,
      role: UserRole.CUSTOMER,
    });
  }

  console.log(`Seeded realistic users (${STAFF_PROFILES.length} staff, ${CUSTOMER_PROFILES.length} customers)`);
}

async function seedCategories(dataSource: DataSource) {
  const categoryRepo = dataSource.getRepository(Category);
  if ((await categoryRepo.count()) > 0) {
    return;
  }

  const categories = [
    {
      name: 'Femme',
      slug: 'femme',
      position: 1,
      isActive: true,
      isFeatured: true,
      description: 'Collection Femme',
    },
    {
      name: 'Homme',
      slug: 'homme',
      position: 2,
      isActive: true,
      isFeatured: true,
      description: 'Collection Homme',
    },
    {
      name: 'Enfant',
      slug: 'enfant',
      position: 3,
      isActive: true,
      isFeatured: true,
      description: 'Collection Enfant',
    },
    {
      name: 'Accessoires',
      slug: 'accessoires',
      position: 4,
      isActive: true,
      isFeatured: true,
      description: 'Accessoires',
    },
    {
      name: 'Nouveautes',
      slug: 'nouveautes',
      position: 5,
      isActive: true,
      isFeatured: true,
      description: 'Nouveautes',
    },
    {
      name: 'Soldes',
      slug: 'soldes',
      position: 6,
      isActive: true,
      isFeatured: true,
      description: 'Articles en promotion',
    },
  ];

  await categoryRepo.save(categories.map((item) => categoryRepo.create(item)));
  console.log(`Seeded ${categories.length} categories`);
}

async function seedProducts(dataSource: DataSource) {
  const productRepo = dataSource.getRepository(Product);
  const variantRepo = dataSource.getRepository(ProductVariant);
  const categoryRepo = dataSource.getRepository(Category);

  const productsPath = path.resolve(process.cwd(), 'data/barsha_products.json');
  if (!fs.existsSync(productsPath)) {
    console.log('Products JSON not found, skipping product seed');
    return;
  }

  const rawProducts = JSON.parse(fs.readFileSync(productsPath, 'utf-8')) as RawProduct[];
  const categories = await categoryRepo.find();
  const categoriesBySlug = new Map(categories.map((category) => [category.slug, category]));

  let insertedCount = 0;

  for (const rawProduct of rawProducts) {
    const externalId = normalizeString(rawProduct.id);
    if (!externalId) {
      continue;
    }

    const existingProduct = await productRepo.findOne({
      where: { externalId },
    });

    if (existingProduct) {
      const variants = buildVariants(rawProduct);
      const existingVariants = await variantRepo.find({
        where: { productId: existingProduct.id },
        order: { position: 'ASC' },
      });
      const availableVariants = [...existingVariants];
      let position = 0;

      for (let index = 0; index < variants.length; index++) {
        const variant = variants[index];
        const sameSignatureIndex = availableVariants.findIndex(
          (item) => variantSignature(item.couleur, item.taille) === variantSignature(variant.couleur, variant.taille),
        );
        const sameColorLegacyIndex =
          sameSignatureIndex === -1
            ? availableVariants.findIndex(
                (item) =>
                  normalizeKeywordText(item.couleur || 'UNIQUE') === normalizeKeywordText(variant.couleur || 'UNIQUE') &&
                  ['TU', 'STD', 'UNIQUE', ''].includes(normalizeKeywordText(item.taille || '')),
              )
            : -1;

        const matchedIndex = sameSignatureIndex !== -1 ? sameSignatureIndex : sameColorLegacyIndex;
        const matchedVariant = matchedIndex !== -1 ? availableVariants.splice(matchedIndex, 1)[0] : null;

        const payload = {
          productId: existingProduct.id,
          sku: buildVariantSku(existingProduct.sku || `BSH-${externalId}`, variant.couleur || 'UNIQUE', variant.taille || 'STD'),
          couleur: variant.couleur || 'UNIQUE',
          taille: variant.taille || 'STD',
          stock: variant.stock,
          priceAdjust: matchedVariant?.priceAdjust ?? 0,
          position: position++,
          ean13: generateVariantEan13(existingProduct.id, index, 0),
        };

        if (matchedVariant) {
          await variantRepo.save(
            variantRepo.create({
              ...matchedVariant,
              ...payload,
              ean13: matchedVariant.ean13 || payload.ean13,
            }),
          );
        } else {
          await variantRepo.save(variantRepo.create(payload));
        }
      }

      for (let index = 0; index < availableVariants.length; index++) {
        const leftoverVariant = availableVariants[index];
        const fallbackColor = leftoverVariant.couleur || 'UNIQUE';
        const fallbackSize = leftoverVariant.taille || 'STD';

        leftoverVariant.sku =
          leftoverVariant.sku || buildVariantSku(existingProduct.sku || `BSH-${externalId}`, fallbackColor, fallbackSize);
        leftoverVariant.couleur = fallbackColor;
        leftoverVariant.taille = fallbackSize;
        leftoverVariant.ean13 =
          leftoverVariant.ean13 || generateVariantEan13(existingProduct.id, variants.length + index, 0);

        await variantRepo.save(leftoverVariant);
      }

      existingProduct.totalStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
      await productRepo.save(existingProduct);

      continue;
    }

    const title = normalizeString(rawProduct.nom || rawProduct.name, `Produit ${externalId}`);
    const basePrice = normalizePrice(rawProduct.prix ?? rawProduct.price, 0);
    const promoPrice = normalizePrice(rawProduct.prix_promo ?? rawProduct.currentPrice, basePrice);
    const currentPrice = promoPrice > 0 ? promoPrice : basePrice;
    const discount =
      basePrice > 0 && currentPrice < basePrice
        ? Math.round((1 - currentPrice / basePrice) * 100)
        : 0;
    const variants = buildVariants(rawProduct);
    const totalStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
    const defaultCategory = inferCategorySlug(rawProduct);

    const product = productRepo.create({
      sku: normalizeString(rawProduct.reference, `BSH-${externalId}`),
      title,
      slug: `${slugify(title)}-${externalId}`.slice(0, 255),
      description: normalizeString(rawProduct.description, ''),
      price: basePrice,
      currentPrice,
      discount,
      famille: toFamille(rawProduct.genre || rawProduct.famille),
      totalStock,
      isActive: true,
      isFeatured: insertedCount < 16,
      isBestseller: insertedCount < 10,
      isNew: insertedCount < 20,
      firstImageUrl: normalizeString(rawProduct.image || rawProduct.firstImg, ''),
      secondImageUrl: normalizeString(rawProduct.secondImg, ''),
      externalId,
      composition: normalizeString(rawProduct.composition, ''),
      brand: 'Barsha',
      viewCount: randomInt(5, 220),
      orderCount: randomInt(0, 80),
      tags: pickMany(['office', 'casual', 'chic', 'summer', 'new', 'barsha'], 3),
      categories: defaultCategory ? [categoriesBySlug.get(defaultCategory)].filter(Boolean) : [],
    });

    const savedProduct = await productRepo.save(product);

    let position = 0;
    for (let index = 0; index < variants.length; index++) {
      const variant = variants[index];
      await variantRepo.save(
        variantRepo.create({
          productId: savedProduct.id,
          sku: buildVariantSku(savedProduct.sku || `BSH-${externalId}`, variant.couleur || 'UNIQUE', variant.taille || 'STD'),
          couleur: variant.couleur || 'UNIQUE',
          taille: variant.taille || 'STD',
          stock: variant.stock,
          priceAdjust: 0,
          position: position++,
          ean13: generateVariantEan13(savedProduct.id, index, 0),
        }),
      );
    }

    insertedCount++;
  }

  console.log(`Seeded ${insertedCount} products with variants`);
}

async function seedFaqs(dataSource: DataSource) {
  const faqRepo = dataSource.getRepository(FAQ);
  if ((await faqRepo.count()) > 0) {
    return;
  }

  const faqs = [
    {
      category_slug: 'livraison',
      category_name: 'Livraison',
      question: 'Quels sont les delais de livraison ?',
      answer: 'La livraison standard prend 3 a 5 jours ouvrables en Tunisie.',
      position: 1,
      is_active: true,
      is_featured: true,
      helpful_count: 0,
      not_helpful_count: 0,
    },
    {
      category_slug: 'livraison',
      category_name: 'Livraison',
      question: 'Quels sont les frais de livraison ?',
      answer: 'La livraison est gratuite au-dessus de 150 TND. Sinon 7 TND.',
      position: 2,
      is_active: true,
      is_featured: true,
      helpful_count: 0,
      not_helpful_count: 0,
    },
    {
      category_slug: 'retours',
      category_name: 'Retours',
      question: 'Quelle est la politique de retour ?',
      answer: 'Le retour est possible sous 14 jours selon les conditions du site.',
      position: 3,
      is_active: true,
      is_featured: true,
      helpful_count: 0,
      not_helpful_count: 0,
    },
    {
      category_slug: 'paiement',
      category_name: 'Paiement',
      question: 'Quels moyens de paiement sont acceptes ?',
      answer: 'Le site accepte les cartes, le paiement a la livraison et les cartes cadeaux.',
      position: 4,
      is_active: true,
      is_featured: true,
      helpful_count: 0,
      not_helpful_count: 0,
    },
    {
      category_slug: 'compte',
      category_name: 'Mon Compte',
      question: 'Comment creer un compte ?',
      answer: 'Cliquez sur Inscription puis remplissez le formulaire de creation de compte.',
      position: 5,
      is_active: true,
      is_featured: false,
      helpful_count: 0,
      not_helpful_count: 0,
    },
  ];

  await faqRepo.save(faqs.map((item) => faqRepo.create(item)));
  console.log('FAQs seeded');
}

async function seedCoupons(dataSource: DataSource) {
  const couponRepo = dataSource.getRepository(Coupon);
  const existingCodes = new Set((await couponRepo.find()).map((coupon) => coupon.code));
  const coupons = [
    {
      code: 'WELCOME10',
      description: '10% de reduction pour les nouveaux clients',
      discount_type: CouponDiscountType.PERCENTAGE,
      discount_value: 10,
      min_purchase: 50,
      max_discount: 30,
      usage_limit: 1000,
      usage_count: 0,
      per_user_limit: 1,
      is_active: true,
      applies_to: CouponAppliesTo.ALL,
    },
    {
      code: 'BARSHA20',
      description: '20% de reduction speciale',
      discount_type: CouponDiscountType.PERCENTAGE,
      discount_value: 20,
      min_purchase: 100,
      max_discount: 50,
      usage_limit: 500,
      usage_count: 0,
      per_user_limit: 1,
      is_active: true,
      applies_to: CouponAppliesTo.ALL,
    },
    {
      code: 'SPRING15',
      description: 'Offre saisonniere printemps',
      discount_type: CouponDiscountType.PERCENTAGE,
      discount_value: 15,
      min_purchase: 120,
      max_discount: 40,
      usage_limit: 300,
      usage_count: 0,
      per_user_limit: 1,
      is_active: true,
      applies_to: CouponAppliesTo.ALL,
    },
  ];

  const toCreate = coupons.filter((coupon) => !existingCodes.has(coupon.code));
  if (toCreate.length > 0) {
    await couponRepo.save(toCreate.map((item) => couponRepo.create(item)));
    console.log(`Coupons seeded (${toCreate.length})`);
  }
}

async function seedBanners(dataSource: DataSource) {
  const bannerRepo = dataSource.getRepository(Banner);
  if ((await bannerRepo.count()) > 0) {
    return;
  }

  const banners = [
    {
      title: 'Collection Ete 2026',
      subtitle: 'Decouvrez les nouveautes',
      image_url: 'https://images.zen.com.tn/barsha/Plan_de_travail_1_copie_100_ce5184b57e.jpg',
      link_url: '/tn/1-femme',
      position: 'home-hero-1',
      sort_order: 1,
      is_active: true,
    },
    {
      title: 'Soldes -50%',
      subtitle: 'Sur une selection d articles',
      image_url: 'https://images.zen.com.tn/barsha/Plan_de_travail_1_copie_2_100_1aef92deda.jpg',
      link_url: '/tn/14-promotion-femme',
      position: 'home-hero-2',
      sort_order: 2,
      is_active: true,
    },
    {
      title: 'Nouveautes Homme',
      subtitle: 'Looks urbains et essentiels du moment',
      image_url: 'https://images.zen.com.tn/barsha/Plan_de_travail_1_copie_100_ce5184b57e.jpg',
      link_url: '/tn/2-homme',
      position: 'home-strip-1',
      sort_order: 3,
      is_active: true,
    },
  ];

  await bannerRepo.save(banners.map((item) => bannerRepo.create(item)));
  console.log('Banners seeded');
}

async function seedPromotions(dataSource: DataSource) {
  const promotionRepo = dataSource.getRepository(Promotion);
  const categoryRepo = dataSource.getRepository(Category);
  const productRepo = dataSource.getRepository(Product);

  if ((await promotionRepo.count()) >= 3) {
    return;
  }

  const categories = await categoryRepo.find();
  const products = await productRepo.find({ take: 12 });
  const women = categories.find((category) => category.slug === 'femme');
  const men = categories.find((category) => category.slug === 'homme');

  const promotions = [
    {
      name: 'Soldes Ete 2026',
      description: 'Jusqu a -40% sur une selection femme',
      type: PromotionType.FLASH_SALE,
      discount_type: DiscountType.PERCENTAGE,
      discount_value: 40,
      is_active: true,
      priority: 1,
      valid_from: daysAgo(10),
      valid_to: daysAgo(-30),
      category_ids: women ? [women.id] : null,
      banner_image_url: 'https://images.zen.com.tn/barsha/Plan_de_travail_1_copie_100_ce5184b57e.jpg',
      min_purchase: 120,
      max_discount: 90,
    },
    {
      name: 'Weekend Homme',
      description: 'Selection casual homme a prix reduit',
      type: PromotionType.SEASONAL,
      discount_type: DiscountType.PERCENTAGE,
      discount_value: 20,
      is_active: true,
      priority: 2,
      valid_from: daysAgo(5),
      valid_to: daysAgo(-12),
      category_ids: men ? [men.id] : null,
      product_ids: products.slice(0, 6).map((product) => product.id),
      min_purchase: 90,
      max_discount: 60,
    },
    {
      name: 'Clearance Dernieres Tailles',
      description: 'Dernieres tailles sur plusieurs references iconiques',
      type: PromotionType.CLEARANCE,
      discount_type: DiscountType.FIXED,
      discount_value: 15,
      is_active: true,
      priority: 3,
      valid_from: daysAgo(20),
      valid_to: daysAgo(-20),
      product_ids: products.slice(6, 12).map((product) => product.id),
      min_purchase: 70,
      max_discount: 45,
    },
  ];

  for (const promotion of promotions) {
    const existing = await promotionRepo.findOne({ where: { name: promotion.name } });
    if (!existing) {
      await promotionRepo.save(promotionRepo.create(promotion));
    }
  }

  console.log('Promotions seeded');
}

async function seedAddresses(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const addressRepo = dataSource.getRepository(Address);
  const users = await userRepo.find();

  for (const user of users) {
    const existing = await addressRepo.find({ where: { user_id: user.id } });
    const targetCount =
      user.email === 'demo@barsha.com.tn' ? 2 : user.role === UserRole.CUSTOMER ? 1 : 1;

    for (let index = existing.length; index < targetCount; index++) {
      const cityInfo = pickOne(CITY_DATA);
      const street = pickOne(cityInfo.streets);
      await addressRepo.save(
        addressRepo.create({
          user_id: user.id,
          label: index === 0 ? 'Domicile' : 'Bureau',
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone,
          street: `${randomInt(3, 120)} ${street}`,
          city: cityInfo.city,
          state: cityInfo.city,
          postal_code: cityInfo.postal,
          country: 'TN',
          is_default: index === 0,
          is_billing: true,
          is_shipping: true,
        }),
      );
    }
  }

  console.log('Addresses seeded');
}

async function seedOrdersAndCommerce(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const addressRepo = dataSource.getRepository(Address);
  const productRepo = dataSource.getRepository(Product);
  const variantRepo = dataSource.getRepository(ProductVariant);
  const couponRepo = dataSource.getRepository(Coupon);
  const couponUsageRepo = dataSource.getRepository(CouponUsage);
  const orderRepo = dataSource.getRepository(Order);
  const orderItemRepo = dataSource.getRepository(OrderItem);
  const orderHistoryRepo = dataSource.getRepository(OrderStatusHistory);
  const paymentRepo = dataSource.getRepository(Payment);
  const paymentLogRepo = dataSource.getRepository(PaymentLog);

  const targetOrders = 36;
  const currentOrders = await orderRepo.count();
  if (currentOrders >= targetOrders) {
    console.log(`Orders already populated (${currentOrders})`);
    return;
  }

  const customers = await userRepo.find({ where: { role: UserRole.CUSTOMER } });
  const products = await productRepo.find();
  const variants = await variantRepo.find();
  const coupons = await couponRepo.find({ where: { is_active: true } });
  const addresses = await addressRepo.find();
  const variantMap = new Map<number, ProductVariant[]>();

  for (const variant of variants) {
    const productVariants = variantMap.get(variant.productId) || [];
    productVariants.push(variant);
    variantMap.set(variant.productId, productVariants);
  }

  let sequence = currentOrders + 1;

  while (sequence <= targetOrders) {
    const customer =
      sequence % 5 === 0
        ? customers.find((user) => user.email === 'demo@barsha.com.tn') || pickOne(customers)
        : pickOne(customers);
    const customerAddresses = addresses.filter((address) => address.user_id === customer.id);
    const shippingAddress = customerAddresses[0];
    const billingAddress = customerAddresses[customerAddresses.length - 1] || shippingAddress;
    const createdAt = randomPastDate(4, 110);
    const statuses = [
      OrderStatus.DELIVERED,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.SHIPPED,
      OrderStatus.PROCESSING,
      OrderStatus.CONFIRMED,
      OrderStatus.CANCELLED,
      OrderStatus.PAYMENT_PENDING,
    ];
    const status = pickOne(statuses);
    const itemProducts = pickMany(products, randomInt(1, 4));

    let subtotal = 0;
    const itemPayloads = itemProducts.map((product) => {
      const quantity = randomInt(1, 3);
      const unitPrice = Number(product.currentPrice || product.price || 0);
      subtotal += unitPrice * quantity;

      const variant = pickOne(variantMap.get(product.id) || [
        {
          couleur: 'UNIQUE',
          taille: 'TU',
          sku: product.sku || `BSH-${product.id}`,
        } as ProductVariant,
      ]);

      return {
        product,
        quantity,
        unitPrice,
        variant,
      };
    });

    const selectedCoupon = subtotal > 120 && Math.random() > 0.65 ? pickOne(coupons) : null;
    const discountAmount = selectedCoupon
      ? selectedCoupon.discount_type === CouponDiscountType.PERCENTAGE
        ? Math.min(subtotal * (Number(selectedCoupon.discount_value) / 100), Number(selectedCoupon.max_discount || 99999))
        : Number(selectedCoupon.discount_value)
      : 0;
    const shippingAmount = subtotal >= 150 ? 0 : 7;
    const totalAmount = subtotal - discountAmount + shippingAmount;
    const isCancelled = status === OrderStatus.CANCELLED;
    const isDelivered = [OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(status);
    const isShipped = [OrderStatus.SHIPPED, OrderStatus.IN_TRANSIT, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(status);

    const order = await orderRepo.save(
      orderRepo.create({
        reference: buildOrderReference(sequence),
        user_id: customer.id,
        status,
        payment_status:
          isCancelled && Math.random() > 0.5
            ? PaymentStatus.FAILED
            : isDelivered || isShipped || status === OrderStatus.CONFIRMED || status === OrderStatus.PROCESSING
              ? PaymentStatus.PAID
              : PaymentStatus.PENDING,
        subtotal: Number(subtotal.toFixed(3)),
        discount_amount: Number(discountAmount.toFixed(3)),
        shipping_amount: Number(shippingAmount.toFixed(3)),
        tax_amount: 0,
        total_amount: Number(totalAmount.toFixed(3)),
        coupon_code: selectedCoupon?.code || null,
        coupon_id: selectedCoupon?.id || null,
        shipping_address: shippingAddress
          ? {
              firstName: shippingAddress.first_name,
              lastName: shippingAddress.last_name,
              street: shippingAddress.street,
              city: shippingAddress.city,
              postalCode: shippingAddress.postal_code,
              country: shippingAddress.country,
              phone: shippingAddress.phone,
            }
          : null,
        billing_address: billingAddress
          ? {
              firstName: billingAddress.first_name,
              lastName: billingAddress.last_name,
              street: billingAddress.street,
              city: billingAddress.city,
              postalCode: billingAddress.postal_code,
              country: billingAddress.country,
              phone: billingAddress.phone,
            }
          : null,
        shipping_method: 'standard',
        tracking_number: isShipped ? `TRK${sequence}${randomInt(1000, 9999)}` : null,
        customer_email: customer.email,
        customer_phone: customer.phone,
        payment_method: Math.random() > 0.45 ? PaymentMethodType.CTP : PaymentMethodType.COD,
        payment_reference: `PAY-${sequence}-${randomInt(1000, 9999)}`,
        ctp_transaction_id: Math.random() > 0.45 ? `CTP-${sequence}-${randomInt(10000, 99999)}` : null,
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0 (Seed Script)',
        source: sequence % 9 === 0 ? OrderSource.MOBILE : OrderSource.WEB,
        notes: sequence % 7 === 0 ? 'Client VIP - preparer un emballage cadeau.' : null,
        cancel_reason: isCancelled ? 'Annulation client avant expedition' : null,
        confirmed_at: status !== OrderStatus.PENDING && status !== OrderStatus.PAYMENT_PENDING ? new Date(createdAt.getTime() + 6 * 60 * 60 * 1000) : null,
        shipped_at: isShipped ? new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
        delivered_at: isDelivered ? new Date(createdAt.getTime() + 5 * 24 * 60 * 60 * 1000) : null,
        cancelled_at: isCancelled ? new Date(createdAt.getTime() + 12 * 60 * 60 * 1000) : null,
        created_at: createdAt,
        updated_at: createdAt,
      }),
    );

    for (const item of itemPayloads) {
      await orderItemRepo.save(
        orderItemRepo.create({
          order_id: order.id,
          product_id: item.product.id,
          sku: item.variant.sku || item.product.sku || `BSH-${item.product.id}`,
          title: item.product.title,
          unit_price: Number(item.unitPrice.toFixed(3)),
          quantity: item.quantity,
          discount_amount: 0,
          variant_info: {
            size: item.variant.taille || 'TU',
            color: item.variant.couleur || 'UNIQUE',
          },
          image_url: item.product.firstImageUrl || item.product.secondImageUrl || null,
        }),
      );

      await productRepo.increment({ id: item.product.id }, 'orderCount', item.quantity);
    }

    const statusTrail: Array<[string | null, string]> = [
      [null, OrderStatus.PENDING],
      [OrderStatus.PENDING, OrderStatus.CONFIRMED],
    ];
    if ([OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(status)) {
      statusTrail.push([OrderStatus.CONFIRMED, OrderStatus.PROCESSING]);
    }
    if ([OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(status)) {
      statusTrail.push([OrderStatus.PROCESSING, OrderStatus.SHIPPED]);
    }
    if ([OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(status)) {
      statusTrail.push([OrderStatus.SHIPPED, OrderStatus.DELIVERED]);
    }
    if (status === OrderStatus.COMPLETED) {
      statusTrail.push([OrderStatus.DELIVERED, OrderStatus.COMPLETED]);
    }
    if (status === OrderStatus.CANCELLED) {
      statusTrail.splice(1, statusTrail.length, [OrderStatus.PENDING, OrderStatus.CANCELLED]);
    }

    let historyMoment = createdAt.getTime();
    for (const [oldStatus, newStatus] of statusTrail) {
      historyMoment += 4 * 60 * 60 * 1000;
      await orderHistoryRepo.save(
        orderHistoryRepo.create({
          order_id: order.id,
          old_status: oldStatus,
          new_status: newStatus,
          reason: newStatus === OrderStatus.CANCELLED ? 'Demande client' : null,
          changed_by: 'system',
          timestamp: new Date(historyMoment),
        }),
      );
    }

    const paymentState =
      order.payment_status === PaymentStatus.PAID
        ? PaymentState.COMPLETED
        : order.payment_status === PaymentStatus.FAILED
          ? PaymentState.FAILED
          : PaymentState.PENDING;

    const payment = await paymentRepo.save(
      paymentRepo.create({
        order_id: order.id,
        reference: `PAYMENT-${order.reference}`,
        method: order.payment_method === PaymentMethodType.COD ? PaymentMethod.COD : PaymentMethod.CTP,
        state: paymentState,
        amount: order.total_amount,
        currency: 'TND',
        refunded_amount: 0,
        ctp_transaction_id: order.ctp_transaction_id,
        ctp_payment_id: order.payment_method === PaymentMethodType.CTP ? `CP-${sequence}-${randomInt(1000, 9999)}` : null,
        ctp_redirect_url: order.payment_method === PaymentMethodType.CTP ? `https://payment.barsha.test/${order.reference}` : null,
        gateway_response: {
          orderReference: order.reference,
          status: paymentState,
          source: 'seed',
        },
        attempt_count: 1,
        ip_address: order.ip_address,
        user_agent: order.user_agent,
        completed_at: paymentState === PaymentState.COMPLETED ? new Date(createdAt.getTime() + 7 * 60 * 60 * 1000) : null,
        failed_at: paymentState === PaymentState.FAILED ? new Date(createdAt.getTime() + 2 * 60 * 60 * 1000) : null,
        created_at: createdAt,
        updated_at: createdAt,
      }),
    );

    await paymentLogRepo.save(
      paymentLogRepo.create({
        payment_id: payment.id,
        event_type: paymentState === PaymentState.COMPLETED ? 'payment_completed' : 'payment_created',
        status_before: 'INITIATED',
        status_after: paymentState,
        response_code: paymentState === PaymentState.COMPLETED ? '200' : paymentState === PaymentState.FAILED ? '402' : '102',
        response_message: paymentState === PaymentState.COMPLETED ? 'Payment completed' : paymentState === PaymentState.FAILED ? 'Payment failed' : 'Payment pending',
        timestamp: new Date(createdAt.getTime() + 8 * 60 * 60 * 1000),
      }),
    );

    if (selectedCoupon) {
      await couponUsageRepo.save(
        couponUsageRepo.create({
          coupon_id: selectedCoupon.id,
          user_id: customer.id,
          order_id: order.id,
          discount_amount: Number(discountAmount.toFixed(2)),
          used_at: createdAt,
        }),
      );
      await couponRepo.increment({ id: selectedCoupon.id }, 'usage_count', 1);
    }

    sequence++;
  }

  console.log(`Orders, items, payments and history seeded up to ${targetOrders} orders`);
}

async function seedSupportAndNotifications(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const productRepo = dataSource.getRepository(Product);
  const orderRepo = dataSource.getRepository(Order);
  const ticketRepo = dataSource.getRepository(SupportTicket);
  const messageRepo = dataSource.getRepository(TicketMessage);
  const notificationRepo = dataSource.getRepository(Notification);

  const adminUsers = await userRepo.find({ where: { role: In([UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT, UserRole.ADMIN]) } });
  const customers = await userRepo.find({ where: { role: UserRole.CUSTOMER } });
  const products = await productRepo.find({ take: 24 });
  const orders = await orderRepo.find({ take: 24 });
  const supportTarget = 16;
  const notificationTarget = 30;

  for (let index = await ticketRepo.count(); index < supportTarget; index++) {
    const customer = index % 4 === 0
      ? customers.find((user) => user.email === 'demo@barsha.com.tn') || pickOne(customers)
      : pickOne(customers);
    const assignedAdmin = pickOne(adminUsers);
    const linkedOrder = orders.length > 0 ? pickOne(orders.filter((order) => order.user_id === customer.id)) : null;
    const linkedProduct = pickOne(products);
    const status = pickOne([
      TicketStatus.OPEN,
      TicketStatus.IN_PROGRESS,
      TicketStatus.WAITING_CUSTOMER,
      TicketStatus.RESOLVED,
      TicketStatus.CLOSED,
    ]);
    const createdAt = randomPastDate(2, 80);

    const ticket = await ticketRepo.save(
      ticketRepo.create({
        user_id: customer.id,
        subject: pickOne(SUPPORT_SUBJECTS),
        description: 'Bonjour, j ai besoin d aide concernant ma derniere commande et le produit recu.',
        category: pickOne([
          TicketCategory.ORDER,
          TicketCategory.SHIPPING,
          TicketCategory.RETURN,
          TicketCategory.PRODUCT,
          TicketCategory.PAYMENT,
        ]),
        priority: pickOne([
          TicketPriority.LOW,
          TicketPriority.MEDIUM,
          TicketPriority.MEDIUM,
          TicketPriority.HIGH,
        ]),
        status,
        assigned_to: status === TicketStatus.OPEN ? null : assignedAdmin.id,
        contact_email: customer.email,
        contact_phone: customer.phone,
        contact_name: `${customer.first_name} ${customer.last_name}`,
        order_id: linkedOrder?.id || null,
        product_id: linkedProduct?.id || null,
        resolved_at: [TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(status) ? new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
        closed_at: status === TicketStatus.CLOSED ? new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000) : null,
        created_at: createdAt,
        updated_at: createdAt,
      }),
    );

    await messageRepo.save(
      messageRepo.create({
        ticket_id: ticket.id,
        sender_id: customer.id,
        sender_type: SenderType.CUSTOMER,
        message: 'Bonjour, pouvez-vous verifier le statut et me confirmer la suite ?',
        is_internal: false,
        created_at: createdAt,
      }),
    );

    if (status !== TicketStatus.OPEN) {
      await messageRepo.save(
        messageRepo.create({
          ticket_id: ticket.id,
          sender_id: assignedAdmin.id,
          sender_type: SenderType.AGENT,
          message: 'Bonjour, votre demande est bien prise en charge. Nous revenons vers vous rapidement.',
          is_internal: false,
          created_at: new Date(createdAt.getTime() + 5 * 60 * 60 * 1000),
        }),
      );
    }
  }

  for (let index = await notificationRepo.count(); index < notificationTarget; index++) {
    const user = index % 5 === 0
      ? customers.find((customer) => customer.email === 'demo@barsha.com.tn') || pickOne(customers)
      : pickOne([...customers, ...adminUsers]);
    const template = pickOne(NOTIFICATION_MESSAGES);
    const createdAt = randomPastDate(1, 45);

    await notificationRepo.save(
      notificationRepo.create({
        user_id: user.id,
        type: template.type,
        title: template.title,
        message: template.message,
        data: { source: 'seed', email: user.email },
        is_read: Math.random() > 0.55,
        action_url:
          template.type === NotificationType.ORDER
            ? '/account/orders'
            : template.type === NotificationType.SUPPORT
              ? '/help/support'
              : '/promotions',
        created_at: createdAt,
      }),
    );
  }

  console.log('Support tickets, messages and notifications seeded');
}

async function seedReviewsAndQA(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const productRepo = dataSource.getRepository(Product);
  const reviewRepo = dataSource.getRepository(ProductReview);
  const qaRepo = dataSource.getRepository(ProductQA);
  const targetReviews = 44;
  const targetQuestions = 14;

  const customers = await userRepo.find({ where: { role: UserRole.CUSTOMER } });
  const admin = await userRepo.findOne({ where: { email: 'admin@barsha.com.tn' } });
  const products = await productRepo.find({ take: 48 });

  for (let index = await reviewRepo.count(); index < targetReviews; index++) {
    const customer = index % 6 === 0
      ? customers.find((user) => user.email === 'demo@barsha.com.tn') || pickOne(customers)
      : pickOne(customers);
    const product = pickOne(products);
    await reviewRepo.save(
      reviewRepo.create({
        product_id: product.id,
        user_id: customer.id,
        rating: randomInt(3, 5),
        title: pickOne(REVIEW_TITLES),
        comment: pickOne(REVIEW_COMMENTS),
        is_verified_purchase: true,
        is_approved: true,
        is_recommended: Math.random() > 0.2,
        fit_rating: pickOne([
          FitRating.TRUE_TO_SIZE,
          FitRating.TRUE_TO_SIZE,
          FitRating.SLIGHTLY_SMALL,
          FitRating.SLIGHTLY_LARGE,
        ]),
        images: null,
        helpful_count: randomInt(0, 12),
        not_helpful_count: randomInt(0, 2),
        created_at: randomPastDate(2, 70),
        updated_at: randomPastDate(1, 30),
      }),
    );
  }

  for (let index = await qaRepo.count(); index < targetQuestions; index++) {
    const customer = pickOne(customers);
    const product = pickOne(products);
    const answered = Math.random() > 0.3;
    const createdAt = randomPastDate(2, 55);

    await qaRepo.save(
      qaRepo.create({
        product_id: product.id,
        user_id: customer.id,
        question: pickOne(QA_QUESTIONS),
        answer: answered ? pickOne(QA_ANSWERS) : null,
        answered_by: answered && admin ? admin.id : null,
        is_published: true,
        helpful_count: randomInt(0, 8),
        created_at: createdAt,
        answered_at: answered ? new Date(createdAt.getTime() + 18 * 60 * 60 * 1000) : null,
      }),
    );
  }

  console.log('Reviews and product QA seeded');
}

async function seedLoyaltyAndCredits(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const accountRepo = dataSource.getRepository(LoyaltyAccount);
  const transactionRepo = dataSource.getRepository(LoyaltyTransaction);
  const giftCardRepo = dataSource.getRepository(GiftCard);
  const storeCreditRepo = dataSource.getRepository(StoreCredit);
  const customers = await userRepo.find({ where: { role: UserRole.CUSTOMER } });

  for (const customer of customers) {
    let account = await accountRepo.findOne({ where: { user_id: customer.id } });
    if (!account) {
      const lifetimePoints = customer.email === 'demo@barsha.com.tn' ? 2450 : randomInt(180, 6200);
      const availablePoints = Math.max(0, lifetimePoints - randomInt(0, Math.min(1200, lifetimePoints)));
      const tier =
        lifetimePoints >= 5000
          ? LoyaltyTier.GOLD
          : lifetimePoints >= 1000
            ? LoyaltyTier.SILVER
            : LoyaltyTier.BRONZE;

      account = await accountRepo.save(
        accountRepo.create({
          user_id: customer.id,
          total_points: availablePoints,
          available_points: availablePoints,
          lifetime_points: lifetimePoints,
          tier,
          tier_updated_at: randomPastDate(5, 90),
        }),
      );
    }

    const txCount = await transactionRepo.count({ where: { account_id: account.id } });
    for (let index = txCount; index < 3; index++) {
      await transactionRepo.save(
        transactionRepo.create({
          account_id: account.id,
          points: randomInt(40, 260),
          type: pickOne([TransactionType.EARN, TransactionType.EARN, TransactionType.BONUS]),
          description: index === 2 ? 'Bonus fidelite' : 'Achat en ligne',
          created_at: randomPastDate(2, 80),
        }),
      );
    }
  }

  const giftCardsTarget = 10;
  const currentGiftCards = await giftCardRepo.count();
  for (let index = currentGiftCards; index < giftCardsTarget; index++) {
    const sender = pickOne(customers);
    const amount = pickOne([25, 50, 75, 100, 150]);
    const fullyUnused = Math.random() > 0.35;
    const balance = fullyUnused ? amount : Number((amount * Math.random()).toFixed(2));
    const purchasedAt = randomPastDate(4, 85);
    await giftCardRepo.save(
      giftCardRepo.create({
        code: `GIFT-2026-${String(index + 1).padStart(4, '0')}-${randomInt(1000, 9999)}`,
        amount,
        balance,
        currency: 'TND',
        sender_id: sender.id,
        recipient_email: `recipient${index + 1}@example.com`,
        recipient_name: `Client ${index + 1}`,
        sender_name: `${sender.first_name} ${sender.last_name}`,
        message: 'Profitez de cette carte cadeau Barsha.',
        is_active: true,
        is_redeemed: balance < amount,
        purchased_at: purchasedAt,
        redeemed_at: balance < amount ? new Date(purchasedAt.getTime() + 8 * 24 * 60 * 60 * 1000) : null,
        redeemed_by: balance < amount ? pickOne(customers).id : null,
        expires_at: new Date(purchasedAt.getTime() + 365 * 24 * 60 * 60 * 1000),
        created_at: purchasedAt,
      }),
    );
  }

  for (const customer of customers.slice(0, 6)) {
    const existing = await storeCreditRepo.findOne({ where: { user_id: customer.id } });
    if (!existing) {
      await storeCreditRepo.save(
        storeCreditRepo.create({
          user_id: customer.id,
          balance: customer.email === 'demo@barsha.com.tn' ? 35 : randomInt(10, 80),
          currency: 'TND',
        }),
      );
    }
  }

  console.log('Loyalty, gift cards and store credits seeded');
}

async function seedWishlistAndCart(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const productRepo = dataSource.getRepository(Product);
  const variantRepo = dataSource.getRepository(ProductVariant);
  const collectionRepo = dataSource.getRepository(WishlistCollection);
  const wishlistRepo = dataSource.getRepository(WishlistItem);
  const cartRepo = dataSource.getRepository(CartItem);
  const customers = await userRepo.find({ where: { role: UserRole.CUSTOMER } });
  const products = await productRepo.find({ take: 36 });
  const variants = await variantRepo.find();
  const variantMap = new Map<number, ProductVariant[]>();

  for (const variant of variants) {
    const current = variantMap.get(variant.productId) || [];
    current.push(variant);
    variantMap.set(variant.productId, current);
  }

  for (const customer of customers.slice(0, 6)) {
    let collection = await collectionRepo.findOne({
      where: {
        user_id: customer.id,
        name: customer.email === 'demo@barsha.com.tn' ? 'Mes favoris' : 'Ma selection',
      },
    });

    if (!collection) {
      collection = await collectionRepo.save(
        collectionRepo.create({
          user_id: customer.id,
          name: customer.email === 'demo@barsha.com.tn' ? 'Mes favoris' : 'Ma selection',
          description: 'Collection seed pour navigation demo et espace client.',
          is_public: customer.email === 'demo@barsha.com.tn',
          share_token: `wishlist-${customer.id}-${slugify(customer.email)}`,
        }),
      );
    }

    const existingItems = await wishlistRepo.count({ where: { user_id: customer.id } });
    for (let index = existingItems; index < 3; index++) {
      const product = pickOne(products);
      const duplicate = await wishlistRepo.findOne({
        where: {
          user_id: customer.id,
          product_id: product.id,
        },
      });
      if (!duplicate) {
        await wishlistRepo.save(
          wishlistRepo.create({
            user_id: customer.id,
            product_id: product.id,
            collection_id: collection.id,
            notes: index === 0 ? 'A revoir pendant les promos.' : null,
            added_at: randomPastDate(1, 40),
          }),
        );
      }
    }
  }

  const cartOwners = customers.slice(0, 4);
  for (const customer of cartOwners) {
    const existingItems = await cartRepo.count({ where: { user_id: customer.id } });
    const targetItems = customer.email === 'demo@barsha.com.tn' ? 3 : 2;
    for (let index = existingItems; index < targetItems; index++) {
      const product = pickOne(products);
      const variant = pickOne(variantMap.get(product.id) || []);
      await cartRepo.save(
        cartRepo.create({
          user_id: customer.id,
          product_id: product.id,
          quantity: randomInt(1, 2),
          variant_info: variant
            ? { color: variant.couleur, size: variant.taille, sku: variant.sku }
            : null,
          added_at: randomPastDate(0, 14),
        }),
      );
    }
  }

  console.log('Wishlist collections, wishlist items and carts seeded');
}

async function seedReturnsAlertsReferrals(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const orderRepo = dataSource.getRepository(Order);
  const itemRepo = dataSource.getRepository(OrderItem);
  const productRepo = dataSource.getRepository(Product);
  const returnRepo = dataSource.getRepository(ReturnRequest);
  const alertRepo = dataSource.getRepository(ProductAlert);
  const stockAlertRepo = dataSource.getRepository(StockAlert);
  const referralRepo = dataSource.getRepository(Referral);
  const recommendationRepo = dataSource.getRepository(EditorialRecommendation);
  const customers = await userRepo.find({ where: { role: UserRole.CUSTOMER } });
  const deliveredOrders = await orderRepo.find({
    where: { status: In([OrderStatus.DELIVERED, OrderStatus.COMPLETED]) },
  });
  const products = await productRepo.find({ take: 24 });

  const returnTarget = 6;
  for (let index = await returnRepo.count(); index < Math.min(returnTarget, deliveredOrders.length); index++) {
    const order = deliveredOrders[index];
    const items = await itemRepo.find({ where: { order_id: order.id } });
    await returnRepo.save(
      returnRepo.create({
        order_id: order.id,
        user_id: order.user_id,
        status: pickOne([ReturnStatus.PENDING, ReturnStatus.APPROVED, ReturnStatus.REJECTED]),
        reason: 'Taille incorrecte',
        description: 'Le produit ne correspond pas exactement a la taille attendue.',
        items: items.slice(0, 2).map((item) => ({
          orderItemId: item.id,
          productId: item.product_id,
          quantity: 1,
          title: item.title,
        })),
        photos: [],
        return_address: order.shipping_address,
        refund_amount: Number((Number(order.total_amount) * 0.6).toFixed(3)),
        refund_method: 'store_credit',
        admin_notes: 'Controle qualite a la reception du retour.',
        created_at: randomPastDate(1, 35),
        updated_at: randomPastDate(0, 14),
        resolved_at: Math.random() > 0.5 ? randomPastDate(0, 7) : null,
      }),
    );
  }

  const alertTarget = 10;
  for (let index = await alertRepo.count(); index < alertTarget; index++) {
    const customer = pickOne(customers);
    const product = pickOne(products);
    const targetPrice = Number(Math.max(10, Number(product.currentPrice) - randomInt(5, 25)).toFixed(2));
    await alertRepo.save(
      alertRepo.create({
        user_id: customer.id,
        product_id: product.id,
        alert_type: pickOne([AlertType.PRICE_DROP, AlertType.BACK_IN_STOCK]),
        email: customer.email,
        target_price: targetPrice,
        current_price: Number(product.currentPrice || product.price || 0),
        is_triggered: Math.random() > 0.8,
        triggered_at: Math.random() > 0.8 ? randomPastDate(0, 15) : null,
        created_at: randomPastDate(1, 45),
      }),
    );
  }

  const stockAlertTarget = 6;
  for (let index = await stockAlertRepo.count(); index < stockAlertTarget; index++) {
    const customer = pickOne(customers);
    const product = pickOne(products);
    await stockAlertRepo.save(
      stockAlertRepo.create({
        user_id: customer.id,
        product_id: product.id,
        email: customer.email,
        size: pickOne(['S', 'M', 'L']),
        color: pickOne(['NOIR', 'BLANC', 'BEIGE']),
        product_name: product.title,
        product_image: product.firstImageUrl || null,
        product_price: Number(product.currentPrice || product.price || 0),
        is_notified: Math.random() > 0.7,
        notified_at: Math.random() > 0.7 ? randomPastDate(0, 10) : null,
        created_at: randomPastDate(1, 50),
      }),
    );
  }

  const referralTarget = 8;
  for (let index = await referralRepo.count(); index < referralTarget; index++) {
    const referrer = pickOne(customers);
    const referred = pickOne(customers.filter((customer) => customer.id !== referrer.id));
    await referralRepo.save(
      referralRepo.create({
        referrer_id: referrer.id,
        referral_code: `REF-${slugify(referrer.email).slice(0, 10)}-${index + 1}`,
        referred_user_id: Math.random() > 0.45 ? referred.id : null,
        referred_email: Math.random() > 0.45 ? referred.email : `lead${index + 1}@example.com`,
        status: pickOne([
          ReferralStatus.PENDING,
          ReferralStatus.SIGNED_UP,
          ReferralStatus.FIRST_PURCHASE,
          ReferralStatus.COMPLETED,
        ]),
        reward_type: pickOne([RewardType.POINTS, RewardType.CREDIT]),
        reward_amount: pickOne([10, 15, 20, 500]),
        referrer_reward_amount: pickOne([10, 15, 20, 500]),
        is_reward_claimed: Math.random() > 0.6,
        created_at: randomPastDate(3, 70),
        completed_at: Math.random() > 0.65 ? randomPastDate(0, 20) : null,
        expires_at: daysAgo(-60),
      }),
    );
  }

  const recommendationTarget = 5;
  for (let index = await recommendationRepo.count(); index < recommendationTarget; index++) {
    await recommendationRepo.save(
      recommendationRepo.create({
        title: pickOne([
          'Selection bureau',
          'Looks weekend',
          'Capsule ceremonie',
          'Essentiels de saison',
          'Must-have du moment',
        ]),
        description: 'Selection editoriale seedee pour enrichir les carrousels et la page d accueil.',
        productIds: pickMany(products, 4).map((product) => product.id),
        context: pickOne(['homepage', 'product_page', 'checkout']),
        isActive: true,
        position: index + 1,
        startDate: daysAgo(15),
        endDate: daysAgo(-45),
      }),
    );
  }

  console.log('Returns, alerts, referrals and editorial recommendations seeded');
}

async function seedAdminExperience(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const productRepo = dataSource.getRepository(Product);
  const adminLogRepo = dataSource.getRepository(AdminLog);
  const outfitRepo = dataSource.getRepository(Outfit);

  const admin = await userRepo.findOne({ where: { email: 'admin@barsha.com.tn' } });
  if (!admin) {
    return;
  }

  const products = await productRepo.find({ take: 24 });

  if ((await outfitRepo.count()) < 6) {
    const outfitSeeds = [
      { name: 'Look Bureau Chic', occasion: 'bureau', tags: ['office', 'elegant', 'smart'] },
      { name: 'Weekend Decontracte', occasion: 'casual', tags: ['casual', 'weekend', 'city'] },
      { name: 'Soiree Elegante', occasion: 'soiree', tags: ['night', 'elegant', 'occasion'] },
      { name: 'Capsule Minimaliste', occasion: 'daily', tags: ['minimal', 'daily', 'modern'] },
      { name: 'Essentiels Homme', occasion: 'work', tags: ['men', 'smart', 'basics'] },
      { name: 'Selection Demo', occasion: 'demo', tags: ['seed', 'showcase', 'editorial'] },
    ];

    for (const seed of outfitSeeds) {
      const existing = await outfitRepo.findOne({ where: { name: seed.name } });
      if (!existing) {
        const selected = pickMany(products, 3);
        const total = selected.reduce((sum, product) => sum + Number(product.currentPrice || product.price || 0), 0);
        await outfitRepo.save(
          outfitRepo.create({
            name: seed.name,
            description: 'Tenue seedee pour enrichir les pages inspiration et recommandations.',
            image_url: selected[0]?.firstImageUrl || null,
            style_tags: seed.tags,
            occasion: seed.occasion,
            products: selected.map((product) => product.id),
            total_price: Number(total.toFixed(2)),
            savings: Number((total * 0.12).toFixed(2)),
            is_published: true,
            created_by: admin.id,
            view_count: randomInt(20, 220),
            like_count: randomInt(4, 60),
            created_at: randomPastDate(3, 50),
            updated_at: randomPastDate(0, 15),
          }),
        );
      }
    }
  }

  const logTarget = 14;
  for (let index = await adminLogRepo.count(); index < logTarget; index++) {
    const product = pickOne(products);
    await adminLogRepo.save(
      adminLogRepo.create({
        admin_id: admin.id,
        action: pickOne([
          'UPDATE_PRODUCT',
          'CREATE_BANNER',
          'APPROVE_RETURN',
          'ANSWER_QA',
          'UPDATE_CUSTOMER',
          'CREATE_PROMOTION',
        ]),
        resource_type: pickOne(['product', 'banner', 'return', 'customer', 'promotion']),
        resource_id: String(product.id),
        old_values: { previousStatus: 'draft' },
        new_values: { currentStatus: 'published', title: product.title },
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0 (Seed Script Admin)',
        timestamp: randomPastDate(1, 35),
      }),
    );
  }

  console.log('Admin outfits and admin logs seeded');
}

async function seedNewsletter(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const newsletterRepo = dataSource.getRepository(NewsletterSubscriber);
  const customers = await userRepo.find({ where: { role: UserRole.CUSTOMER } });

  for (const customer of customers) {
    const existing = await newsletterRepo.findOne({ where: { email: customer.email } });
    if (!existing) {
      const subscribedAt = randomPastDate(2, 120);
      await newsletterRepo.save(
        newsletterRepo.create({
          email: customer.email,
          first_name: customer.first_name,
          preferences: {
            promotions: true,
            new_arrivals: true,
            style_tips: Math.random() > 0.3,
          },
          source: pickOne([
            SubscriptionSource.FOOTER,
            SubscriptionSource.ACCOUNT,
            SubscriptionSource.CHECKOUT,
          ]),
          is_confirmed: true,
          confirmation_token: `newsletter-${customer.id}-${slugify(customer.email)}`,
          subscribed_at: subscribedAt,
          confirmed_at: new Date(subscribedAt.getTime() + 2 * 60 * 60 * 1000),
          created_at: subscribedAt,
        }),
      );
    }
  }

  console.log('Newsletter subscribers seeded');
}

async function seedAdvancedAdminModules(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const addressRepo = dataSource.getRepository(Address);
  const productRepo = dataSource.getRepository(Product);
  const orderRepo = dataSource.getRepository(Order);
  const reviewRepo = dataSource.getRepository(ProductReview);
  const adminRepo = dataSource.getRepository(User);
  const warehouseRepo = dataSource.getRepository(Warehouse);
  const stockRepo = dataSource.getRepository(ProductStock);
  const fraudRepo = dataSource.getRepository(FraudSignal);
  const subscriptionRepo = dataSource.getRepository(Subscription);
  const subscriptionCycleRepo = dataSource.getRepository(SubscriptionCycle);
  const pricingRuleRepo = dataSource.getRepository(DynamicPriceRule);
  const pricingChangeRepo = dataSource.getRepository(DynamicPriceChange);
  const flagRepo = dataSource.getRepository(FeatureFlag);
  const flagEventRepo = dataSource.getRepository(FeatureFlagEvent);
  const sellerRepo = dataSource.getRepository(Seller);
  const payoutRepo = dataSource.getRepository(SellerPayout);
  const b2bAccountRepo = dataSource.getRepository(B2BAccount);
  const b2bQuoteRepo = dataSource.getRepository(B2BQuote);
  const dropRepo = dataSource.getRepository(ProductDrop);
  const reservationRepo = dataSource.getRepository(PreorderReservation);
  const configuratorRepo = dataSource.getRepository(Configurator);
  const slotRepo = dataSource.getRepository(ConfiguratorSlot);
  const lifecycleRepo = dataSource.getRepository(LifecycleSequence);
  const enrollmentRepo = dataSource.getRepository(LifecycleEnrollment);
  const supplierRepo = dataSource.getRepository(Supplier);
  const purchaseOrderRepo = dataSource.getRepository(PurchaseOrder);
  const productSupplierRepo = dataSource.getRepository(ProductSupplier);
  const cmsPageRepo = dataSource.getRepository(CmsPage);
  const cmsRevisionRepo = dataSource.getRepository(CmsRevision);
  const gdprRepo = dataSource.getRepository(GdprRequest);
  const fiscalRepo = dataSource.getRepository(FiscalReceipt);
  const eventRepo = dataSource.getRepository(DomainEvent);
  const tagRepo = dataSource.getRepository(CustomerTag);
  const noteRepo = dataSource.getRepository(CustomerNote);
  const taskRepo = dataSource.getRepository(AdminTask);
  const signalRepo = dataSource.getRepository(CustomerSignal);
  const dealRepo = dataSource.getRepository(DailyDeal);
  const slotDeliveryRepo = dataSource.getRepository(DeliverySlot);
  const pickupRepo = dataSource.getRepository(PickupLocation);
  const ugcRepo = dataSource.getRepository(UgcPost);
  const auditRepo = dataSource.getRepository(AuditDiff);

  const customers = await userRepo.find({ where: { role: UserRole.CUSTOMER } });
  const admin = await adminRepo.findOne({ where: { email: 'admin@barsha.com.tn' } });
  const addresses = await addressRepo.find();
  const products = await productRepo.find({ take: 40, order: { id: 'ASC' } });
  const orders = await orderRepo.find({ take: 20, order: { created_at: 'DESC' } });
  const reviews = await reviewRepo.find({ take: 12, order: { created_at: 'DESC' } });

  if (!admin || customers.length < 5 || products.length < 8) return;

  const addressByUser = new Map<number, Address>();
  for (const address of addresses) {
    if (!addressByUser.has(address.user_id)) addressByUser.set(address.user_id, address);
  }

  const warehouseSeeds = [
    { code: 'TUN', name: 'Entrepot Tunis Centre', city: 'Tunis', address: '12 Rue de Marseille, Tunis', phone: '+21670100100', priority: 1, is_default: true },
    { code: 'MAR', name: 'Hub La Marsa', city: 'La Marsa', address: '4 Rue de Tunis, La Marsa', phone: '+21671100200', priority: 2, is_default: false },
    { code: 'SFX', name: 'Depot Sfax Sud', city: 'Sfax', address: '21 Route de l Aeroport, Sfax', phone: '+21674100300', priority: 3, is_default: false },
  ];
  const warehouses: Warehouse[] = [];
  for (const seed of warehouseSeeds) {
    let warehouse = await warehouseRepo.findOne({ where: { code: seed.code } });
    if (!warehouse) {
      warehouse = await warehouseRepo.save(warehouseRepo.create({ ...seed, ships_orders: true, is_active: true }));
    }
    warehouses.push(warehouse);
  }

  for (const product of products.slice(0, 12)) {
    for (const [index, warehouse] of warehouses.entries()) {
      const existing = await stockRepo.findOne({ where: { product_id: product.id, warehouse_id: warehouse.id } });
      if (!existing) {
        const quantity = randomInt(4, 28) - index * 2;
        await stockRepo.save(stockRepo.create({
          product_id: product.id,
          warehouse_id: warehouse.id,
          quantity: Math.max(0, quantity),
          reserved: randomInt(0, 4),
          safety_stock: randomInt(2, 6),
        }));
      }
    }
  }

  for (const order of orders.slice(0, 6)) {
    const existing = await fraudRepo.findOne({ where: { order_id: order.id } });
    if (!existing) {
      const user = customers.find((customer) => customer.id === order.user_id) || pickOne(customers);
      const score = pickOne([22, 38, 54, 74, 81, 92]);
      const status =
        score >= 85 ? FraudStatus.HELD :
        score >= 70 ? FraudStatus.REVIEW :
        score >= 50 ? FraudStatus.APPROVED :
        FraudStatus.CLEAR;
      await fraudRepo.save(fraudRepo.create({
        order_id: order.id,
        user_id: user.id,
        score,
        status,
        rules_triggered: status === FraudStatus.CLEAR ? [] : pickMany([
          'HIGH_VALUE_NEW_USER',
          'VELOCITY_3_10MIN',
          'GEO_MISMATCH',
          'MULTI_ATTEMPT_CARD',
          'DEVICE_REPUTATION_LOW',
        ], 2),
        details: {
          customer: `${user.first_name} ${user.last_name}`,
          email: user.email,
          orderReference: order.reference,
          amount: Number(order.total_amount || 0),
        },
        reviewed_by: status === FraudStatus.APPROVED ? admin.id : null,
        reviewed_at: status === FraudStatus.APPROVED ? randomPastDate(0, 6) : null,
        review_note: status === FraudStatus.APPROVED ? 'Verification manuelle effectuee par l equipe risk.' : null,
      }));
    }
  }

  for (const [index, user] of customers.slice(0, 4).entries()) {
    const product = products[index];
    const existing = await subscriptionRepo.findOne({ where: { user_id: user.id, product_id: product.id } });
    if (!existing) {
      const address = addressByUser.get(user.id);
      const subscription = await subscriptionRepo.save(subscriptionRepo.create({
        user_id: user.id,
        product_id: product.id,
        quantity: pickOne([1, 1, 2]),
        frequency_days: pickOne([15, 30, 45]),
        discount_pct: pickOne([8, 10, 12]),
        status: pickOne([SubscriptionStatus.ACTIVE, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED, SubscriptionStatus.PAST_DUE]),
        next_charge_at: daysAgo(-randomInt(2, 20)),
        pause_until: null,
        shipping_address_id: address?.id || null,
        payment_method_id: null,
        total_cycles: randomInt(1, 6),
        failed_attempts: randomInt(0, 2),
        last_error: Math.random() > 0.7 ? 'Paiement refuse par l emetteur.' : null,
        cancelled_at: null,
        cancel_reason: null,
      }));

      for (let cycle = 1; cycle <= Math.max(subscription.total_cycles, 2); cycle++) {
        await subscriptionCycleRepo.save(subscriptionCycleRepo.create({
          subscription_id: subscription.id,
          cycle_number: cycle,
          order_id: cycle <= orders.length ? orders[cycle - 1].id : null,
          status: cycle === subscription.total_cycles && subscription.status === SubscriptionStatus.PAST_DUE ? 'FAILED' : 'SUCCESS',
          amount: Number(((Number(product.currentPrice || product.price || 0) * subscription.quantity) * (1 - subscription.discount_pct / 100)).toFixed(3)),
          error_message: cycle === subscription.total_cycles && subscription.status === SubscriptionStatus.PAST_DUE ? 'Carte expi ree' : null,
          scheduled_for: randomPastDate(4, 90),
          attempted_at: randomPastDate(3, 80),
        }));
      }
    }
  }

  const pricingRules = [
    {
      name: 'Destockage maille hiver',
      strategy: DynamicPricingStrategy.INVENTORY_AGE,
      scope: DynamicPricingScope.FAMILLE,
      scope_value: 'VETEMENTS',
      min_price_pct: 65,
      max_price_pct: 100,
      params: { startDays: 30, pctPerDay: 0.7, maxDiscountPct: 25 },
      auto_apply_threshold_pct: 8,
      priority: 10,
    },
    {
      name: 'Boost produits chauds',
      strategy: DynamicPricingStrategy.HIGH_DEMAND,
      scope: DynamicPricingScope.ALL,
      scope_value: null,
      min_price_pct: 100,
      max_price_pct: 112,
      params: { minViews30d: 120, minOrders30d: 15, markupPct: 6 },
      auto_apply_threshold_pct: 5,
      priority: 20,
    },
  ];
  for (const rule of pricingRules) {
    const existing = await pricingRuleRepo.findOne({ where: { name: rule.name } });
    if (!existing) {
      await pricingRuleRepo.save(pricingRuleRepo.create({ ...rule, is_active: true }));
    }
  }

  for (const product of products.slice(0, 5)) {
    const existing = await pricingChangeRepo.findOne({ where: { product_id: product.id } });
    if (!existing) {
      const oldPrice = Number(product.price || product.currentPrice || 0);
      const newPrice = Number((oldPrice * pickOne([0.9, 0.92, 1.05])).toFixed(3));
      await pricingChangeRepo.save(pricingChangeRepo.create({
        product_id: product.id,
        rule_id: null,
        strategy: newPrice > oldPrice ? DynamicPricingStrategy.HIGH_DEMAND : DynamicPricingStrategy.INVENTORY_AGE,
        old_price: oldPrice,
        new_price: newPrice,
        delta_pct: Number((((newPrice - oldPrice) / oldPrice) * 100).toFixed(2)),
        status: pickOne(['APPLIED', 'PROPOSED', 'REJECTED']),
        reason: `Produit reel ${product.title} ajuste selon le contexte de vente.`,
      }));
    }
  }

  const featureFlags = [
    {
      key: 'checkout_express_v2',
      name: 'Checkout express V2',
      description: 'Test de simplification du checkout pour clients fideles.',
      is_enabled: true,
      rollout_pct: 50,
      segments: ['VIP', 'LOYAL'],
      variants: [{ name: 'A', weight: 50 }, { name: 'B', weight: 50 }],
    },
    {
      key: 'product_page_social_proof',
      name: 'Social proof produit',
      description: 'Affiche un bandeau de preuve sociale sur les fiches produit.',
      is_enabled: true,
      rollout_pct: 100,
      segments: null,
      variants: null,
    },
  ];
  for (const flag of featureFlags) {
    let existing = await flagRepo.findOne({ where: { key: flag.key } });
    if (!existing) existing = await flagRepo.save(flagRepo.create(flag));
    const eventCount = await flagEventRepo.count({ where: { flag_key: flag.key } });
    if (eventCount === 0) {
      for (const customer of customers.slice(0, 6)) {
        const variant = flag.variants?.[customer.id % 2]?.name || 'ON';
        await flagEventRepo.save(flagEventRepo.create({
          flag_key: flag.key,
          user_id: customer.id,
          variant,
          kind: 'EXPOSURE',
          goal: 'ADD_TO_CART',
          metadata: { customer: customer.email },
        }));
        if (Math.random() > 0.35) {
          await flagEventRepo.save(flagEventRepo.create({
            flag_key: flag.key,
            user_id: customer.id,
            variant,
            kind: 'CONVERSION',
            goal: pickOne(['ADD_TO_CART', 'COMPLETE_PURCHASE']),
            metadata: { productId: pickOne(products).id },
          }));
        }
      }
    }
  }

  const sellerProfiles = [
    { email: 'seller.noor@barsha.com.tn', first: 'Nour', last: 'Seller', business: 'Noor Concept Store', slug: 'noor-concept-store', status: SellerStatus.APPROVED, commission: 14 },
    { email: 'seller.urban@barsha.com.tn', first: 'Walid', last: 'Urban', business: 'Urban Basics TN', slug: 'urban-basics-tn', status: SellerStatus.PENDING, commission: 15 },
  ];
  const sellerPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const profile of sellerProfiles) {
    let owner = await userRepo.findOne({ where: { email: profile.email } });
    if (!owner) {
      owner = await userRepo.save(userRepo.create({
        email: profile.email,
        phone: '+216700099' + randomInt(10, 99),
        password_hash: sellerPassword,
        first_name: profile.first,
        last_name: profile.last,
        gender: 'male',
        role: UserRole.CUSTOMER,
        is_active: true,
        is_verified: true,
      }));
    }
    let seller = await sellerRepo.findOne({ where: { slug: profile.slug } });
    if (!seller) {
      seller = await sellerRepo.save(sellerRepo.create({
        owner_user_id: owner.id,
        slug: profile.slug,
        business_name: profile.business,
        legal_name: profile.business,
        vat_number: `TN-${randomInt(1000000, 9999999)}`,
        description: `Vendeur partenaire reel de demo pour ${profile.business}.`,
        logo_url: products[0]?.firstImageUrl || null,
        contact_email: profile.email,
        contact_phone: owner.phone,
        commission_pct: profile.commission,
        payout_iban: `TN59BAR${randomInt(100000000, 999999999)}`,
        payout_bank_name: 'Banque de Tunisie',
        status: profile.status,
        approved_at: profile.status === SellerStatus.APPROVED ? randomPastDate(20, 60) : null,
        approved_by: profile.status === SellerStatus.APPROVED ? admin.id : null,
      }));
    }
    const payoutCount = await payoutRepo.count({ where: { seller_id: seller.id } });
    if (payoutCount === 0 && seller.status === SellerStatus.APPROVED) {
      const gross = 1480.5;
      const commission = Number((gross * (Number(seller.commission_pct) / 100)).toFixed(3));
      await payoutRepo.save(payoutRepo.create({
        seller_id: seller.id,
        period_start: daysAgo(45),
        period_end: daysAgo(15),
        gross_sales: gross,
        commission_amount: commission,
        refund_amount: 40,
        net_payout: Number((gross - commission - 40).toFixed(3)),
        order_count: 12,
        status: 'PENDING',
        notes: `Payout demo pour ${seller.business_name}.`,
      }));
    }
  }

  for (const [index, customer] of customers.slice(0, 3).entries()) {
    let account = await b2bAccountRepo.findOne({ where: { user_id: customer.id } });
    if (!account) {
      account = await b2bAccountRepo.save(b2bAccountRepo.create({
        user_id: customer.id,
        company_name: pickOne(['Boutique Atlas', 'Maison El Hana', 'Concept Store Medina']) + ` ${index + 1}`,
        vat_number: `B2B-TN-${randomInt(10000, 99999)}`,
        registry_number: `RC-${randomInt(100000, 999999)}`,
        contact_name: `${customer.first_name} ${customer.last_name}`,
        contact_email: customer.email,
        contact_phone: customer.phone,
        address: `${randomInt(3, 40)} Rue ${pickOne(['de Marseille', 'Habib Bourguiba', 'de la Republique'])}`,
        city: pickOne(CITY_DATA).city,
        tier: pickOne([B2BTier.SILVER, B2BTier.GOLD, B2BTier.PLATINUM]),
        custom_discount_pct: null,
        credit_limit: pickOne([0, 1000, 2500]),
        credit_used: pickOne([0, 150, 320]),
        status: pickOne([B2BStatus.APPROVED, B2BStatus.PENDING]),
        payment_terms: pickOne([B2BPaymentTerms.PREPAID, B2BPaymentTerms.NET_15, B2BPaymentTerms.NET_30]),
        tax_exempt: false,
        approved_at: randomPastDate(10, 40),
        approved_by: admin.id,
      }));
    }

    const quoteExists = await b2bQuoteRepo.count({ where: { account_id: account.id } });
    if (quoteExists === 0) {
      const quoteProducts = pickMany(products, 3);
      const items = quoteProducts.map((product) => {
        const quantity = randomInt(5, 15);
        const unitPrice = Number(product.currentPrice || product.price || 0);
        const lineTotal = Number((quantity * unitPrice).toFixed(3));
        return { productId: product.id, quantity, unitPrice, title: product.title, lineTotal };
      });
      const subtotal = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(3));
      const proposedDiscount = pickOne([8, 10, 12]);
      await b2bQuoteRepo.save(b2bQuoteRepo.create({
        account_id: account.id,
        user_id: customer.id,
        items,
        subtotal,
        proposed_discount_pct: proposedDiscount,
        approved_discount_pct: proposedDiscount === 12 ? 10 : null,
        total: Number((subtotal * (1 - proposedDiscount / 100)).toFixed(3)),
        status: pickOne([QuoteStatus.SUBMITTED, QuoteStatus.UNDER_REVIEW, QuoteStatus.APPROVED]),
        valid_until: daysAgo(-15),
        notes: 'Demande de devis seedee avec produits reels du catalogue.',
        admin_notes: 'Conditions valides pour client professionnel.',
      }));
    }
  }

  for (const [index, product] of products.slice(0, 2).entries()) {
    let drop = await dropRepo.findOne({ where: { product_id: product.id } });
    if (!drop) {
      drop = await dropRepo.save(dropRepo.create({
        product_id: product.id,
        headline: index === 0 ? `Drop limite ${product.title}` : `Precommande exclusive ${product.title}`,
        capacity: index === 0 ? 40 : 25,
        reserved_count: index === 0 ? 18 : 25,
        deposit_pct: pickOne([20, 30]),
        preorder_start: daysAgo(5),
        preorder_end: daysAgo(-7),
        expected_ship_date: daysAgo(-20),
        status: index === 0 ? DropStatus.PREORDER_OPEN : DropStatus.WAITLIST,
        allow_waitlist: true,
      }));
    }

    const reservationCount = await reservationRepo.count({ where: { drop_id: drop.id } });
    if (reservationCount === 0) {
      let waitPos = 1;
      for (const customer of customers.slice(0, 6)) {
        const deposited = customer.id % 3 !== 0;
        const isWaitlist = drop.status === DropStatus.WAITLIST && customer.id % 2 === 0;
        await reservationRepo.save(reservationRepo.create({
          drop_id: drop.id,
          user_id: customer.id,
          quantity: 1,
          deposit_amount: isWaitlist ? 0 : Number(((Number(product.currentPrice || product.price || 0) * Number(drop.deposit_pct)) / 100).toFixed(3)),
          balance_amount: isWaitlist ? Number(product.currentPrice || product.price || 0) : Number(((Number(product.currentPrice || product.price || 0) * (100 - Number(drop.deposit_pct))) / 100).toFixed(3)),
          status: isWaitlist ? ReservationStatus.WAITLIST : (deposited ? ReservationStatus.DEPOSITED : ReservationStatus.PENDING),
          deposit_paid_at: deposited && !isWaitlist ? randomPastDate(0, 6) : null,
          fulfilled_at: null,
          converted_order_id: null,
          waitlist_position: isWaitlist ? waitPos++ : null,
        }));
      }
    }
  }

  const configuratorSeeds = [
    {
      slug: 'gift-box-aid',
      title: 'Gift Box AID',
      kind: 'GIFT_BOX',
      description: 'Coffret cadeau compose a partir de produits reels Barsha.',
      bundle_discount_pct: 12,
    },
    {
      slug: 'outfit-city-edit',
      title: 'Outfit City Edit',
      kind: 'OUTFIT',
      description: 'Tenue composee avec haut, maille et piece complementaire.',
      bundle_discount_pct: 10,
    },
  ];
  for (const seed of configuratorSeeds) {
    let configurator = await configuratorRepo.findOne({ where: { slug: seed.slug } });
    if (!configurator) {
      configurator = await configuratorRepo.save(configuratorRepo.create({
        ...seed,
        cover_image: products[0]?.firstImageUrl || null,
        is_active: true,
      }));
    }
    const slotCount = await slotRepo.count({ where: { configurator_id: configurator.id } });
    if (slotCount === 0) {
      await slotRepo.save(slotRepo.create({
        configurator_id: configurator.id,
        name: 'Piece principale',
        position: 1,
        required: true,
        max_items: 1,
        allowed_product_ids: products.slice(0, 4).map((product) => product.id),
        filter_category_id: null,
        filter_famille: null,
        filter_tag: null,
      }));
      await slotRepo.save(slotRepo.create({
        configurator_id: configurator.id,
        name: 'Complement',
        position: 2,
        required: false,
        max_items: 2,
        allowed_product_ids: products.slice(4, 8).map((product) => product.id),
        filter_category_id: null,
        filter_famille: null,
        filter_tag: null,
      }));
    }
  }

  const lifecycleSeeds = [
    {
      name: 'Welcome nouveaux inscrits',
      trigger_event: LifecycleTrigger.WELCOME,
      description: 'Sequence de bienvenue pour clients reels seedes.',
      steps: [
        { delayHours: 0, channel: 'EMAIL' as const, subject: 'Bienvenue chez Barsha', body: 'Bonjour {{firstName}}, bienvenue chez Barsha.', actionUrl: '/fr/shop' },
        { delayHours: 48, channel: 'SMS' as const, body: 'Votre code WELCOME10 est disponible pour votre premiere commande.', couponCode: 'WELCOME10' },
      ],
    },
    {
      name: 'Relance panier abandonne',
      trigger_event: LifecycleTrigger.ABANDONED_CART,
      description: 'Relance automatique panier sur produits reels.',
      steps: [
        { delayHours: 4, channel: 'EMAIL' as const, subject: 'Votre selection vous attend', body: 'Retrouvez votre panier en un clic.', actionUrl: '/fr/panier' },
      ],
    },
  ];
  for (const seed of lifecycleSeeds) {
    let sequence = await lifecycleRepo.findOne({ where: { name: seed.name } });
    if (!sequence) sequence = await lifecycleRepo.save(lifecycleRepo.create({ ...seed, is_active: true }));
    const enrollments = await enrollmentRepo.count({ where: { sequence_id: sequence.id } });
    if (enrollments === 0) {
      for (const customer of customers.slice(0, 4)) {
        await enrollmentRepo.save(enrollmentRepo.create({
          sequence_id: sequence.id,
          user_id: customer.id,
          next_step_at: daysAgo(-1),
          next_step_index: 0,
          context: { customerName: `${customer.first_name} ${customer.last_name}`, productId: pickOne(products).id },
          status: pickOne(['ACTIVE', 'ACTIVE', 'COMPLETED'] as const),
        }));
      }
    }
  }

  const supplierSeeds = [
    { code: 'TEX-TN', name: 'Textile Tunisia Supply', contact_email: 'contact@textiletunisia.tn', lead_time_days: 12 },
    { code: 'MED-FASH', name: 'Mediterranean Fashion Source', contact_email: 'sales@medfash.tn', lead_time_days: 18 },
  ];
  const suppliers: Supplier[] = [];
  for (const seed of supplierSeeds) {
    let supplier = await supplierRepo.findOne({ where: { code: seed.code } });
    if (!supplier) {
      supplier = await supplierRepo.save(supplierRepo.create({
        ...seed,
        contact_phone: '+2167100' + randomInt(1000, 9999),
        address: `${randomInt(1, 40)} Zone industrielle, ${pickOne(['Tunis', 'Sousse', 'Sfax'])}`,
        min_order_qty: pickOne([6, 12]),
        is_active: true,
      }));
    }
    suppliers.push(supplier);
  }

  for (const [index, product] of products.slice(0, 8).entries()) {
    const supplier = suppliers[index % suppliers.length];
    const existing = await productSupplierRepo.findOne({ where: { product_id: product.id, supplier_id: supplier.id } });
    if (!existing) {
      await productSupplierRepo.save(productSupplierRepo.create({
        product_id: product.id,
        supplier_id: supplier.id,
        unit_cost: Number((Number(product.price || product.currentPrice || 0) * 0.48).toFixed(3)),
        is_primary: true,
        min_order_qty: pickOne([6, 12]),
      }));
    }
  }

  if ((await purchaseOrderRepo.count()) === 0) {
    const poProducts = products.slice(0, 3);
    const items = poProducts.map((product) => {
      const quantity = randomInt(8, 20);
      const unitCost = Number((Number(product.price || product.currentPrice || 0) * 0.48).toFixed(3));
      return {
        productId: product.id,
        sku: product.sku,
        title: product.title,
        quantity,
        unitCost,
        lineTotal: Number((quantity * unitCost).toFixed(3)),
      };
    });
    const subtotal = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(3));
    await purchaseOrderRepo.save(purchaseOrderRepo.create({
      reference: `PO-${new Date().getFullYear()}-0001`,
      supplier_id: suppliers[0].id,
      warehouse_id: warehouses[0]?.id || null,
      items,
      subtotal,
      tax_amount: Number((subtotal * 0.19).toFixed(3)),
      total: Number((subtotal * 1.19).toFixed(3)),
      status: PurchaseOrderStatus.APPROVED,
      origin: 'AUTO',
      notes: 'PO auto-generee a partir du forecast de reapprovisionnement.',
      expected_delivery: daysAgo(-14),
      sent_at: randomPastDate(0, 5),
      received_at: null,
      created_by: admin.id,
    }));
  }

  if ((await cmsPageRepo.count()) === 0) {
    const homeProducts = products.slice(0, 4).map((product) => product.id);
    const page = await cmsPageRepo.save(cmsPageRepo.create({
      slug: 'capsule-printemps',
      title: 'Capsule Printemps',
      meta_description: 'Selection printaniere avec produits reels du catalogue Barsha.',
      cover_image: products[0]?.firstImageUrl || null,
      locale: 'fr',
      blocks: [
        { type: 'hero', props: { title: 'Capsule Printemps', subtitle: 'Une selection reelle du catalogue Barsha' } },
        { type: 'product-list', props: { productIds: homeProducts, title: 'A decouvrir' } },
        { type: 'text', props: { html: '<p>Page seedee avec du contenu reel et versionnable.</p>' } },
      ],
      status: CmsPageStatus.PUBLISHED,
      publish_at: randomPastDate(3, 10),
      unpublish_at: null,
      version: 1,
      created_by: admin.id,
      updated_by: admin.id,
    }));
    await cmsRevisionRepo.save(cmsRevisionRepo.create({
      page_id: page.id,
      version: 1,
      snapshot: { title: page.title, blocks: page.blocks, status: page.status },
      edited_by: admin.id,
      change_note: 'Version initiale seedee',
    }));
  }

  if ((await gdprRepo.count()) === 0) {
    for (const [index, customer] of customers.slice(0, 3).entries()) {
      await gdprRepo.save(gdprRepo.create({
        user_id: customer.id,
        type: pickOne([GdprRequestType.EXPORT, GdprRequestType.ERASURE, GdprRequestType.RECTIFICATION]),
        status: pickOne([GdprRequestStatus.RECEIVED, GdprRequestStatus.IN_PROGRESS, GdprRequestStatus.COMPLETED]),
        verification_token: `gdpr-${customer.id}-${index + 1}`,
        verified_at: randomPastDate(0, 8),
        export_payload: { email: customer.email, orders: orders.filter((order) => order.user_id === customer.id).map((order) => order.reference) },
        erasure_summary: null,
        reason_text: 'Demande seedee depuis des donnees client reelles.',
        admin_note: 'Controle manuel effectue.',
        completed_at: index === 2 ? randomPastDate(0, 2) : null,
      }));
    }
  }

  if ((await fiscalRepo.count()) === 0) {
    for (const [index, order] of orders.slice(0, 6).entries()) {
      const customer = customers.find((item) => item.id === order.user_id);
      const total = Number(order.total_amount || 0);
      const excl = Number((total / 1.19).toFixed(3));
      const tax = Number((total - excl).toFixed(3));
      await fiscalRepo.save(fiscalRepo.create({
        fiscal_number: `FR-${new Date().getFullYear()}-${String(index + 1).padStart(6, '0')}`,
        order_id: order.id,
        order_reference: order.reference,
        fiscal_date: order.created_at,
        issuer_matricule: 'TN1234567A',
        customer_matricule: null,
        customer_name: customer ? `${customer.first_name} ${customer.last_name}` : 'Client Barsha',
        total_excl_tax: excl,
        total_tax: tax,
        total_incl_tax: total,
        ttn_stamp: index < 3 ? `TTN-${randomInt(100000, 999999)}` : null,
        ttn_reference: index < 3 ? `REF-${randomInt(100000, 999999)}` : null,
        status: index < 3 ? FiscalReceiptStatus.STAMPED : pickOne([FiscalReceiptStatus.PENDING, FiscalReceiptStatus.SUBMITTED]),
        submission_payload: { orderReference: order.reference, amount: total },
        last_error: index === 5 ? 'Sandbox TTN timeout' : null,
      }));
    }
  }

  if ((await eventRepo.count()) < 12) {
    const eventSeeds = [
      { type: 'order.placed', aggregate: orders[0] ? `order:${orders[0].id}` : 'order:1', actor: customers[0].id, payload: { orderReference: orders[0]?.reference } },
      { type: 'fraud.held', aggregate: 'fraud:1', actor: admin.id, payload: { orderId: orders[1]?.id, score: 92 } },
      { type: 'subscription.charged', aggregate: 'subscription:1', actor: customers[1].id, payload: { customer: customers[1].email } },
      { type: 'ugc.auto_approved', aggregate: 'ugc:1', actor: admin.id, payload: { productId: products[0].id } },
    ];
    for (const seed of eventSeeds) {
      await eventRepo.save(eventRepo.create({
        type: seed.type,
        correlation_id: `seed-${slugify(seed.type)}-${randomInt(1000, 9999)}`,
        payload: seed.payload,
        aggregate_id: seed.aggregate,
        actor_id: seed.actor,
        status: 'PUBLISHED',
        attempts: 1,
        last_error: null,
      }));
    }
  }

  if ((await tagRepo.count()) === 0) {
    for (const customer of customers.slice(0, 4)) {
      await tagRepo.save(tagRepo.create({
        user_id: customer.id,
        tag: pickOne(['VIP', 'LOYAL', 'WHOLESALE', 'INFLUENCER']),
        color: pickOne(['gold', 'blue', 'green', 'pink']),
        added_by: admin.id,
      }));
      await noteRepo.save(noteRepo.create({
        user_id: customer.id,
        note: `Client reel seede: ${customer.first_name} ${customer.last_name}. Historique exploitable pour le CRM.`,
        admin_id: admin.id,
        admin_name: `${admin.first_name} ${admin.last_name}`,
      }));
    }
  }

  if ((await taskRepo.count()) === 0) {
    for (const order of orders.slice(0, 4)) {
      const customer = customers.find((item) => item.id === order.user_id);
      await taskRepo.save(taskRepo.create({
        title: `Suivi commande ${order.reference}`,
        description: `Verifier la commande de ${customer?.first_name || 'client'} apres alerte ou besoin support.`,
        status: pickOne(['TODO', 'IN_PROGRESS', 'DONE']),
        priority: pickOne(['MEDIUM', 'HIGH', 'URGENT']),
        category: pickOne(['follow-up', 'fraud', 'restock']),
        assigned_to: admin.id,
        due_date: daysAgo(-randomInt(1, 7)),
        related_order_id: order.id,
        related_user_id: order.user_id,
        created_by: admin.id,
        done_at: null,
      }));
    }
  }

  if ((await signalRepo.count()) === 0) {
    for (const customer of customers.slice(0, 6)) {
      await signalRepo.save(signalRepo.create({
        user_id: customer.id,
        churn_score: randomInt(18, 82),
        clv: Number(randomInt(180, 2400)),
        days_since_last_order: randomInt(2, 65),
        computed_at: randomPastDate(0, 4),
      }));
    }
  }

  if ((await dealRepo.count()) === 0) {
    for (const product of products.slice(0, 2)) {
      const base = Number(product.currentPrice || product.price || 0);
      await dealRepo.save(dealRepo.create({
        product_id: product.id,
        special_price: Number((base * 0.88).toFixed(3)),
        start_at: daysAgo(-1),
        end_at: daysAgo(-2),
        is_active: true,
        headline: `Deal du jour sur ${product.title}`,
      }));
    }
  }

  if ((await slotDeliveryRepo.count()) === 0) {
    await slotDeliveryRepo.save(slotDeliveryRepo.create({ label: 'MORNING', start_time: '09:00', end_time: '12:00', city: 'Tunis', capacity: 35, is_active: true }));
    await slotDeliveryRepo.save(slotDeliveryRepo.create({ label: 'AFTERNOON', start_time: '14:00', end_time: '18:00', city: 'La Marsa', capacity: 20, is_active: true }));
  }

  if ((await pickupRepo.count()) === 0) {
    await pickupRepo.save(pickupRepo.create({
      name: 'Barsha Pickup Tunis',
      address: '12 Rue de Marseille, Tunis',
      city: 'Tunis',
      phone: '+21670100100',
      hours: 'Lun-Sam 09h-18h',
      is_active: true,
      latitude: 36.8065,
      longitude: 10.1815,
    }));
  }

  if ((await ugcRepo.count()) === 0) {
    for (const [index, review] of reviews.slice(0, 4).entries()) {
      await ugcRepo.save(ugcRepo.create({
        user_id: review.user_id,
        product_id: review.product_id,
        image_url: products[index]?.firstImageUrl || 'https://images.zen.com.tn/uploads/333_b89a7f77be.JPG',
        caption: pickOne([
          'Look porte ce week-end, tissu tres agreable.',
          'Article recu, joli rendu et coupe confortable.',
          'Mon outfit Barsha prefere pour sortir a Tunis.',
        ]),
        status: pickOne(['PENDING', 'APPROVED', 'REJECTED']),
        likes_count: randomInt(2, 45),
        moderated_at: randomPastDate(0, 3),
      }));
    }
  }

  if ((await auditRepo.count()) === 0) {
    for (const product of products.slice(0, 4)) {
      await auditRepo.save(auditRepo.create({
        resource: 'product',
        resource_id: String(product.id),
        action: 'UPDATE',
        before_state: { currentPrice: product.currentPrice },
        after_state: { currentPrice: product.currentPrice, featured: true },
        admin_id: admin.id,
        admin_name: `${admin.first_name} ${admin.last_name}`,
      }));
    }
  }

  console.log('Advanced admin modules seeded');
}

async function seedRealisticScenario(dataSource: DataSource) {
  await seedAddresses(dataSource);
  await seedPromotions(dataSource);
  await seedOrdersAndCommerce(dataSource);
  await seedSupportAndNotifications(dataSource);
  await seedReviewsAndQA(dataSource);
  await seedLoyaltyAndCredits(dataSource);
  await seedWishlistAndCart(dataSource);
  await seedReturnsAlertsReferrals(dataSource);
  await seedAdminExperience(dataSource);
  await seedNewsletter(dataSource);
  await seedAdvancedAdminModules(dataSource);
}

async function seed() {
  const options = buildDataSourceOptions();
  const dataSource = new DataSource(options);
  await dataSource.initialize();

  const databaseLabel =
    options.type === 'sqlite'
      ? `SQLite (${resolveSqlitePath()})`
      : `SQL Server (${options.database})`;
  console.log(`Connected to ${databaseLabel}`);

  await seedUsers(dataSource);
  await seedCategories(dataSource);
  await seedProducts(dataSource);
  await seedFaqs(dataSource);
  await seedCoupons(dataSource);
  await seedBanners(dataSource);
  await seedRealisticScenario(dataSource);

  await dataSource.destroy();
  console.log('Realistic seed complete!');
}

seed().catch(async (error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
