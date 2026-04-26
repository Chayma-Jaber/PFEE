"""
Product Questions & Answers Model
==================================
Handles product questions and answers for customer engagement.
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class ProductQuestion(Base):
    """
    Product question submitted by customers.
    """
    __tablename__ = "product_questions"

    id = Column(Integer, primary_key=True, index=True)

    # Relations
    product_id = Column(String(50), nullable=False, index=True)  # External product ID
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Question content
    question_text = Column(Text, nullable=False)

    # Moderation
    is_published = Column(Boolean, default=False)  # Requires moderation before showing

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    answers = relationship("ProductAnswer", back_populates="question", cascade="all, delete-orphan")

    def to_dict(self, include_user=True, include_answers=True):
        data = {
            "id": self.id,
            "productId": self.product_id,
            "questionText": self.question_text,
            "isPublished": self.is_published,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "answerCount": len(self.answers) if self.answers else 0
        }

        if include_user and self.user:
            data["user"] = {
                "id": self.user.id,
                "firstName": self.user.first_name,
                "lastInitial": self.user.last_name[0] if self.user.last_name else "",
            }

        if include_answers and self.answers:
            # Only include published answers
            published_answers = [a for a in self.answers if a.is_published]
            data["answers"] = [a.to_dict(include_user=True) for a in published_answers]

        return data

    def to_admin_dict(self):
        """Full details for admin view"""
        data = self.to_dict(include_user=True, include_answers=False)
        data.update({
            "userId": self.user_id,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        })
        if self.user:
            data["user"]["email"] = self.user.email
            data["user"]["lastName"] = self.user.last_name

        # Include all answers (published and unpublished) for admin
        if self.answers:
            data["answers"] = [a.to_admin_dict() for a in self.answers]

        return data


class ProductAnswer(Base):
    """
    Answer to a product question.
    Can be from customers or staff.
    """
    __tablename__ = "product_answers"

    id = Column(Integer, primary_key=True, index=True)

    # Relations
    question_id = Column(Integer, ForeignKey("product_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # Answer content
    answer_text = Column(Text, nullable=False)

    # Staff indicator
    is_staff = Column(Boolean, default=False)  # True if answer is from Barsha staff

    # Engagement
    helpful_count = Column(Integer, default=0)

    # Moderation
    is_published = Column(Boolean, default=False)  # Requires moderation

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    question = relationship("ProductQuestion", back_populates="answers")
    user = relationship("User", foreign_keys=[user_id])
    helpful_votes = relationship("AnswerHelpfulVote", back_populates="answer", cascade="all, delete-orphan")

    def to_dict(self, include_user=True):
        data = {
            "id": self.id,
            "questionId": self.question_id,
            "answerText": self.answer_text,
            "isStaff": self.is_staff,
            "helpfulCount": self.helpful_count,
            "isPublished": self.is_published,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }

        if include_user and self.user:
            if self.is_staff:
                # For staff answers, show "Equipe Barsha"
                data["user"] = {
                    "id": self.user.id,
                    "firstName": "Equipe",
                    "lastInitial": "Barsha",
                }
            else:
                data["user"] = {
                    "id": self.user.id,
                    "firstName": self.user.first_name,
                    "lastInitial": self.user.last_name[0] if self.user.last_name else "",
                }
        elif self.is_staff:
            # If no user but is staff
            data["user"] = {
                "id": 0,
                "firstName": "Equipe",
                "lastInitial": "Barsha",
            }

        return data

    def to_admin_dict(self):
        """Full details for admin view"""
        data = self.to_dict(include_user=True)
        data.update({
            "userId": self.user_id,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        })
        if self.user:
            data["user"]["email"] = self.user.email
            data["user"]["lastName"] = self.user.last_name
        return data


class AnswerHelpfulVote(Base):
    """
    Tracks helpful votes on answers.
    One vote per user per answer.
    """
    __tablename__ = "answer_helpful_votes"

    id = Column(Integer, primary_key=True, index=True)
    answer_id = Column(Integer, ForeignKey("product_answers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    answer = relationship("ProductAnswer", back_populates="helpful_votes")
    user = relationship("User")
