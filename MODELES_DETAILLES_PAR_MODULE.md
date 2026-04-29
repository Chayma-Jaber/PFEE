# 📊 MODÈLES DÉTAILLÉS PAR MODULE - BARSHA E-COMMERCE

---

## MODULE 1: FRONTEND ANGULAR

### 1.1 EXIGENCES DÉTAILLÉES - HOME PAGE

#### **REQ-F01-HOME-001**: Hero Section

**Description**: Bannière d'accueil avec appel à l'action

**Détails techniques**:
- Carousel automatique d'images (3 slides)
- Transition en fade (500ms)
- Affiche promotions principales
- CTA "Shop Now" et "Discover AI Assistant"
- Responsive: 100vw sur mobile, centré desktop

**Critères d'acceptation**:
```gherkin
Feature: Hero Section Display
  Scenario: Display carousel on home load
    Given user visits home page
    When page loads
    Then carousel displays first image
    And transitions to next image every 5 seconds
    And CTA buttons are clickable
    And hero section is 100% viewport height on mobile
```

**Mesures**: 
- ✅ Render time: < 500ms
- ✅ Image optimization: Akamai/Cloudflare
- ✅ Accessibility: ARIA labels on buttons

---

#### **REQ-F01-HOME-002**: Product Recommendations Grid

**Description**: Afficher 12 produits recommandés en grille 4x3

**Props en input**:
```typescript
interface ProductGridProps {
  products: Product[];
  loading: boolean;
  onLoadMore: () => void;
  variant: 'featured' | 'bestsellers' | 'new-arrivals';
}
```

**Actions utilisateur**:
- Click produit → détail page
- Hover → expand card, show "Add to Cart" button
- "View All" → catalog filtré

**Critères d'acceptation**:
```
✅ Load 12 products in <1s
✅ Responsive: 1 col (mobile), 2 (tablet), 4 (desktop)
✅ Images lazy load below fold
✅ Hover effects smooth (GPU accelerated)
✅ "Add to Cart" works directly from grid
```

---

### 1.2 EXIGENCES DÉTAILLÉES - PRODUCT CATALOG PAGE

#### **REQ-F02-CATALOG-001**: Search Bar

**Component**: `SearchBarComponent`

**Inputs**:
```typescript
@Input() placeholder: string = 'Rechercher produits...';
@Input() categories: Category[] = [];
```

**Outputs**:
```typescript
@Output() search = new EventEmitter<string>();
@Output() filterChange = new EventEmitter<FilterOptions>();
```

**Fonctionnalités**:
- Auto-complete suggestions (min 3 chars)
- Support accents/diacritiques
- Recent searches localStorage
- Meilisearch backend

**Cas d'usage**:
```
USER INPUT: "jean"
AUTOCOMPLETE SHOWS:
- Jean bleu homme
- Jean noir femme
- Jean skinny
- Jeans pas cher
LATENCY: < 200ms (Meilisearch)
```

**Critères d'acceptation**:
```
✅ Autocomplete suggestions en < 200ms
✅ Support Arabe + Français
✅ Typo tolerance: "jee" → "jean"
✅ Clear recent searches option
✅ Search persists on page reload
```

---

#### **REQ-F02-CATALOG-002**: Filter Sidebar

**Component**: `FilterSidebarComponent`

**Filtres disponibles**:

| Filtre | Type | Options | Backend |
|--------|------|---------|---------|
| **Catégorie** | Checkbox | Fetch dynamique | DB |
| **Genre** | Radio | Homme/Femme/Enfant | Facette |
| **Prix** | Range slider | Min: 10 TND, Max: 500 TND | Facette |
| **Taille** | Checkbox | XS...XXL | Facette |
| **Couleur** | Color picker | 20+ colors | Facette |
| **Marque** | Checkbox | Top 50 brands | Facette |
| **Disponibilité** | Toggle | In Stock / Out of Stock | Filter |

**Implémentation**:
```typescript
applyFilters(filters: FilterOptions) {
  const query = {
    category: filters.category,
    gender: filters.gender,
    price: { min: filters.priceMin, max: filters.priceMax },
    sizes: filters.sizes,
    colors: filters.colors,
    brands: filters.brands,
    inStock: filters.inStock
  };
  
  // POST /api/products/search avec query
  this.productService.search(query).subscribe(
    results => this.updateGrid(results)
  );
}
```

**Critères d'acceptation**:
```
✅ Mobile: Collapsible drawer
✅ Desktop: Fixed sidebar
✅ Filter combinations work
✅ Clear all button
✅ Applied filters shown as tags
✅ URL params reflect filters (for sharing)
✅ Response time: < 300ms
```

---

#### **REQ-F02-CATALOG-003**: Pagination & Infinite Scroll

**Options**:
- Desktop: Traditional pagination (Page 1, 2, 3...)
- Mobile: Infinite scroll + Load More button

**Implementation**:
```typescript
onLoadMore() {
  this.page++;
  this.productService.getProducts(this.page, this.filters)
    .subscribe(newProducts => {
      this.products.push(...newProducts);
    });
}
```

**Critères**:
```
✅ Load 20 products per page
✅ Total count displayed
✅ Mobile: Auto-load 3 products before bottom
✅ Loading skeleton shown
✅ Duplicate prevention
✅ Memory management (unload old items)
```

---

### 1.3 EXIGENCES DÉTAILLÉES - PRODUCT DETAIL PAGE

#### **REQ-F03-DETAIL-001**: Image Gallery

**Component**: `ImageGalleryComponent`

**Features**:
- Main image (800x800px)
- Thumbnails carousel (50x50px)
- Zoom on hover (500px box)
- Mouse wheel / touch swipe
- Fullscreen modal option

**Implementation**:
```typescript
<div class="gallery-main" appImageZoom>
  <img [src]="selectedImage" (click)="openFullscreen()">
</div>
<div class="gallery-thumbs" #thumbsCarousel>
  <img *ngFor="let img of product.images" 
       [src]="img" 
       (click)="selectImage(img)"
       [class.active]="img === selectedImage">
</div>
```

**Critères d'acceptation**:
```
✅ Main image loads < 1s
✅ Zoom smooth 60fps
✅ Touch drag/swipe works
✅ Thumbnails infinite carousel
✅ Accessibility: keyboard navigation
✅ Responsive: Stack on mobile
```

---

#### **REQ-F03-DETAIL-002**: Product Info Panel

**Sections**:

1. **Titre & Rating**
```
"Jeans Slim Bleu Homme - Levi's 501"
⭐⭐⭐⭐⭐ (127 avis)
```

2. **Prix**
```
Prix régulier: 99.99 TND [strikethrough si réduit]
Prix promo: 79.99 TND ✅ (19% off)
[Inclus taxes]
```

3. **Disponibilité**
```
✅ En stock (12 articles disponibles)
Livraison: 2-3 jours
Retour: 14 jours gratuit
```

4. **Variantes**
```
Taille: [S] [M] [L] [XL] [XXL]
Couleur: [Colour picker circles]
Quantité: [- 1 +]
```

5. **CTA Buttons**
```
[Ajouter au panier] [Ajouter à wishlist]
```

6. **Partage Social**
```
[f] [📌] [🐦] [Copy link]
```

**Critères**:
```
✅ All fields populate correctly
✅ Stock updates real-time
✅ Variant selection prevents OOS combos
✅ Add to cart preserves choices
✅ Share opens correct social dialogs
```

---

#### **REQ-F03-DETAIL-003**: Reviews Section

**Sub-components**:

| Element | Requirement |
|---------|-------------|
| **Average rating** | 5-star display, avg score |
| **Review filters** | Sort by: Newest, Helpful, Rating |
| **Individual review** | Name, date, rating, comment, helpful count |
| **Add review button** | Appears if user bought product |
| **Pagination** | 5 reviews per page |

**REST endpoint**:
```
GET /api/products/:id/reviews?page=1&sort=newest
Response: {
  average_rating: 4.7,
  total_reviews: 127,
  rating_distribution: { 5: 95, 4: 22, 3: 8, 2: 2, 1: 0 },
  reviews: [
    {
      id: 1,
      author: "Alice M.",
      rating: 5,
      title: "Excellent qualité!",
      comment: "Jean de très bonne qualité...",
      date: "2026-04-10",
      helpful_count: 23
    }
  ]
}
```

---

### 1.4 EXIGENCES DÉTAILLÉES - CHECKOUT

#### **REQ-F06-CHECKOUT-001**: Step 1 - Cart Review

**Layout**:
- Left (60%): Order items table
- Right (40%): Order summary

**Items table columns**:
| Column | Content | Actions |
|--------|---------|---------|
| Image | Thumb | - |
| Product | Name + variant | - |
| Price | Per unit | - |
| Qty | Spinner | -, +, remove |
| Subtotal | Price × Qty | - |

**Order summary**:
```
Subtotal:          699.95 TND
Discount (≈ %):   -50.00 TND
Shipping:           10.00 TND
Tax (19%):         126.49 TND
────────────────────────────
TOTAL:              786.44 TND
```

**CTAs**:
- [Continuer Shopping]
- [Suivant →]

---

#### **REQ-F06-CHECKOUT-002**: Step 2 - Shipping Address

**Form fields** (HTML5 validation):
```
[* First name]
[* Last name]
[* Email]
[* Phone]
[* Street address 1]
[  Street address 2]
[* City]
[* Postal code]
[* Country] dropdown
[  Save for future] checkbox
```

**Validation**:
- Phone: Format Tunisie (+216...) or 8digits
- Postal: 4 chars
- Required fields: Use asterisks

**Options de livraison**:
- Colis Express: 5 TND (1-2 jours)
- Livraison Standard: 10 TND (3-5 jours)
- Pickup en magasin: Libre

---

#### **REQ-F06-CHECKOUT-003**: Step 3 - Payment

**Integration Click to Pay**:

API Call:
```bash
POST https://sandbox.ctp.barsha.com.tn/v1/payments
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "amount": 78644,
  "currency": "TND",
  "order_number": "ORD-2026-0001",
  "customer": {
    "email": "user@example.com",
    "phone": "+21698765432"
  },
  "redirect_url": "https://barsha.com.tn/checkout/confirmation"
}
```

**Response handling**:
```
Success: → Step 4 (Confirmation)
Declined: → Show "Paiement refusé. Réessayez."
Timeout: → Show "Le paiement a dépassé le délai..."
```

**Fallback**:
- Offline payment method (COD - Cash on Delivery)
- Bank transfer option

---

#### **REQ-F06-CHECKOUT-004**: Step 4 - Confirmation

**Display**:
- ✅ Order number: ORD-2026-00123
- ✅ Order date & time
- ✅ Items recap (compact grid)
- ✅ Total: 786.44 TND
- ✅ Estimated delivery
- ✅ Tracking number (when available)
- ✅ Support contact info

**CTAs**:
- [Continuer Shopping]
- [Voir ma commande]

**Email sent**:
To: user@example.com
Subject: "Commande confirmée #ORD-2026-00123"

---

## MODULE 2: BACKEND NESTJS

### 2.1 EXIGENCES DÉTAILLÉES - AUTHENTICATION

#### **REQ-AUTH-001**: User Registration Endpoint

**Endpoint**:
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "password_confirm": "SecurePass123!",
  "firstName": "Ahmed",
  "lastName": "Ben Ali",
  "phone": "+21698765432",
  "terms_accepted": true
}
```

**Response (201 Created)**:
```json
{
  "message": "User created. OTP sent to email.",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "Ahmed",
    "verified": false
  }
}
```

**Validations**:
```
✅ Email: Valid RFC5322 + not already registered
✅ Password: Min 8 chars, 1 uppercase, 1 number, 1 special
✅ Phone: Valid Tunisie format
✅ Terms: Must be accepted
✅ Rate limit: 5 registrations/IP/hour
```

**Actions côté serveur**:
1. Hash password with bcrypt (salt: 10)
2. Create user in DB
3. Generate 6-digit OTP
4. Send OTP via email (validity: 10 min)
5. Return 201 with user data (no password)

---

#### **REQ-AUTH-002**: OTP Verification

**Endpoint**:
```
POST /api/auth/verify-otp
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (200 OK)**:
```json
{
  "message": "Email verified successfully",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

**Business logic**:
```typescript
async verifyOtp(email: string, otp: string) {
  // 1. Check OTP not expired
  const storedOtp = await this.cache.get(`otp:${email}`);
  if (!storedOtp || storedOtp !== otp) {
    throw new BadRequestException('Invalid or expired OTP');
  }
  
  // 2. Mark user as verified
  const user = await this.userService.updateVerified(email, true);
  
  // 3. Generate JWT tokens
  const tokens = this.generateTokens(user);
  
  // 4. Store refresh token
  await this.cache.set(`refresh:${user.id}`, tokens.refresh_token);
  
  return { ...tokens, user };
}
```

---

#### **REQ-AUTH-003**: Login Endpoint

**Endpoint**:
```
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK)**:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "user": { ... }
}
```

**Token structure**:
```
Header: { alg: "HS256", typ: "JWT" }
Payload: {
  sub: user.id,
  email: user.email,
  role: "USER",
  iat: 1712000000,
  exp: 1712086400  // 24h
}
```

**Refresh token** (lasts 30 days):
```
Stored in: Cache (Redis)
Key: refresh:{user.id}
TTL: 2592000 (30 days in seconds)
```

---

### 2.2 EXIGENCES DÉTAILLÉES - PRODUCTS

#### **REQ-PROD-001**: Get Products List

**Endpoint**:
```
GET /api/products?page=1&limit=20&category=femme&sort=-updatedAt
```

**Query parameters**:
| Param | Type | Default | Example |
|-------|------|---------|---------|
| `page` | int | 1 | 2 |
| `limit` | int | 20 | 50 |
| `category` | string | - | "femme" |
| `sort` | string | "-createdAt" | "price" or "-price" |
| `search` | string | - | "jean" |

**Response (200 OK)**:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Jean Slim Bleu",
      "description": "Jean slim...",
      "category": "femme",
      "price": 99.99,
      "discount_price": 79.99,
      "image_url": "https://cdn.barsha.tn/prod/1.jpg",
      "rating": 4.7,
      "in_stock": true,
      "available_qty": 12
    }
  ],
  "pagination": {
    "total": 156,
    "page": 1,
    "pages": 8
  }
}
```

**Business logic**:
```typescript
async getProducts(page: number, limit: number, filters: any) {
  const query = this.productsRepo.createQueryBuilder('p');
  
  // Apply filters
  if (filters.category) {
    query.where('p.category = :cat', { cat: filters.category });
  }
  if (filters.search) {
    query.andWhere('p.name ILIKE :search', { search: `%${filters.search}%` });
  }
  
  // Pagination
  const total = await query.getCount();
  const data = await query
    .orderBy(`p.${filters.sort}`)
    .skip((page - 1) * limit)
    .take(limit)
    .getMany();
  
  return {
    data,
    pagination: { total, page, pages: Math.ceil(total / limit) }
  };
}
```

---

### 2.3 EXIGENCES DÉTAILLÉES - ORDERS

#### **REQ-ORDER-001**: Create Order

**Endpoint**:
```
POST /api/orders/create
Authorization: Bearer {access_token}
{
  "delivery_address": {
    "first_name": "Ahmed",
    "last_name": "Ben Ali",
    "street": "Rue XXX",
    "city": "Tunis",
    "postal_code": "1000",
    "phone": "+21698765432"
  },
  "shipping_method": "express",  // or "standard", "pickup"
  "payment_method": "click_to_pay",
  "items": [
    { "product_id": 1, "quantity": 2, "unit_price": 79.99 },
    { "product_id": 5, "quantity": 1, "unit_price": 49.99 }
  ],
  "coupon_code": "SAVE20"  // optional
}
```

**Response (201 Created)**:
```json
{
  "order": {
    "id": 123,
    "order_number": "ORD-2026-00001",
    "status": "pending",
    "total_amount": 299.95,
    "items": [ ... ],
    "created_at": "2026-04-16T14:30:00Z",
    "estimated_delivery": "2026-04-18"
  },
  "payment_gateway_url": "https://ctp.barsha.tn/pay?ref=123"
}
```

**Business logic**:
```typescript
async createOrder(userId: number, dto: CreateOrderDto): Promise<Order> {
  // 1. Validate stock for all items
  for (const item of dto.items) {
    const product = await this.productsService.getProduct(item.product_id);
    if (product.available_qty < item.quantity) {
      throw new BadRequestException(`Out of stock: ${product.name}`);
    }
  }
  
  // 2. Calculate totals
  let subtotal = dto.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  
  // 3. Apply coupon if provided
  if (dto.coupon_code) {
    const coupon = await this.couponsService.validateCoupon(dto.coupon_code);
    subtotal -= subtotal * (coupon.discount_percent / 100);
  }
  
  // 4. Add shipping
  const shipping_cost = this.getShippingCost(dto.shipping_method);
  
  // 5. Calculate tax (19%)
  const tax = (subtotal + shipping_cost) * 0.19;
  const total = subtotal + shipping_cost + tax;
  
  // 6. Create order in DB
  const order = await this.ordersRepo.save({
    user_id: userId,
    order_number: `ORD-${Date.now()}`,
    status: 'pending',
    total_amount: total,
    delivery_address: dto.delivery_address,
    items: dto.items
  });
  
  // 7. Reserve stock
  for (const item of dto.items) {
    await this.productsService.reserveStock(item.product_id, item.quantity);
  }
  
  // 8. Send confirmation email
  await this.emailService.sendOrderConfirmation(order);
  
  return order;
}
```

---

#### **REQ-ORDER-002**: Get Order Details

**Endpoint**:
```
GET /api/orders/:id
Authorization: Bearer {access_token}
```

**Response (200 OK)**:
```json
{
  "id": 123,
  "order_number": "ORD-2026-00001",
  "user_id": 1,
  "status": "shipped",
  "items": [
    {
      "product_id": 1,
      "product_name": "Jean Slim Bleu",
      "quantity": 2,
      "unit_price": 79.99,
      "subtotal": 159.98
    }
  ],
  "delivery_address": { ... },
  "subtotal": 209.97,
  "shipping_cost": 10.00,
  "tax": 41.78,
  "total": 261.75,
  "status_history": [
    { "status": "pending", "date": "2026-04-16T14:30:00Z" },
    { "status": "confirmed", "date": "2026-04-16T15:00:00Z" },
    { "status": "shipped", "date": "2026-04-17T08:00:00Z" }
  ],
  "tracking_number": "TRACK123456",
  "created_at": "2026-04-16T14:30:00Z"
}
```

---

## MODULE 3: BACKEND AI (FastAPI)

### 3.1 EXIGENCES DÉTAILLÉES - CHATBOT

#### **REQ-AI-CHAT-001**: Conversational Chat

**Technical flow**:

```
INPUT (user message)
    ↓
[INTENT DETECTION] - Classify: product_search | faq | general
    ↓
[CONTEXT EXTRACTION] - Extract: gender, budget, color, brand
    ↓
[GROUNDING] - Query Meilisearch if product_search
    ↓
[LLM CALL] - Qwen 2.5 / Gemini / OpenRouter
    ↓
[RESPONSE GENERATION]
    ↓
OUTPUT + products[]
```

**Example implementation**:

```python
@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Main chatbot endpoint"""
    
    # 1. Extract context from messages
    user_message = request.messages[-1]["content"]
    gender = detect_gender(user_message)
    budget = detect_budget(user_message)
    
    # 2. Search products if needed
    products = []
    if is_shopping_intent(user_message):
        query = clean_search_query(user_message)
        products = await search_products(query, gender, budget)
    
    # 3. Build context for LLM
    context = {
        "user_query": user_message,
        "user_preferences": {
            "gender": gender,
            "budget": budget,
            "recent_views": request.user_context.get("recent_views", [])
        },
        "catalog": products[:5]  # Top 5 most relevant
    }
    
    # 4. Call LLM
    system_prompt = f"""Tu es Barsha, un assistant shopping IA pour une plateforme e-commerce tunisienne.
Tu DOIS:
- Recommander des produits pertinents basé sur le contexte utilisateur
- Répondre en Français (et Arabe si demandé)
- Être concis et utile

Contexte utilisateur: {context}"""
    
    response = await call_llm(
        model=request.model or DEFAULT_MODEL,
        system_prompt=system_prompt,
        messages=request.messages,
        temperature=0.7,
        max_tokens=500
    )
    
    # 5. Return response + products
    return {
        "response": response,
        "products": products,
        "confidence": 0.95
    }
```

**Expected responses**:

```
Example 1:
USER: "Je cherche un jean pour homme, moins de 100 TND"
BOT: "Voici mes 3 meilleures recommandations:
1. Jean Slim Bleu (Levi's 501) - 79.99 TND ⭐4.8
2. Jean Skinny Noir - 65.00 TND ⭐4.3
3. Jean Casual - 95.00 TND ⭐4.6

Lequel vous intéresse?"

Example 2:
USER: "Comment retourner un produit?"
BOT: "C'est simple! Vous avez 14 jours pour retourner un article:
1. Allez à 'Mes commandes' > choisir la commande
2. Cliquez 'Demander un retour'
3. Sélectionnez la raison
4. Imprimez l'étiquette
5. Envoyez au point de collecte

Besoin d'aide supplémentaire?"
```

---

#### **REQ-AI-CHAT-002**: Context Awareness

**System maintains**:
- Conversation history (last 10 messages)
- User preferences (gender, budget, style)
- Recent viewed products
- Browsing context

**Implementation**:
```python
class UserContext:
    def __init__(self):
        self.conversation_history = deque(maxlen=10)
        self.preferences = {
            "gender": None,
            "budget_range": (0, 1000),
            "favorite_brands": [],
            "viewed_products": deque(maxlen=20)
        }
        
    def update_from_message(self, message: str):
        """Extract & update preferences from user message"""
        self.preferences["gender"] = detect_gender(message)
        self.preferences["budget_range"] = detect_budget(message)
        # ... etc
```

---

### 3.2 EXIGENCES DÉTAILLÉES - VISUAL SEARCH

#### **REQ-AI-VIS-001**: CLIP Visual Search

**Technical process**:

```
INPUT (image) [JPEG/PNG/Base64]
    ↓
[IMAGE PREPROCESSING] (OpenCV)
    ├─ Resize to 224×224
    ├─ Normalize pixel values
    ├─ Augmentation if needed
    ↓
[CLIP ENCODING] (Vision encoder)
    ├─ Extract image embedding (512-dim vector)
    ├─ Normalize to unit length
    ↓
[SIMILARITY SEARCH] (Vector database)
    ├─ Calculate cosine similarity with all products
    ├─ Top-K retrieval (K=10)
    ├─ Apply business filters (gender, price)
    ↓
OUTPUT (top 10 similar products)
```

**Implementation**:
```python
@app.post("/api/like-this")
async def visual_search(request: VisualSearchRequest):
    """CLIP-based visual similarity search"""
    
    # 1. Decode image
    if request.image_base64:
        image_data = base64.b64decode(request.image_base64)
        image = Image.open(BytesIO(image_data))
    else:
        image = Image.open(request.image_url)
    
    # 2. Extract CLIP embedding
    with torch.no_grad():
        inputs = CLIP_PROCESSOR(images=image, return_tensors="pt")
        image_embedding = CLIP_MODEL.get_image_features(**inputs)
        image_embedding = F.normalize(image_embedding, p=2, dim=-1)
    
    # 3. Compute similarity with all products
    similarities = torch.mm(image_embedding, PRODUCT_VECS.t()).squeeze()
    
    # 4. Get top-K indices
    top_k_indices = torch.topk(similarities, k=10)[1]
    
    # 5. Retrieve products
    results = []
    for idx in top_k_indices:
        product_id = PRODUCT_IDS[idx.item()]
        product = await get_product(product_id)
        results.append({
            "id": product_id,
            "similarity": similarities[idx].item(),  # 0-1 score
            "name": product.name,
            "price": product.price,
            "image": product.image_url
        })
    
    return {"results": results}
```

**Response example**:
```json
{
  "results": [
    {
      "id": 42,
      "similarity": 0.92,
      "name": "Jean Bleu Slim Similaire",
      "price": 79.99,
      "image": "https://cdn.barsha.tn/prod/42.jpg"
    },
    {
      "id": 45,
      "similarity": 0.88,
      "name": "Jean Bleu Skinny",
      "price": 65.00,
      "image": "https://cdn.barsha.tn/prod/45.jpg"
    }
  ]
}
```

---

## SUMMARY CHECKLIST

### Frontend Angular ✅
- [ ] Home page hero section
- [ ] Product catalog with filters
- [ ] Product detail page
- [ ] Shopping cart
- [ ] Auth flow (register/login)
- [ ] Checkout 4-step process
- [ ] Order tracking
- [ ] Admin dashboard
- [ ] User profile/account
- [ ] AI chatbot widget
- [ ] Visual search integration

### Backend NestJS ✅
- [ ] JWT authentication
- [ ] Product CRUD
- [ ] Order management
- [ ] Payment integration
- [ ] Admin routes
- [ ] Reviews & ratings
- [ ] Wishlist
- [ ] Notifications
- [ ] Analytics tracking
- [ ] Database schema

### Backend AI (FastAPI) ✅
- [ ] Chatbot endpoint
- [ ] Visual search (CLIP)
- [ ] Recommendation engines
- [ ] LLM integration (Qwen/Gemini)
- [ ] Meilisearch grounding
- [ ] Health checks
- [ ] Context management

---

**End of detailed module specifications**
