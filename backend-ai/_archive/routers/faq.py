"""
FAQ Router
Help center and FAQ management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.faq import FAQCategory, FAQ
from app.models.user import User
from app.routers.auth import get_current_admin

router = APIRouter(prefix="/help", tags=["Help Center"])
admin_router = APIRouter(prefix="/admin/faq", tags=["Admin FAQ"])


# ========================
# Public Endpoints
# ========================

@router.get("/categories")
def get_categories(
    db: Session = Depends(get_db)
):
    """Get all active FAQ categories"""
    categories = db.query(FAQCategory).filter(
        FAQCategory.is_active == True
    ).order_by(FAQCategory.order).all()

    return {
        "categories": [c.to_dict(include_faqs=False) for c in categories]
    }


@router.get("/category/{slug}")
def get_category_with_faqs(
    slug: str,
    db: Session = Depends(get_db)
):
    """Get a category with its FAQs"""
    category = db.query(FAQCategory).filter(
        FAQCategory.slug == slug,
        FAQCategory.is_active == True
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    return category.to_dict(include_faqs=True)


@router.get("/featured")
def get_featured_faqs(
    limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db)
):
    """Get featured FAQs for homepage"""
    faqs = db.query(FAQ).filter(
        FAQ.is_active == True,
        FAQ.is_featured == True
    ).order_by(FAQ.order).limit(limit).all()

    return {
        "faqs": [f.to_dict() for f in faqs]
    }


@router.get("/search")
def search_faqs(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db)
):
    """Search FAQs"""
    search_term = f"%{q}%"

    faqs = db.query(FAQ).join(FAQCategory).filter(
        FAQ.is_active == True,
        FAQCategory.is_active == True,
        or_(
            FAQ.question.ilike(search_term),
            FAQ.answer.ilike(search_term),
            FAQ.keywords.ilike(search_term)
        )
    ).order_by(FAQ.view_count.desc()).limit(20).all()

    return {
        "query": q,
        "results": [f.to_dict() for f in faqs],
        "count": len(faqs)
    }


@router.get("/faq/{faq_id}")
def get_faq(
    faq_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific FAQ and increment view count"""
    faq = db.query(FAQ).filter(
        FAQ.id == faq_id,
        FAQ.is_active == True
    ).first()

    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")

    # Increment view count
    faq.view_count += 1
    db.commit()

    return faq.to_dict()


@router.post("/faq/{faq_id}/helpful")
def mark_faq_helpful(
    faq_id: int,
    helpful: bool = True,
    db: Session = Depends(get_db)
):
    """Mark FAQ as helpful or not"""
    faq = db.query(FAQ).filter(
        FAQ.id == faq_id,
        FAQ.is_active == True
    ).first()

    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")

    if helpful:
        faq.helpful_yes += 1
    else:
        faq.helpful_no += 1
    db.commit()

    return {"success": True, "helpfulnessScore": faq.helpfulness_score}


@router.get("/all")
def get_all_faqs(
    db: Session = Depends(get_db)
):
    """Get all FAQs grouped by category"""
    categories = db.query(FAQCategory).filter(
        FAQCategory.is_active == True
    ).order_by(FAQCategory.order).all()

    return {
        "categories": [c.to_dict(include_faqs=True) for c in categories]
    }


# ========================
# Admin Endpoints
# ========================

class CreateCategoryRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    name_en: Optional[str] = None
    slug: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = None
    order: int = 0


class CreateFAQRequest(BaseModel):
    category_id: int
    question: str = Field(..., min_length=5, max_length=500)
    question_en: Optional[str] = None
    answer: str = Field(..., min_length=10)
    answer_en: Optional[str] = None
    order: int = 0
    is_featured: bool = False
    keywords: Optional[str] = None


@admin_router.get("/categories")
def admin_get_categories(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get all categories (including inactive)"""
    categories = db.query(FAQCategory).order_by(FAQCategory.order).all()
    return {
        "categories": [c.to_dict(include_faqs=True) for c in categories]
    }


@admin_router.post("/categories")
def admin_create_category(
    request: CreateCategoryRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Create a new FAQ category"""
    # Check if slug exists
    existing = db.query(FAQCategory).filter(FAQCategory.slug == request.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Slug already exists")

    category = FAQCategory(
        name=request.name,
        name_en=request.name_en,
        slug=request.slug,
        description=request.description,
        icon=request.icon,
        order=request.order
    )
    db.add(category)
    db.commit()
    db.refresh(category)

    return {"success": True, "category": category.to_dict()}


@admin_router.put("/categories/{category_id}")
def admin_update_category(
    category_id: int,
    request: CreateCategoryRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Update a FAQ category"""
    category = db.query(FAQCategory).filter(FAQCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check slug uniqueness
    existing = db.query(FAQCategory).filter(
        FAQCategory.slug == request.slug,
        FAQCategory.id != category_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Slug already exists")

    category.name = request.name
    category.name_en = request.name_en
    category.slug = request.slug
    category.description = request.description
    category.icon = request.icon
    category.order = request.order
    category.updated_at = datetime.utcnow()
    db.commit()

    return {"success": True, "category": category.to_dict()}


@admin_router.delete("/categories/{category_id}")
def admin_delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Delete a FAQ category"""
    category = db.query(FAQCategory).filter(FAQCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(category)
    db.commit()

    return {"success": True}


@admin_router.post("/categories/{category_id}/toggle")
def admin_toggle_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Toggle category active status"""
    category = db.query(FAQCategory).filter(FAQCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    category.is_active = not category.is_active
    db.commit()

    return {"success": True, "isActive": category.is_active}


@admin_router.get("/faqs")
def admin_get_faqs(
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get all FAQs"""
    query = db.query(FAQ)
    if category_id:
        query = query.filter(FAQ.category_id == category_id)

    faqs = query.order_by(FAQ.category_id, FAQ.order).all()
    return {
        "faqs": [f.to_dict() for f in faqs]
    }


@admin_router.post("/faqs")
def admin_create_faq(
    request: CreateFAQRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Create a new FAQ"""
    # Verify category exists
    category = db.query(FAQCategory).filter(FAQCategory.id == request.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    faq = FAQ(
        category_id=request.category_id,
        question=request.question,
        question_en=request.question_en,
        answer=request.answer,
        answer_en=request.answer_en,
        order=request.order,
        is_featured=request.is_featured,
        keywords=request.keywords
    )
    db.add(faq)
    db.commit()
    db.refresh(faq)

    return {"success": True, "faq": faq.to_dict()}


@admin_router.put("/faqs/{faq_id}")
def admin_update_faq(
    faq_id: int,
    request: CreateFAQRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Update a FAQ"""
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")

    faq.category_id = request.category_id
    faq.question = request.question
    faq.question_en = request.question_en
    faq.answer = request.answer
    faq.answer_en = request.answer_en
    faq.order = request.order
    faq.is_featured = request.is_featured
    faq.keywords = request.keywords
    faq.updated_at = datetime.utcnow()
    db.commit()

    return {"success": True, "faq": faq.to_dict()}


@admin_router.delete("/faqs/{faq_id}")
def admin_delete_faq(
    faq_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Delete a FAQ"""
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")

    db.delete(faq)
    db.commit()

    return {"success": True}


@admin_router.post("/faqs/{faq_id}/toggle")
def admin_toggle_faq(
    faq_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Toggle FAQ active status"""
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")

    faq.is_active = not faq.is_active
    db.commit()

    return {"success": True, "isActive": faq.is_active}


@admin_router.post("/faqs/{faq_id}/feature")
def admin_toggle_featured(
    faq_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Toggle FAQ featured status"""
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")

    faq.is_featured = not faq.is_featured
    db.commit()

    return {"success": True, "isFeatured": faq.is_featured}


# ========================
# Seed Default Data
# ========================

def seed_default_faqs(db: Session):
    """Seed default FAQ data if none exists"""
    if db.query(FAQCategory).count() > 0:
        return

    # Create categories
    categories_data = [
        {
            "name": "Commandes et Livraison",
            "slug": "commandes-livraison",
            "icon": "bi-truck",
            "order": 1,
            "description": "Questions sur les commandes et la livraison"
        },
        {
            "name": "Paiement",
            "slug": "paiement",
            "icon": "bi-credit-card",
            "order": 2,
            "description": "Questions sur les m\u00e9thodes de paiement"
        },
        {
            "name": "Retours et Remboursements",
            "slug": "retours-remboursements",
            "icon": "bi-arrow-return-left",
            "order": 3,
            "description": "Questions sur les retours et remboursements"
        },
        {
            "name": "Mon Compte",
            "slug": "mon-compte",
            "icon": "bi-person",
            "order": 4,
            "description": "Questions sur votre compte"
        },
        {
            "name": "Produits",
            "slug": "produits",
            "icon": "bi-box",
            "order": 5,
            "description": "Questions sur nos produits"
        }
    ]

    for cat_data in categories_data:
        category = FAQCategory(**cat_data)
        db.add(category)

    db.flush()

    # Create FAQs
    faqs_data = [
        {
            "category_slug": "commandes-livraison",
            "question": "Comment puis-je suivre ma commande ?",
            "answer": "Vous pouvez suivre votre commande dans la section 'Mes commandes' de votre compte. Vous recevrez \u00e9galement un email avec le num\u00e9ro de suivi d\u00e8s que votre colis sera exp\u00e9di\u00e9.",
            "is_featured": True,
            "order": 1
        },
        {
            "category_slug": "commandes-livraison",
            "question": "Quels sont les d\u00e9lais de livraison ?",
            "answer": "Les d\u00e9lais de livraison sont g\u00e9n\u00e9ralement de 2 \u00e0 5 jours ouvrables pour les zones couvertes. Pour les zones \u00e9loign\u00e9es, le d\u00e9lai peut aller jusqu'\u00e0 7 jours ouvrables.",
            "is_featured": True,
            "order": 2
        },
        {
            "category_slug": "commandes-livraison",
            "question": "Puis-je modifier ma commande apr\u00e8s l'avoir pass\u00e9e ?",
            "answer": "Vous pouvez modifier votre commande uniquement si elle n'a pas encore \u00e9t\u00e9 exp\u00e9di\u00e9e. Contactez notre service client le plus rapidement possible.",
            "order": 3
        },
        {
            "category_slug": "paiement",
            "question": "Quels modes de paiement acceptez-vous ?",
            "answer": "Nous acceptons le paiement par carte bancaire (via CTP) et le paiement \u00e0 la livraison (COD) pour certaines zones.",
            "is_featured": True,
            "order": 1
        },
        {
            "category_slug": "paiement",
            "question": "Le paiement en ligne est-il s\u00e9curis\u00e9 ?",
            "answer": "Oui, tous nos paiements sont trait\u00e9s via des plateformes s\u00e9curis\u00e9es avec cryptage SSL. Vos donn\u00e9es bancaires ne sont jamais stock\u00e9es sur nos serveurs.",
            "order": 2
        },
        {
            "category_slug": "retours-remboursements",
            "question": "Quelle est votre politique de retour ?",
            "answer": "Vous disposez de 14 jours apr\u00e8s r\u00e9ception pour retourner un article non port\u00e9, avec ses \u00e9tiquettes. Le remboursement sera effectu\u00e9 sous 7 jours apr\u00e8s r\u00e9ception du retour.",
            "is_featured": True,
            "order": 1
        },
        {
            "category_slug": "retours-remboursements",
            "question": "Comment demander un remboursement ?",
            "answer": "Connectez-vous \u00e0 votre compte, acc\u00e9dez \u00e0 'Mes commandes', s\u00e9lectionnez la commande concern\u00e9e et cliquez sur 'Demander un retour'. Vous pouvez \u00e9galement contacter notre support.",
            "order": 2
        },
        {
            "category_slug": "mon-compte",
            "question": "Comment cr\u00e9er un compte ?",
            "answer": "Cliquez sur 'Connexion' puis 'Cr\u00e9er un compte'. Remplissez le formulaire avec vos informations et validez votre email.",
            "order": 1
        },
        {
            "category_slug": "mon-compte",
            "question": "J'ai oubli\u00e9 mon mot de passe, que faire ?",
            "answer": "Sur la page de connexion, cliquez sur 'Mot de passe oubli\u00e9'. Entrez votre email et vous recevrez un lien pour r\u00e9initialiser votre mot de passe.",
            "is_featured": True,
            "order": 2
        },
        {
            "category_slug": "produits",
            "question": "Comment conna\u00eetre ma taille ?",
            "answer": "Consultez notre guide des tailles disponible sur chaque fiche produit. Vous y trouverez les mesures d\u00e9taill\u00e9es pour choisir la taille adapt\u00e9e.",
            "order": 1
        },
        {
            "category_slug": "produits",
            "question": "Les couleurs sont-elles fid\u00e8les aux photos ?",
            "answer": "Nous faisons notre maximum pour repr\u00e9senter fid\u00e8lement les couleurs. Cependant, de l\u00e9g\u00e8res variations peuvent exister selon les param\u00e8tres de votre \u00e9cran.",
            "order": 2
        }
    ]

    for faq_data in faqs_data:
        category_slug = faq_data.pop("category_slug")
        category = db.query(FAQCategory).filter(FAQCategory.slug == category_slug).first()
        if category:
            faq = FAQ(category_id=category.id, **faq_data)
            db.add(faq)

    db.commit()
