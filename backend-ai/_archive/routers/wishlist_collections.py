"""
Wishlist Collections Router
Endpoints for managing wishlist collections (Pinterest-style boards)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
import uuid

from app.core.database import get_db
from app.models.wishlist import WishlistCollection, WishlistItem
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/wishlist/collections", tags=["Wishlist Collections"])


# ========================
# Pydantic Schemas
# ========================

class CreateCollectionRequest(BaseModel):
    """Request to create a new wishlist collection"""
    name: str = Field(..., min_length=1, max_length=100, description="Collection name")
    description: Optional[str] = Field(None, max_length=500, description="Collection description")
    is_public: bool = Field(False, description="Whether collection is publicly shareable")


class UpdateCollectionRequest(BaseModel):
    """Request to update a collection"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    is_public: Optional[bool] = None


class MoveItemRequest(BaseModel):
    """Request to move an item to a collection"""
    product_id: int = Field(..., description="Product ID to move")
    target_collection_id: Optional[int] = Field(None, description="Target collection ID (null for uncategorized)")


class UpdateItemNotesRequest(BaseModel):
    """Request to update notes for a wishlist item"""
    notes: Optional[str] = Field(None, max_length=1000, description="Notes for the item")


class CollectionResponse(BaseModel):
    """Response containing collection details"""
    success: bool
    collection: dict
    message: str


# ========================
# Collection Endpoints
# ========================

@router.get("")
def get_collections(
    include_items: bool = Query(False, description="Include items in each collection"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all collections for the current user.
    """
    # Get all collections
    collections = db.query(WishlistCollection).filter(
        WishlistCollection.user_id == current_user.id
    ).order_by(
        desc(WishlistCollection.is_default),
        desc(WishlistCollection.created_at)
    ).all()

    # Get uncategorized items count
    uncategorized_count = db.query(WishlistItem).filter(
        WishlistItem.user_id == current_user.id,
        WishlistItem.collection_id == None
    ).count()

    # Get total items count
    total_items = db.query(WishlistItem).filter(
        WishlistItem.user_id == current_user.id
    ).count()

    return {
        "success": True,
        "collections": [c.to_dict(include_items=include_items) for c in collections],
        "uncategorizedCount": uncategorized_count,
        "totalItems": total_items
    }


@router.post("")
def create_collection(
    request: CreateCollectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new wishlist collection.
    """
    # Check collection count limit (max 20 collections)
    collection_count = db.query(WishlistCollection).filter(
        WishlistCollection.user_id == current_user.id
    ).count()

    if collection_count >= 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous avez atteint le nombre maximum de collections (20)"
        )

    # Check for duplicate names
    existing = db.query(WishlistCollection).filter(
        WishlistCollection.user_id == current_user.id,
        WishlistCollection.name == request.name
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Une collection avec ce nom existe deja"
        )

    # Generate share token if public
    share_token = None
    if request.is_public:
        share_token = WishlistCollection.generate_share_token()

    # Create collection
    collection = WishlistCollection(
        user_id=current_user.id,
        name=request.name,
        description=request.description,
        is_public=request.is_public,
        share_token=share_token
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)

    return {
        "success": True,
        "collection": collection.to_dict(),
        "message": "Collection creee avec succes"
    }


@router.get("/{collection_id}")
def get_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific collection with its items.
    """
    collection = db.query(WishlistCollection).filter(
        WishlistCollection.id == collection_id,
        WishlistCollection.user_id == current_user.id
    ).first()

    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection non trouvee"
        )

    return {
        "success": True,
        "collection": collection.to_dict(include_items=True)
    }


@router.put("/{collection_id}")
def update_collection(
    collection_id: int,
    request: UpdateCollectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a collection's settings.
    """
    collection = db.query(WishlistCollection).filter(
        WishlistCollection.id == collection_id,
        WishlistCollection.user_id == current_user.id
    ).first()

    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection non trouvee"
        )

    # Check for duplicate names if name is being changed
    if request.name and request.name != collection.name:
        existing = db.query(WishlistCollection).filter(
            WishlistCollection.user_id == current_user.id,
            WishlistCollection.name == request.name,
            WishlistCollection.id != collection_id
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Une collection avec ce nom existe deja"
            )

        collection.name = request.name

    if request.description is not None:
        collection.description = request.description

    if request.is_public is not None:
        collection.is_public = request.is_public
        # Generate share token if becoming public
        if request.is_public and not collection.share_token:
            collection.share_token = WishlistCollection.generate_share_token()

    collection.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(collection)

    return {
        "success": True,
        "collection": collection.to_dict(),
        "message": "Collection mise a jour"
    }


@router.delete("/{collection_id}")
def delete_collection(
    collection_id: int,
    move_items_to: Optional[int] = Query(None, description="Move items to this collection ID (null to uncategorize)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a collection. Items can be moved to another collection or uncategorized.
    """
    collection = db.query(WishlistCollection).filter(
        WishlistCollection.id == collection_id,
        WishlistCollection.user_id == current_user.id
    ).first()

    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection non trouvee"
        )

    if collection.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de supprimer la collection par defaut"
        )

    # Move items if target specified
    if move_items_to is not None:
        # Verify target collection exists and belongs to user
        target = db.query(WishlistCollection).filter(
            WishlistCollection.id == move_items_to,
            WishlistCollection.user_id == current_user.id
        ).first()

        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Collection cible non trouvee"
            )

    # Update items collection_id (either to target or None)
    db.query(WishlistItem).filter(
        WishlistItem.collection_id == collection_id
    ).update({"collection_id": move_items_to})

    # Delete the collection
    db.delete(collection)
    db.commit()

    return {
        "success": True,
        "message": "Collection supprimee avec succes"
    }


# ========================
# Item Management Endpoints
# ========================

@router.get("/items/all")
def get_all_items(
    collection_id: Optional[int] = Query(None, description="Filter by collection ID (null for all)"),
    uncategorized_only: bool = Query(False, description="Only show uncategorized items"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all wishlist items with optional filtering.
    """
    query = db.query(WishlistItem).filter(
        WishlistItem.user_id == current_user.id
    )

    if uncategorized_only:
        query = query.filter(WishlistItem.collection_id == None)
    elif collection_id is not None:
        query = query.filter(WishlistItem.collection_id == collection_id)

    items = query.order_by(desc(WishlistItem.added_at)).all()

    return {
        "success": True,
        "items": [item.to_dict() for item in items],
        "total": len(items)
    }


@router.post("/items/move")
def move_item_to_collection(
    request: MoveItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Move a wishlist item to a different collection.
    """
    # Find the item
    item = db.query(WishlistItem).filter(
        WishlistItem.user_id == current_user.id,
        WishlistItem.product_id == request.product_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article non trouve dans vos favoris"
        )

    # Verify target collection if specified
    if request.target_collection_id is not None:
        target = db.query(WishlistCollection).filter(
            WishlistCollection.id == request.target_collection_id,
            WishlistCollection.user_id == current_user.id
        ).first()

        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Collection cible non trouvee"
            )

    # Update item
    item.collection_id = request.target_collection_id
    db.commit()

    return {
        "success": True,
        "item": item.to_dict(),
        "message": "Article deplace avec succes"
    }


@router.delete("/items/{product_id}")
def remove_item_from_collection(
    product_id: int,
    collection_id: Optional[int] = Query(None, description="Remove from specific collection only"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove an item from a collection (moves to uncategorized) or from wishlist entirely.
    """
    query = db.query(WishlistItem).filter(
        WishlistItem.user_id == current_user.id,
        WishlistItem.product_id == product_id
    )

    if collection_id is not None:
        query = query.filter(WishlistItem.collection_id == collection_id)

    item = query.first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article non trouve"
        )

    # If removing from specific collection, just uncategorize
    if collection_id is not None:
        item.collection_id = None
        db.commit()
        return {
            "success": True,
            "message": "Article retire de la collection"
        }

    # Otherwise delete entirely
    db.delete(item)
    db.commit()

    return {
        "success": True,
        "message": "Article supprime des favoris"
    }


@router.put("/items/{product_id}/notes")
def update_item_notes(
    product_id: int,
    request: UpdateItemNotesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update notes for a wishlist item.
    """
    item = db.query(WishlistItem).filter(
        WishlistItem.user_id == current_user.id,
        WishlistItem.product_id == product_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article non trouve dans vos favoris"
        )

    item.notes = request.notes
    db.commit()

    return {
        "success": True,
        "item": item.to_dict(),
        "message": "Notes mises a jour"
    }


# ========================
# Public Collection Endpoints
# ========================

@router.get("/shared/{share_token}")
def view_shared_collection(
    share_token: str,
    db: Session = Depends(get_db)
):
    """
    View a publicly shared collection.
    No authentication required.
    """
    collection = db.query(WishlistCollection).filter(
        WishlistCollection.share_token == share_token,
        WishlistCollection.is_public == True
    ).first()

    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection non trouvee ou non publique"
        )

    return {
        "success": True,
        "collection": {
            "name": collection.name,
            "description": collection.description,
            "itemCount": len(collection.items) if collection.items else 0,
            "ownerName": collection.user.first_name if collection.user else "Utilisateur Barsha",
            "items": [item.to_dict() for item in collection.items] if collection.items else [],
            "createdAt": collection.created_at.isoformat() if collection.created_at else None
        }
    }


@router.post("/{collection_id}/toggle-sharing")
def toggle_collection_sharing(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Toggle public sharing for a collection.
    """
    collection = db.query(WishlistCollection).filter(
        WishlistCollection.id == collection_id,
        WishlistCollection.user_id == current_user.id
    ).first()

    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection non trouvee"
        )

    # Toggle public status
    collection.is_public = not collection.is_public

    # Generate share token if becoming public
    if collection.is_public and not collection.share_token:
        collection.share_token = WishlistCollection.generate_share_token()

    db.commit()
    db.refresh(collection)

    share_url = None
    if collection.is_public and collection.share_token:
        share_url = f"https://barsha.com.tn/wishlist/collection/{collection.share_token}"

    return {
        "success": True,
        "isPublic": collection.is_public,
        "shareToken": collection.share_token if collection.is_public else None,
        "shareUrl": share_url,
        "message": "Partage active" if collection.is_public else "Partage desactive"
    }
