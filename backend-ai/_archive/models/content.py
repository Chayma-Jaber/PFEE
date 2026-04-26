"""
Content Models
CMS for homepage, banners, and promotions
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from datetime import datetime

from app.core.database import Base


class HomeContent(Base):
    """Homepage content configuration"""
    __tablename__ = "home_content"

    id = Column(Integer, primary_key=True, index=True)
    section = Column(String(50), unique=True, nullable=False)  # hero, featured, promo, etc.

    # Content
    title = Column(String(255), nullable=True)
    subtitle = Column(String(500), nullable=True)
    content = Column(Text, nullable=True)

    # Media
    image_url = Column(String(500), nullable=True)
    mobile_image_url = Column(String(500), nullable=True)
    video_url = Column(String(500), nullable=True)

    # Links
    link_url = Column(String(500), nullable=True)
    link_text = Column(String(100), nullable=True)

    # Configuration
    config = Column(JSON, nullable=True)  # Additional configuration

    # Display
    position = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "section": self.section,
            "title": self.title,
            "subtitle": self.subtitle,
            "content": self.content,
            "imageUrl": self.image_url,
            "mobileImageUrl": self.mobile_image_url,
            "videoUrl": self.video_url,
            "linkUrl": self.link_url,
            "linkText": self.link_text,
            "config": self.config,
            "position": self.position,
            "isActive": self.is_active
        }


class Banner(Base):
    """Banner model for hero sections and promotions"""
    __tablename__ = "banners"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(50), nullable=False)  # home_hero, category_top, etc.

    # Content
    title = Column(String(255), nullable=True)
    subtitle = Column(String(500), nullable=True)
    text_color = Column(String(20), default="#000000")
    background_color = Column(String(20), nullable=True)

    # Media
    desktop_image_url = Column(String(500), nullable=True)
    mobile_image_url = Column(String(500), nullable=True)

    # CTA
    cta_text = Column(String(100), nullable=True)
    cta_url = Column(String(500), nullable=True)
    cta_color = Column(String(20), nullable=True)

    # Display
    position = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    # Schedule
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def is_visible(self) -> bool:
        """Check if banner should be displayed"""
        if not self.is_active:
            return False
        now = datetime.utcnow()
        if self.starts_at and now < self.starts_at:
            return False
        if self.ends_at and now > self.ends_at:
            return False
        return True

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "location": self.location,
            "title": self.title,
            "subtitle": self.subtitle,
            "textColor": self.text_color,
            "backgroundColor": self.background_color,
            "desktopImageUrl": self.desktop_image_url,
            "mobileImageUrl": self.mobile_image_url,
            "ctaText": self.cta_text,
            "ctaUrl": self.cta_url,
            "ctaColor": self.cta_color,
            "position": self.position,
            "isActive": self.is_active,
            "isVisible": self.is_visible,
            "startsAt": self.starts_at.isoformat() if self.starts_at else None,
            "endsAt": self.ends_at.isoformat() if self.ends_at else None
        }


class PromoSection(Base):
    """Promotional section for campaigns"""
    __tablename__ = "promo_sections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)

    # Content
    text = Column(String(500), nullable=False)
    sub_text = Column(String(500), nullable=True)

    # Style
    bg_color = Column(String(20), default="#000000")
    text_color = Column(String(20), default="#ffffff")

    # Button
    btn_text = Column(String(100), nullable=True)
    btn_link = Column(String(500), nullable=True)
    btn_bg_color = Column(String(20), nullable=True)
    btn_text_color = Column(String(20), nullable=True)

    # Display
    position = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    # Schedule
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "text": self.text,
            "subText": self.sub_text,
            "bgColor": self.bg_color,
            "textColor": self.text_color,
            "btnText": self.btn_text,
            "btnLink": self.btn_link,
            "btnBgColor": self.btn_bg_color,
            "btnTextColor": self.btn_text_color,
            "position": self.position,
            "isActive": self.is_active
        }
