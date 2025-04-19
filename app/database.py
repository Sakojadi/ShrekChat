from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Text, PrimaryKeyConstraint, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database URL from environment or use default for development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./shrekchat.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    country = Column(String, nullable=True)
    messages_sent = relationship("Message", back_populates="sender", foreign_keys='Message.sender_id')
    messages_received = relationship("Message", back_populates="recipient", foreign_keys='Message.recipient_id')
    contacts = relationship("Contact", back_populates="user", foreign_keys='Contact.user_id')
    contacted_by = relationship("Contact", back_populates="contact_user", foreign_keys='Contact.contact_id')
    groups = relationship("GroupMember", back_populates="user")
    group_messages = relationship("GroupMessage", back_populates="sender")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    recipient_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    delivered = Column(Boolean, default=False)  # Track if message was delivered
    read = Column(Boolean, default=False)  # Track if message was read
    delivered_at = Column(DateTime, nullable=True)  # When the message was delivered
    read_at = Column(DateTime, nullable=True)  # When the message was read
    sender = relationship("User", foreign_keys=[sender_id], back_populates="messages_sent")
    recipient = relationship("User", foreign_keys=[recipient_id], back_populates="messages_received")

class Contact(Base):
    __tablename__ = "contacts"
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    contact_id = Column(Integer, ForeignKey("users.id"), nullable=False) 
    added_at = Column(DateTime, default=datetime.utcnow)
    # Create composite primary key from user_id and contact_id
    __table_args__ = (PrimaryKeyConstraint('user_id', 'contact_id'),)
    
    user = relationship("User", foreign_keys=[user_id], back_populates="contacts")
    contact_user = relationship("User", foreign_keys=[contact_id], back_populates="contacted_by")

class GroupChat(Base):
    __tablename__ = "group_chats"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    avatar = Column(String, default="/static/images/shrek-logo.png")
    
    members = relationship("GroupMember", back_populates="group")
    messages = relationship("GroupMessage", back_populates="group")

class GroupMember(Base):
    __tablename__ = "group_members"
    group_id = Column(Integer, ForeignKey("group_chats.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_admin = Column(Boolean, default=False)
    added_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (PrimaryKeyConstraint('group_id', 'user_id'),)
    
    user = relationship("User", back_populates="groups")
    group = relationship("GroupChat", back_populates="members")

class GroupMessage(Base):
    __tablename__ = "group_messages"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("group_chats.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    group = relationship("GroupChat", back_populates="messages")
    sender = relationship("User", back_populates="group_messages")
    
    read_by = relationship("GroupMessageRead", back_populates="message")

class GroupMessageRead(Base):
    __tablename__ = "group_message_reads"
    message_id = Column(Integer, ForeignKey("group_messages.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    read_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (PrimaryKeyConstraint('message_id', 'user_id'),)
    
    message = relationship("GroupMessage", back_populates="read_by")
    user = relationship("User")

Base.metadata.create_all(bind=engine)
