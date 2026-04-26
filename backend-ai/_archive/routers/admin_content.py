"""
Admin Content Router
CMS for homepage, banners, and promotions
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.core.database import get_db
from app.core.security import require_marketing_manager
from app.models.content import HomeContent, Banner, PromoSection
from app.models.admin_log import log_admin_activity

router = APIRouter(prefix="/admin/content", tags=["Admin Content"])


# Home Content
@router.get("/home")
async def list_home_content(
    _: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """List all home content sections"""
    contents = db.query(HomeContent).order_by(HomeContent.position).all()
    return [c.to_dict() for c in contents]


@router.get("/home/{section}")
async def get_home_section(
    section: str,
    _: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Get specific home content section"""
    content = db.query(HomeContent).filter(HomeContent.section == section).first()
    if not content:
        raise HTTPException(status_code=404, detail="Section not found")
    return content.to_dict()


@router.put("/home/{section}")
async def update_home_section(
    section: str,
    data: dict,
    request: Request,
    payload: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Update or create home content section"""
    content = db.query(HomeContent).filter(HomeContent.section == section).first()

    if not content:
        content = HomeContent(section=section)
        db.add(content)

    for field in ["title", "subtitle", "content", "image_url", "mobile_image_url",
                  "video_url", "link_url", "link_text", "config", "position", "is_active"]:
        if field in data:
            setattr(content, field, data[field])

    content.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(content)

    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="update_home_content",
        resource_type="content",
        resource_id=content.id,
        resource_reference=section,
        ip_address=request.client.host if request.client else None
    )

    return content.to_dict()


# Banners
@router.get("/banners")
async def list_banners(
    location: Optional[str] = None,
    is_active: Optional[bool] = None,
    _: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """List all banners"""
    query = db.query(Banner)

    if location:
        query = query.filter(Banner.location == location)

    if is_active is not None:
        query = query.filter(Banner.is_active == is_active)

    banners = query.order_by(Banner.position).all()
    return [b.to_dict() for b in banners]


@router.get("/banners/{banner_id}")
async def get_banner(
    banner_id: int,
    _: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Get banner details"""
    banner = db.query(Banner).filter(Banner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
    return banner.to_dict()


@router.post("/banners")
async def create_banner(
    data: dict,
    request: Request,
    payload: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Create a new banner"""
    banner = Banner(
        name=data.get("name"),
        location=data.get("location"),
        title=data.get("title"),
        subtitle=data.get("subtitle"),
        text_color=data.get("textColor", "#000000"),
        background_color=data.get("backgroundColor"),
        desktop_image_url=data.get("desktopImageUrl"),
        mobile_image_url=data.get("mobileImageUrl"),
        cta_text=data.get("ctaText"),
        cta_url=data.get("ctaUrl"),
        cta_color=data.get("ctaColor"),
        position=data.get("position", 0),
        is_active=data.get("isActive", True),
        starts_at=datetime.fromisoformat(data["startsAt"]) if data.get("startsAt") else None,
        ends_at=datetime.fromisoformat(data["endsAt"]) if data.get("endsAt") else None
    )

    db.add(banner)
    db.commit()
    db.refresh(banner)

    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="create_banner",
        resource_type="banner",
        resource_id=banner.id,
        resource_reference=banner.name,
        ip_address=request.client.host if request.client else None
    )

    return banner.to_dict()


@router.put("/banners/{banner_id}")
async def update_banner(
    banner_id: int,
    data: dict,
    request: Request,
    payload: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Update a banner"""
    banner = db.query(Banner).filter(Banner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")

    field_mapping = {
        "name": "name",
        "location": "location",
        "title": "title",
        "subtitle": "subtitle",
        "textColor": "text_color",
        "backgroundColor": "background_color",
        "desktopImageUrl": "desktop_image_url",
        "mobileImageUrl": "mobile_image_url",
        "ctaText": "cta_text",
        "ctaUrl": "cta_url",
        "ctaColor": "cta_color",
        "position": "position",
        "isActive": "is_active"
    }

    for json_field, db_field in field_mapping.items():
        if json_field in data:
            setattr(banner, db_field, data[json_field])

    if "startsAt" in data:
        banner.starts_at = datetime.fromisoformat(data["startsAt"]) if data["startsAt"] else None
    if "endsAt" in data:
        banner.ends_at = datetime.fromisoformat(data["endsAt"]) if data["endsAt"] else None

    banner.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(banner)

    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="update_banner",
        resource_type="banner",
        resource_id=banner.id,
        resource_reference=banner.name,
        ip_address=request.client.host if request.client else None
    )

    return banner.to_dict()


@router.delete("/banners/{banner_id}")
async def delete_banner(
    banner_id: int,
    request: Request,
    payload: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Delete a banner"""
    banner = db.query(Banner).filter(Banner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")

    db.delete(banner)
    db.commit()

    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="delete_banner",
        resource_type="banner",
        resource_id=banner_id,
        ip_address=request.client.host if request.client else None
    )

    return {"message": "Banner deleted successfully"}


# Promo Sections
@router.get("/promos")
async def list_promos(
    is_active: Optional[bool] = None,
    _: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """List all promo sections"""
    query = db.query(PromoSection)

    if is_active is not None:
        query = query.filter(PromoSection.is_active == is_active)

    promos = query.order_by(PromoSection.position).all()
    return [p.to_dict() for p in promos]


@router.post("/promos")
async def create_promo(
    data: dict,
    request: Request,
    payload: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Create a new promo section"""
    promo = PromoSection(
        name=data.get("name"),
        text=data.get("text"),
        sub_text=data.get("subText"),
        bg_color=data.get("bgColor", "#000000"),
        text_color=data.get("textColor", "#ffffff"),
        btn_text=data.get("btnText"),
        btn_link=data.get("btnLink"),
        btn_bg_color=data.get("btnBgColor"),
        btn_text_color=data.get("btnTextColor"),
        position=data.get("position", 0),
        is_active=data.get("isActive", True),
        starts_at=datetime.fromisoformat(data["startsAt"]) if data.get("startsAt") else None,
        ends_at=datetime.fromisoformat(data["endsAt"]) if data.get("endsAt") else None
    )

    db.add(promo)
    db.commit()
    db.refresh(promo)

    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="create_promo",
        resource_type="promo",
        resource_id=promo.id,
        resource_reference=promo.name,
        ip_address=request.client.host if request.client else None
    )

    return promo.to_dict()


@router.put("/promos/{promo_id}")
async def update_promo(
    promo_id: int,
    data: dict,
    request: Request,
    payload: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Update a promo section"""
    promo = db.query(PromoSection).filter(PromoSection.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promo section not found")

    field_mapping = {
        "name": "name",
        "text": "text",
        "subText": "sub_text",
        "bgColor": "bg_color",
        "textColor": "text_color",
        "btnText": "btn_text",
        "btnLink": "btn_link",
        "btnBgColor": "btn_bg_color",
        "btnTextColor": "btn_text_color",
        "position": "position",
        "isActive": "is_active"
    }

    for json_field, db_field in field_mapping.items():
        if json_field in data:
            setattr(promo, db_field, data[json_field])

    promo.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(promo)

    return promo.to_dict()


@router.delete("/promos/{promo_id}")
async def delete_promo(
    promo_id: int,
    request: Request,
    payload: dict = Depends(require_marketing_manager),
    db: Session = Depends(get_db)
):
    """Delete a promo section"""
    promo = db.query(PromoSection).filter(PromoSection.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promo section not found")

    db.delete(promo)
    db.commit()

    log_admin_activity(
        db=db,
        user_id=int(payload.get("sub")),
        action="delete_promo",
        resource_type="promo",
        resource_id=promo_id,
        ip_address=request.client.host if request.client else None
    )

    return {"message": "Promo section deleted successfully"}
