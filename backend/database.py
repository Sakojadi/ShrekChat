import sqlite3
from contextlib import contextmanager

DATABASE_NAME = "shrekchat.db"

@contextmanager
def get_db():
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def create_tables():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Create users table with extended profile information
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                phone TEXT,
                status TEXT DEFAULT 'Online',
                profile_picture TEXT,
                country TEXT DEFAULT 'swamp',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create messages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender TEXT NOT NULL,
                receiver TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                read BOOLEAN DEFAULT 0,
                FOREIGN KEY (sender) REFERENCES users (username),
                FOREIGN KEY (receiver) REFERENCES users (username)
            )
        """)
        
        # Create contacts table - new table for storing user contacts
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS contacts (
                user_id INTEGER NOT NULL,
                contact_id INTEGER NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, contact_id),
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (contact_id) REFERENCES users (id)
            )
        """)
        
        # Create groups table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                creator TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (creator) REFERENCES users (username)
            )
        """)
        
        # Create group_members table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS group_members (
                group_id INTEGER,
                username TEXT,
                is_admin BOOLEAN DEFAULT 0,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (group_id, username),
                FOREIGN KEY (group_id) REFERENCES groups (id),
                FOREIGN KEY (username) REFERENCES users (username)
            )
        """)
        
        # Create group_messages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS group_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER,
                sender TEXT,
                content TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (group_id) REFERENCES groups (id),
                FOREIGN KEY (sender) REFERENCES users (username)
            )
        """)
        
        conn.commit()
