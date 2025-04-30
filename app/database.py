from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime, ForeignKey,
    Text, Boolean, Table, PrimaryKeyConstraint
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv
from contextlib import contextmanager

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./shrekchat.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Association table: links any User to any Room (direct or group)
room_members = Table(
    "room_members",
    Base.metadata,
    Column("room_id", Integer, ForeignKey("rooms.id"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("joined_at", DateTime, default=datetime.utcnow),
    Column("is_admin", Boolean, default=False),  # Add admin flag for group chats
)

class Room(Base):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)             # Optional for 1‑to‑1 chats
    is_group = Column(Boolean, default=False)        # False = direct chat, True = group chat
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship(
        "User",
        secondary=room_members,
        back_populates="rooms",
        cascade="all, delete"
    )
    messages = relationship(
        "Message",
        back_populates="room",
        cascade="all, delete-orphan"
    )

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    bio = Column(String(150), nullable=True)  # User bio/description with 150 char limit
    phone_number = Column(String, nullable=True)
    country = Column(String, nullable=True)
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime, nullable=True)
    avatar = Column(String, default="/static/images/shrek.jpg")

    rooms = relationship(
        "Room",
        secondary=room_members,
        back_populates="members"
    )
    messages_sent = relationship(
        "Message",
        back_populates="sender",
        cascade="all, delete-orphan"
    )
    # Add relationships for blocked users
    blocked_users = relationship(
        "BlockedUser",
        foreign_keys="BlockedUser.user_id",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    blocked_by = relationship(
        "BlockedUser",
        foreign_keys="BlockedUser.blocked_user_id",
        back_populates="blocked_user",
        cascade="all, delete-orphan"
    )

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    delivered = Column(Boolean, default=False)
    read = Column(Boolean, default=False)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)

    room = relationship("Room", back_populates="messages")
    sender = relationship("User", back_populates="messages_sent")

# If you still need group-specific metadata, map it onto Room
class GroupChat(Base):
    __tablename__ = "group_chats"
    id = Column(Integer, ForeignKey("rooms.id"), primary_key=True)
    description = Column(String, nullable=True)
    avatar = Column(String, default="/static/images/shrek-logo.png")

    room = relationship("Room", backref="group_info", uselist=False)

# Optional convenience for admin flags within group rooms
class GroupMember(Base):
    __tablename__ = "group_members"
    group_id = Column(Integer, ForeignKey("group_chats.id"), nullable=False)
    user_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_admin = Column(Boolean, default=False)
    added_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (
        # composite PK so    each user appears once per group
        PrimaryKeyConstraint('group_id', 'user_id'),
    )

    user  = relationship("User")
    group = relationship("GroupChat", back_populates="members")

GroupChat.members = relationship("GroupMember", back_populates="group")

# Add the BlockedUser model after other models
class BlockedUser(Base):
    __tablename__ = "blocked_users"
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    blocked_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    blocked_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="blocked_users")
    blocked_user = relationship("User", foreign_keys=[blocked_user_id], back_populates="blocked_by")
    
    __table_args__ = (
        # Ensure a user can only block another user once
        PrimaryKeyConstraint('user_id', 'blocked_user_id'),
    )

Base.metadata.create_all(bind=engine)

@contextmanager
def get_db():
    """Dependency to provide a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
