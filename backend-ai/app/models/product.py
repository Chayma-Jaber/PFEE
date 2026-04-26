"""
Product Models
Products, categories, variants, and images
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


# Many-to-many relationship table for product categories
product_categories = Table(
    'product_categories',
    Base.metadata,
    Column('product_id', Integer, ForeignKey('products.id', ondelete='CASCADE'), primary_key=True),
    Column('category_id', Integer, ForeignKey('categories.id', ondelete='CASCADE'), primary_key=True)
)

# Many-to-many relationship table for related products
related_products = Table(
    'related_products',
    Base.metadata,
    Column('product_id', Integer, ForeignKey('products.id', ondelete='CASCADE'), primary_key=True),
    Column('related_id', Integer, ForeignKey('products.id', ondelete='CASCADE'), primary_key=True)
)


class Category(Base):
    """Category model"""
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    # Media
    image_url = Column(String(500), nullable=True)
    banner_url = Column(String(500), nullable=True)

    # Display
    position = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)

    # SEO
    meta_title = Column(String(255), nullable=True)
    meta_description = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    parent = relationship("Category", remote_side=[id], backref="children")
    products = relationship("Product", secondary=product_categories, back_populates="categories")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "parentId": self.parent_id,
            "imageUrl": self.image_url,
            "bannerUrl": self.banner_url,
            "position": self.position,
            "isActive": self.is_active,
            "isFeatured": self.is_featured
        }


class Product(Base):
    """Product model"""
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    short_description = Column(String(500), nullable=True)

    # Pricing
    price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=False)
    cost_price = Column(Float, nullable=True)  # For profit calculation
    discount = Column(Boolean, default=False)
    discount_value = Column(Integer, default=0)  # Percentage

    # Classification
    famille = Column(String(50), nullable=True)  # MEN, WOMEN, KIDS, etc.
    ligne = Column(String(100), nullable=True)
    persona = Column(String(50), nullable=True)

    # Inventory (aggregated from variants)
    total_stock = Column(Integer, default=0)

    # Flags
    is_active = Column(Boolean, default=True)
    is_available = Column(Boolean, default=True)
    is_new = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)
    is_bestseller = Column(Boolean, default=False)

    # Media
    first_image_url = Column(String(500), nullable=True)
    second_image_url = Column(String(500), nullable=True)

    # SEO
    meta_title = Column(String(255), nullable=True)
    meta_description = Column(Text, nullable=True)
    meta_keywords = Column(String(500), nullable=True)

    # Composition
    composition = Column(Text, nullable=True)

    # Analytics
    view_count = Column(Integer, default=0)
    order_count = Column(Integer, default=0)

    # External reference (for sync with Barsha API)
    external_id = Column(Integer, nullable=True, index=True)
    id_origin = Column(Integer, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)

    # Relationships
    categories = relationship("Category", secondary=product_categories, back_populates="products")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")
    related = relationship(
        "Product",
        secondary=related_products,
        primaryjoin=id == related_products.c.product_id,
        secondaryjoin=id == related_products.c.related_id,
        backref="related_to"
    )

    def to_dict(self, include_variants=True):
        data = {
            "id": self.id,
            "sku": self.sku,
            "title": self.title,
            "slug": self.slug,
            "description": self.description,
            "shortDescription": self.short_description,
            "price": self.price,
            "currentPrice": self.current_price,
            "discount": self.discount,
            "discountValue": self.discount_value,
            "famille": self.famille,
            "isActive": self.is_active,
            "isAvailable": self.is_available,
            "isNew": self.is_new,
            "isFeatured": self.is_featured,
            "isBestseller": self.is_bestseller,
            "firstImageUrl": self.first_image_url,
            "totalStock": self.total_stock,
            "viewCount": self.view_count,
            "orderCount": self.order_count,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
        if include_variants:
            data["variants"] = [v.to_dict() for v in self.variants]
            data["categories"] = [c.to_dict() for c in self.categories]
        return data


class ProductVariant(Base):
    """Product variant model (color/size combinations)"""
    __tablename__ = "product_variants"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)

    # Variant details
    color = Column(String(50), nullable=True)
    color_code = Column(String(20), nullable=True)  # Hex color
    texture_url = Column(String(500), nullable=True)
    size = Column(String(20), nullable=True)
    ean13 = Column(String(20), nullable=True, index=True)

    # Stock
    quantity = Column(Integer, default=0)
    reserved_quantity = Column(Integer, default=0)  # In carts/pending orders
    low_stock_threshold = Column(Integer, default=5)

    # Pricing (if variant-specific)
    price_adjustment = Column(Float, default=0)

    # Status
    is_active = Column(Boolean, default=True)

    # External reference
    external_id = Column(Integer, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    product = relationship("Product", back_populates="variants")
    images = relationship("ProductImage", back_populates="variant")

    @property
    def available_quantity(self) -> int:
        return max(0, self.quantity - self.reserved_quantity)

    @property
    def is_in_stock(self) -> bool:
        return self.available_quantity > 0

    @property
    def is_low_stock(self) -> bool:
        return 0 < self.available_quantity <= self.low_stock_threshold

    def to_dict(self):
        return {
            "id": self.id,
            "color": self.color,
            "colorCode": self.color_code,
            "textureUrl": self.texture_url,
            "size": self.size,
            "ean13": self.ean13,
            "quantity": self.quantity,
            "availableQuantity": self.available_quantity,
            "isInStock": self.is_in_stock,
            "isLowStock": self.is_low_stock,
            "isActive": self.is_active
        }


class ProductImage(Base):
    """Product image model"""
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(Integer, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)

    url = Column(String(500), nullable=False)
    alt_text = Column(String(255), nullable=True)
    position = Column(Integer, default=0)
    is_primary = Column(Boolean, default=False)

    # Image sizes
    thumbnail_url = Column(String(500), nullable=True)
    medium_url = Column(String(500), nullable=True)
    large_url = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    product = relationship("Product", back_populates="images")
    variant = relationship("ProductVariant", back_populates="images")

    def to_dict(self):
        return {
            "id": self.id,
            "url": self.url,
            "altText": self.alt_text,
            "position": self.position,
            "isPrimary": self.is_primary,
            "thumbnailUrl": self.thumbnail_url,
            "mediumUrl": self.medium_url,
            "largeUrl": self.large_url
        }
