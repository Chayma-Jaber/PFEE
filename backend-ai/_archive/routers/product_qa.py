"""
Product Questions & Answers Router
===================================
API endpoints for product Q&A functionality.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.models.user import User
from app.models.product_qa import ProductQuestion, ProductAnswer, AnswerHelpfulVote
from app.routers.auth import get_current_user, get_current_user_optional

# Create routers
router = APIRouter(prefix="/api/products", tags=["Product Q&A"])
admin_router = APIRouter(prefix="/api/admin/qa", tags=["Admin Q&A"])


# ========================
# Pydantic Schemas
# ========================

class AskQuestionRequest(BaseModel):
    question_text: str = Field(..., min_length=10, max_length=1000, alias="questionText")

    class Config:
        populate_by_name = True


class AnswerQuestionRequest(BaseModel):
    answer_text: str = Field(..., min_length=5, max_length=2000, alias="answerText")

    class Config:
        populate_by_name = True


class AdminModerateRequest(BaseModel):
    is_published: bool = Field(..., alias="isPublished")

    class Config:
        populate_by_name = True


class AdminAnswerRequest(BaseModel):
    answer_text: str = Field(..., min_length=5, max_length=2000, alias="answerText")
    is_staff: bool = Field(True, alias="isStaff")

    class Config:
        populate_by_name = True


# ========================
# Public Endpoints
# ========================

@router.get("/{product_id}/questions")
def get_product_questions(
    product_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    search: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get questions for a product with answers.
    Only returns published questions with published answers.
    """
    # Base query - only published questions
    query = db.query(ProductQuestion).filter(
        ProductQuestion.product_id == product_id,
        ProductQuestion.is_published == True
    )

    # Apply search filter
    if search:
        query = query.filter(ProductQuestion.question_text.ilike(f"%{search}%"))

    # Order by most recent
    query = query.order_by(desc(ProductQuestion.created_at))

    # Get total count
    total = query.count()

    # Paginate
    questions = query.offset((page - 1) * limit).limit(limit).all()

    # Check if user has voted on any answers
    user_votes = set()
    if current_user:
        answer_ids = []
        for q in questions:
            for a in q.answers:
                if a.is_published:
                    answer_ids.append(a.id)

        if answer_ids:
            votes = db.query(AnswerHelpfulVote).filter(
                AnswerHelpfulVote.user_id == current_user.id,
                AnswerHelpfulVote.answer_id.in_(answer_ids)
            ).all()
            user_votes = {v.answer_id for v in votes}

    # Build response
    questions_data = []
    for question in questions:
        q_data = question.to_dict()
        # Add user vote info to answers
        if "answers" in q_data:
            for answer in q_data["answers"]:
                answer["hasVoted"] = answer["id"] in user_votes
        questions_data.append(q_data)

    return {
        "questions": questions_data,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total > 0 else 0
        }
    }


@router.post("/{product_id}/questions")
def ask_question(
    product_id: str,
    request: AskQuestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ask a question about a product.
    Question requires moderation before publishing.
    """
    # Create question
    question = ProductQuestion(
        product_id=product_id,
        user_id=current_user.id,
        question_text=request.question_text,
        is_published=False  # Requires moderation
    )

    db.add(question)
    db.commit()
    db.refresh(question)

    return {
        "success": True,
        "question": question.to_dict(),
        "message": "Votre question a ete soumise et sera publiee apres verification."
    }


@router.post("/questions/{question_id}/answers")
def answer_question(
    question_id: int,
    request: AnswerQuestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Answer a product question.
    Answer requires moderation before publishing.
    """
    # Get question
    question = db.query(ProductQuestion).filter(
        ProductQuestion.id == question_id,
        ProductQuestion.is_published == True
    ).first()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question non trouvee"
        )

    # Create answer
    answer = ProductAnswer(
        question_id=question_id,
        user_id=current_user.id,
        answer_text=request.answer_text,
        is_staff=False,  # Regular users are not staff
        is_published=False  # Requires moderation
    )

    db.add(answer)
    db.commit()
    db.refresh(answer)

    return {
        "success": True,
        "answer": answer.to_dict(),
        "message": "Votre reponse a ete soumise et sera publiee apres verification."
    }


@router.post("/answers/{answer_id}/helpful")
def mark_answer_helpful(
    answer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark an answer as helpful.
    One vote per user per answer.
    """
    # Get answer
    answer = db.query(ProductAnswer).filter(
        ProductAnswer.id == answer_id,
        ProductAnswer.is_published == True
    ).first()

    if not answer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reponse non trouvee"
        )

    # Check if user already voted
    existing_vote = db.query(AnswerHelpfulVote).filter(
        AnswerHelpfulVote.answer_id == answer_id,
        AnswerHelpfulVote.user_id == current_user.id
    ).first()

    if existing_vote:
        # Remove vote (toggle)
        db.delete(existing_vote)
        answer.helpful_count = max(0, answer.helpful_count - 1)
        voted = False
        message = "Vote retire"
    else:
        # Add vote
        vote = AnswerHelpfulVote(
            answer_id=answer_id,
            user_id=current_user.id
        )
        db.add(vote)
        answer.helpful_count += 1
        voted = True
        message = "Merci pour votre vote!"

    db.commit()

    return {
        "success": True,
        "helpfulCount": answer.helpful_count,
        "hasVoted": voted,
        "message": message
    }


@router.get("/questions/my-questions")
def get_my_questions(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get current user's questions.
    """
    query = db.query(ProductQuestion).filter(
        ProductQuestion.user_id == current_user.id
    ).order_by(desc(ProductQuestion.created_at))

    total = query.count()
    questions = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "questions": [q.to_dict() for q in questions],
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
def get_qa_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Get Q&A statistics for admin dashboard.
    """
    total_questions = db.query(ProductQuestion).count()
    pending_questions = db.query(ProductQuestion).filter(ProductQuestion.is_published == False).count()
    published_questions = db.query(ProductQuestion).filter(ProductQuestion.is_published == True).count()

    total_answers = db.query(ProductAnswer).count()
    pending_answers = db.query(ProductAnswer).filter(ProductAnswer.is_published == False).count()
    staff_answers = db.query(ProductAnswer).filter(ProductAnswer.is_staff == True).count()

    return {
        "questions": {
            "total": total_questions,
            "pending": pending_questions,
            "published": published_questions
        },
        "answers": {
            "total": total_answers,
            "pending": pending_answers,
            "staffAnswers": staff_answers
        }
    }


@admin_router.get("/pending-questions")
def get_pending_questions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Get questions pending moderation.
    """
    query = db.query(ProductQuestion).filter(
        ProductQuestion.is_published == False
    ).order_by(ProductQuestion.created_at)

    total = query.count()
    questions = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "questions": [q.to_admin_dict() for q in questions],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total > 0 else 0
        }
    }


@admin_router.get("/pending-answers")
def get_pending_answers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Get answers pending moderation.
    """
    query = db.query(ProductAnswer).filter(
        ProductAnswer.is_published == False
    ).order_by(ProductAnswer.created_at)

    total = query.count()
    answers = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "answers": [a.to_admin_dict() for a in answers],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total > 0 else 0
        }
    }


@admin_router.put("/questions/{question_id}/moderate")
def moderate_question(
    question_id: int,
    request: AdminModerateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Approve or reject a question.
    """
    question = db.query(ProductQuestion).filter(ProductQuestion.id == question_id).first()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question non trouvee"
        )

    question.is_published = request.is_published
    question.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(question)

    return {
        "success": True,
        "question": question.to_admin_dict(),
        "message": "Question approuvee" if request.is_published else "Question rejetee"
    }


@admin_router.put("/answers/{answer_id}/moderate")
def moderate_answer(
    answer_id: int,
    request: AdminModerateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Approve or reject an answer.
    """
    answer = db.query(ProductAnswer).filter(ProductAnswer.id == answer_id).first()

    if not answer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reponse non trouvee"
        )

    answer.is_published = request.is_published
    answer.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(answer)

    return {
        "success": True,
        "answer": answer.to_admin_dict(),
        "message": "Reponse approuvee" if request.is_published else "Reponse rejetee"
    }


@admin_router.post("/questions/{question_id}/staff-answer")
def add_staff_answer(
    question_id: int,
    request: AdminAnswerRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Add a staff answer to a question.
    Staff answers are automatically published.
    """
    question = db.query(ProductQuestion).filter(ProductQuestion.id == question_id).first()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question non trouvee"
        )

    # Ensure question is published
    if not question.is_published:
        question.is_published = True

    # Create staff answer
    answer = ProductAnswer(
        question_id=question_id,
        user_id=admin.id,
        answer_text=request.answer_text,
        is_staff=True,
        is_published=True  # Staff answers auto-published
    )

    db.add(answer)
    db.commit()
    db.refresh(answer)

    return {
        "success": True,
        "answer": answer.to_admin_dict(),
        "message": "Reponse officielle ajoutee"
    }


@admin_router.delete("/questions/{question_id}")
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Delete a question and all its answers.
    """
    question = db.query(ProductQuestion).filter(ProductQuestion.id == question_id).first()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question non trouvee"
        )

    db.delete(question)
    db.commit()

    return {
        "success": True,
        "message": "Question supprimee"
    }


@admin_router.delete("/answers/{answer_id}")
def delete_answer(
    answer_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Delete an answer.
    """
    answer = db.query(ProductAnswer).filter(ProductAnswer.id == answer_id).first()

    if not answer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reponse non trouvee"
        )

    db.delete(answer)
    db.commit()

    return {
        "success": True,
        "message": "Reponse supprimee"
    }


@admin_router.get("/all-questions")
def get_all_questions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(pending|published)$"),
    product_id: Optional[str] = Query(None, alias="productId"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_access)
):
    """
    Get all questions with filters for admin management.
    """
    query = db.query(ProductQuestion)

    # Apply filters
    if status_filter == "pending":
        query = query.filter(ProductQuestion.is_published == False)
    elif status_filter == "published":
        query = query.filter(ProductQuestion.is_published == True)

    if product_id:
        query = query.filter(ProductQuestion.product_id == product_id)

    if search:
        query = query.filter(ProductQuestion.question_text.ilike(f"%{search}%"))

    # Order by most recent
    query = query.order_by(desc(ProductQuestion.created_at))

    total = query.count()
    questions = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "questions": [q.to_admin_dict() for q in questions],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total > 0 else 0
        }
    }
