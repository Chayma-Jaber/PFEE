"""
FAQ Models
Help center FAQs and categories
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class FAQCategory(Base):
    """FAQ category model"""
    __tablename__ = "faq_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    name_en = Column(String(100), nullable=True)  # English translation
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True)  # Icon class
    order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    faqs = relationship("FAQ", back_populates="category", cascade="all, delete-orphan")

    def to_dict(self, include_faqs=False):
        data = {
            "id": self.id,
            "name": self.name,
            "nameEn": self.name_en,
            "slug": self.slug,
            "description": self.description,
            "icon": self.icon,
            "order": self.order,
            "isActive": self.is_active,
            "faqCount": len([f for f in self.faqs if f.is_active]) if self.faqs else 0
        }
        if include_faqs:
            data["faqs"] = [f.to_dict() for f in self.faqs if f.is_active]
        return data


class FAQ(Base):
    """FAQ item model"""
    __tablename__ = "faqs"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("faq_categories.id", ondelete="CASCADE"), nullable=False)

    # Content
    question = Column(String(500), nullable=False)
    question_en = Column(String(500), nullable=True)
    answer = Column(Text, nullable=False)
    answer_en = Column(Text, nullable=True)

    # Metadata
    order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)  # Show on main help page

    # Analytics
    view_count = Column(Integer, default=0)
    helpful_yes = Column(Integer, default=0)
    helpful_no = Column(Integer, default=0)

    # Search keywords
    keywords = Column(String(500), nullable=True)  # Comma-separated

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    category = relationship("FAQCategory", back_populates="faqs")

    @property
    def helpfulness_score(self) -> float:
        """Calculate helpfulness percentage"""
        total = self.helpful_yes + self.helpful_no
        if total == 0:
            return 0.0
        return round((self.helpful_yes / total) * 100, 1)

    def to_dict(self):
        return {
            "id": self.id,
            "categoryId": self.category_id,
            "question": self.question,
            "questionEn": self.question_en,
            "answer": self.answer,
            "answerEn": self.answer_en,
            "order": self.order,
            "isActive": self.is_active,
            "isFeatured": self.is_featured,
            "viewCount": self.view_count,
            "helpfulYes": self.helpful_yes,
            "helpfulNo": self.helpful_no,
            "helpfulnessScore": self.helpfulness_score,
            "keywords": self.keywords.split(",") if self.keywords else [],
            "categoryName": self.category.name if self.category else None,
            "categorySlug": self.category.slug if self.category else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }
