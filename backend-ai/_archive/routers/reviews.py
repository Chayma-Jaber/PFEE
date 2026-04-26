"""
Product Reviews Router
======================
API endpoints for product reviews and ratings.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.models.user import User
from app.models.product_review import ProductReview, ReviewVote, ProductRatingStats
from app.routers.auth import get_current_user, get_current_user_optional

# Create routers
router = APIRouter(prefix="/api/reviews", tags=["Product Reviews"])
admin_router = APIRouter(prefix="/api/admin/reviews", tags=["Admin Reviews"])


# ========================
# Pydantic Schemas
# ========================

class CreateReviewRequest(BaseModel):
    product_id: int = Field(..., alias="productId")
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=255)
    comment: Optional[str] = None
    is_recommended: bool = Field(True, alias="isRecommended")
    fit_rating: Optional[str] = Field(None, alias="fitRating")
    images: Optional[List[str]] = None

    class Config:
        populate_by_name = True


class UpdateReviewRequest(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    title: Optional[str] = Field(None, max_length=255)
    comment: Optional[str] = None
    is_recommended: Optional[bool] = Field(None, alias="isRecommended")
    fit_rating: Optional[str] = Field(None, alias="fitRating")

    class Config:
        populate_by_name = True


class VoteRequest(BaseModel):
    is_helpful: bool = Field(..., alias="isHelpful")

    class Config:
        populate_by_name = True


class AdminModerateRequest(BaseModel):
    is_approved: bool = Field(..., alias="isApproved")
    moderation_note: Optional[str] = Field(None, alias="moderationNote", max_length=500)
    is_featured: Optional[bool] = Field(None, alias="isFeatured")

    class Config:
        populate_by_name = True


class AdminResponseRequest(BaseModel):
    response: str = Field(..., min_length=10, max_length=2000)


# ========================
# Helper Functions
# ========================

def update_product_stats(db: Session, product_id: int):
    """Recalculate and update product rating statistics."""
    # Get approved reviews for this product
    reviews = db.query(ProductReview).filter(
        ProductReview.product_id == product_id,
        ProductReview.is_approved == True
    ).all()

    # Get or create stats record
    stats = db.query(ProductRatingStats).filter(
        ProductRatingStats.product_id == product_id
    ).first()

    if not stats:
        stats = ProductRatingStats(product_id=product_id)
        db.add(stats)

    # Calculate stats
    total = len(reviews)
    stats.total_reviews = total

    if total == 0:
        stats.average_rating = 0.0
        stats.rating_1_count = 0
        stats.rating_2_count = 0
        stats.rating_3_count = 0
        stats.rating_4_count = 0
        stats.rating_5_count = 0
        stats.verified_reviews = 0
        stats.recommendation_rate = 0.0
        stats.fit_small_count = 0
        stats.fit_true_count = 0
        stats.fit_large_count = 0
    else:
        # Rating distribution
        stats.rating_1_count = sum(1 for r in reviews if r.rating == 1)
        stats.rating_2_count = sum(1 for r in reviews if r.rating == 2)
        stats.rating_3_count = sum(1 for r in reviews if r.rating == 3)
        stats.rating_4_count = sum(1 for r in reviews if r.rating == 4)
        stats.rating_5_count = sum(1 for r in reviews if r.rating == 5)

        # Average rating
        stats.average_rating = sum(r.rating for r in reviews) / total

        # Verified purchases
        stats.verified_reviews = sum(1 for r in reviews if r.is_verified_purchase)

        # Recommendation rate
        recommending = sum(1 for r in reviews if r.is_recommended)
        stats.recommendation_rate = (recommending / total) * 100

        # Fit distribution
        stats.fit_small_count = sum(1 for r in reviews if r.fit_rating == 'small')
        stats.fit_true_count = sum(1 for r in reviews if r.fit_rating == 'true_to_size')
        stats.fit_large_count = sum(1 for r in reviews if r.fit_rating == 'large')

    db.commit()


# ========================
# Public Endpoints
# ========================

@router.get("/product/{product_id}")
def get_product_reviews(
    product_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    sort: str = Query("recent", regex="^(recent|helpful|highest|lowest)$"),
    rating_filter: Optional[int] = Query(None, ge=1, le=5, alias="rating"),
    verified_only: bool = Query(False, alias="verifiedOnly"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get reviews for a product with pagination and filtering.
    """
    # Base query - only approved reviews
    query = db.query(ProductReview).filter(
        ProductReview.product_id == product_id,
        ProductReview.is_approved == True
    )

    # Apply filters
    if rating_filter:
        query = query.filter(ProductReview.rating == rating_filter)

    if verified_only:
        query = query.filter(ProductReview.is_verified_purchase == True)

    # Apply sorting
    if sort == "helpful":
        query = query.order_by(desc(ProductReview.helpful_count))
    elif sort == "highest":
        query = query.order_by(desc(ProductReview.rating), desc(ProductReview.created_at))
    elif sort == "lowest":
        query = query.order_by(ProductReview.rating, desc(ProductReview.created_at))
    else:  # recent
        query = query.order_by(desc(ProductReview.created_at))

    # Get total count
    total = query.count()

    # Paginate
    reviews = query.offset((page - 1) * limit).limit(limit).all()

    # Check user's votes if logged in
    user_votes = {}
    if current_user:
        votes = db.query(ReviewVote).filter(
            ReviewVote.user_id == current_user.id,
            ReviewVote.review_id.in_([r.id for r in reviews])
        ).all()
        user_votes = {v.review_id: v.is_helpful for v in votes}

    # Build response
    reviews_data = []
    for review in reviews:
        data = review.to_dict()
        data["userVote"] = user_votes.get(review.id)
        reviews_data.append(data)

    return {
        "reviews": reviews_data,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total > 0 else 0
        }
    }


@router.get("/product/{product_id}/stats")
def get_product_stats(
    product_id: int,
    db: Session = Depends(get_db)
):
    """
    Get aggregated rating statistics for a product.
    """
    stats = db.query(ProductRatingStats).filter(
        ProductRatingStats.product_id == product_id
    ).first()

    if not stats:
        return {
            "productId": product_id,
            "averageRating": 0,
            "totalReviews": 0,
            "ratingDistribution": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0},
            "verifiedReviews": 0,
            "recommendationRate": 0,
            "fitDistribution": {"small": 0, "trueToSize": 0, "large": 0}
        }

    return stats.to_dict()


@router.get("/user/can-review/{product_id}")
def check_can_review(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check if user can review a product (hasn't already reviewed it).
    """
    existing = db.query(ProductReview).filter(
        ProductReview.user_id == current_user.id,
        ProductReview.product_id == product_id
    ).first()

    return {
        "canReview": existing is None,
        "existingReviewId": existing.id if existing else None
    }


@router.post("")
def create_review(
    request: CreateReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new product review.
    """
    # Check for existing review
    existing = db.query(ProductReview).filter(
        ProductReview.user_id == current_user.id,
        ProductReview.product_id == request.product_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vous avez deja laisse un avis pour ce produit"
        )

    # Create review
    review = ProductReview(
        user_id=current_user.id,
        product_id=request.product_id,
        rating=request.rating,
        title=request.title,
        comment=request.comment,
        is_recommended=request.is_recommended,
        fit_rating=request.fit_rating,
        images=",".join(request.images) if request.images else None,
        is_approved=False  # Requires moderation
    )

    db.add(review)
    db.commit()
    db.refresh(review)

    return {
        "success": True,
        "review": review.to_dict(),
        "message": "Merci pour votre avis! Il sera publie apres verification."
    }


@router.put("/{review_id}")
def update_review(
    review_id: int,
    request: UpdateReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update user's own review.
    """
    review = db.query(ProductReview).filter(
        ProductReview.id == review_id,
        ProductReview.user_id == current_user.id
    ).first()

    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Avis non trouve"
        )

    # Apply updates
    if request.rating is not None:
        review.rating = request.rating
    if request.title is not None:
        review.title = request.title
    if request.comment is not None:
        review.comment = request.comment
    if request.is_recommended is not None:
        review.is_recommended = request.is_recommended
    if request.fit_rating is not None:
        review.fit_rating = request.fit_rating

    # Reset approval after edit
    review.is_approved = False
    review.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(review)

    # Update stats if was previously approved
    update_product_stats(db, review.product_id)

    return {
        "success": True,
        "review": review.to_dict(),
        "message": "Avis mis a jour. Il sera re-verifie avant publication."
    }


@router.delete("/{review_id}")
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete user's own review.
    """
    review = db.query(ProductReview).filter(
        ProductReview.id == review_id,
        ProductReview.user_id == current_user.id
    ).first()

    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Avis non trouve"
        )

    product_id = review.product_id
    db.delete(review)
    db.commit()

    # Update stats
    update_product_stats(db, product_id)

    return {
        "success": True,
        "message": "Avis supprime"
    }


@router.post("/{review_id}/vote")
def vote_on_review(
    review_id: int,
    request: VoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Vote on a review as helpful or not helpful.
    """
    review = db.query(ProductReview).filter(
        ProductReview.id == review_id,
        ProductReview.is_approved == True
    ).first()

    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Avis non trouve"
        )

    # Can't vote on own review
    if review.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas voter pour votre propre avis"
        )

    # Check existing vote
    existing_vote = db.query(ReviewVote).filter(
        ReviewVote.review_id == review_id,
        ReviewVote.user_id == current_user.id
    ).first()

    if existing_vote:
        # Update existing vote
        if existing_vote.is_helpful != request.is_helpful:
            # Changing vote
            if existing_vote.is_helpful:
                review.helpful_count -= 1
                review.not_helpful_count += 1
            else:
                review.not_helpful_count -= 1
                review.helpful_count += 1
            existing_vote.is_helpful = request.is_helpful
    else:
        # New vote
        vote = ReviewVote(
            review_id=review_id,
            user_id=current_user.id,
            is_helpful=request.is_helpful
        )
        db.add(vote)

        if request.is_helpful:
            review.helpful_count += 1
        else:
            review.not_helpful_count += 1

    db.commit()

    return {
        "success": True,
        "helpfulCount": review.helpful_count,
        "notHelpfulCount": review.not_helpful_count
    }


@router.get("/user/my-reviews")
def get_my_reviews(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get current user's reviews.
    """
    query = db.query(ProductReview).filter(
        ProductReview.user_id == current_user.id
    ).order_by(desc(ProductReview.created_at))

    total = query.count()
    reviews = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "reviews": [r.to_dict() for r in reviews],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total > 0 else 0
        }
    }


# ========================
# Admin Endpoints
# ========================

def verify_admin_access(current_user: User = Depends(get_current_user)):
    """Verify user has admin access."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@admin_router.get("/stats")
def get_review_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Get overall review statistics for admin dashboard.
    """
    total = db.query(ProductReview).count()
    pending = db.query(ProductReview).filter(ProductReview.is_approved == False).count()
    approved = db.query(ProductReview).filter(ProductReview.is_approved == True).count()
    featured = db.query(ProductReview).filter(ProductReview.is_featured == True).count()

    # Recent reviews (last 7 days)
    from datetime import timedelta
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent = db.query(ProductReview).filter(ProductReview.created_at >= week_ago).count()

    # Average rating across all approved reviews
    avg_rating = db.query(func.avg(ProductReview.rating)).filter(
        ProductReview.is_approved == True
    ).scalar() or 0

    return {
        "total": total,
        "pending": pending,
        "approved": approved,
        "featured": featured,
        "recentWeek": recent,
        "averageRating": round(float(avg_rating), 1)
    }


@admin_router.get("/pending")
def get_pending_reviews(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Get reviews pending moderation.
    """
    query = db.query(ProductReview).filter(
        ProductReview.is_approved == False
    ).order_by(ProductReview.created_at)

    total = query.count()
    reviews = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "reviews": [r.to_admin_dict() for r in reviews],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total > 0 else 0
        }
    }


@admin_router.get("/all")
def get_all_reviews(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status", regex="^(pending|approved|featured)$"),
    product_id: Optional[int] = Query(None, alias="productId"),
    rating: Optional[int] = Query(None, ge=1, le=5),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Get all reviews with filters for admin management.
    """
    query = db.query(ProductReview)

    # Apply filters
    if status_filter == "pending":
        query = query.filter(ProductReview.is_approved == False)
    elif status_filter == "approved":
        query = query.filter(ProductReview.is_approved == True)
    elif status_filter == "featured":
        query = query.filter(ProductReview.is_featured == True)

    if product_id:
        query = query.filter(ProductReview.product_id == product_id)

    if rating:
        query = query.filter(ProductReview.rating == rating)

    if search:
        query = query.filter(
            (ProductReview.title.ilike(f"%{search}%")) |
            (ProductReview.comment.ilike(f"%{search}%"))
        )

    # Order by most recent
    query = query.order_by(desc(ProductReview.created_at))

    total = query.count()
    reviews = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "reviews": [r.to_admin_dict() for r in reviews],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total > 0 else 0
        }
    }


@admin_router.put("/{review_id}/moderate")
def moderate_review(
    review_id: int,
    request: AdminModerateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Approve or reject a review.
    """
    review = db.query(ProductReview).filter(ProductReview.id == review_id).first()

    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Avis non trouve"
        )

    review.is_approved = request.is_approved
    review.moderation_note = request.moderation_note
    review.moderated_by = admin.id
    review.moderated_at = datetime.utcnow()

    if request.is_featured is not None:
        review.is_featured = request.is_featured

    db.commit()
    db.refresh(review)

    # Update product stats
    update_product_stats(db, review.product_id)

    return {
        "success": True,
        "review": review.to_admin_dict(),
        "message": "Avis approuve" if request.is_approved else "Avis rejete"
    }


@admin_router.post("/{review_id}/respond")
def add_admin_response(
    review_id: int,
    request: AdminResponseRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Add admin response to a review.
    """
    review = db.query(ProductReview).filter(ProductReview.id == review_id).first()

    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Avis non trouve"
        )

    review.admin_response = request.response
    review.admin_response_at = datetime.utcnow()
    review.admin_response_by = admin.id

    db.commit()
    db.refresh(review)

    return {
        "success": True,
        "review": review.to_admin_dict(),
        "message": "Reponse ajoutee"
    }


@admin_router.delete("/{review_id}")
def admin_delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Admin delete any review.
    """
    review = db.query(ProductReview).filter(ProductReview.id == review_id).first()

    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Avis non trouve"
        )

    product_id = review.product_id
    db.delete(review)
    db.commit()

    # Update stats
    update_product_stats(db, product_id)

    return {
        "success": True,
        "message": "Avis supprime"
    }


@admin_router.post("/bulk-moderate")
def bulk_moderate_reviews(
    review_ids: List[int],
    is_approved: bool = Query(..., alias="approve"),
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Bulk approve or reject multiple reviews.
    """
    reviews = db.query(ProductReview).filter(ProductReview.id.in_(review_ids)).all()

    if not reviews:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun avis trouve"
        )

    product_ids = set()
    for review in reviews:
        review.is_approved = is_approved
        review.moderated_by = admin.id
        review.moderated_at = datetime.utcnow()
        product_ids.add(review.product_id)

    db.commit()

    # Update stats for affected products
    for pid in product_ids:
        update_product_stats(db, pid)

    return {
        "success": True,
        "count": len(reviews),
        "message": f"{len(reviews)} avis {'approuves' if is_approved else 'rejetes'}"
    }
