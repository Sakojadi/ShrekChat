import os
import sqlite3
from datetime import datetime

def migrate_db():
    # Path to database
    db_path = 'shrekchat.db'
    
    # Connect to the database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if blocked_users table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='blocked_users'")
        if cursor.fetchone():
            print("Dropping and recreating blocked_users table...")
            
            # Drop the existing table
            cursor.execute("DROP TABLE IF EXISTS blocked_users")
            
            # Create the new table with the correct schema (without id column)
            cursor.execute("""
            CREATE TABLE blocked_users (
                user_id INTEGER NOT NULL,
                blocked_user_id INTEGER NOT NULL, 
                blocked_at DATETIME,
                PRIMARY KEY (user_id, blocked_user_id),
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(blocked_user_id) REFERENCES users(id)
            )
            """)
            
            print("Migration completed successfully!")
        else:
            print("blocked_users table doesn't exist, nothing to migrate.")
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.commit()
        conn.close()

if __name__ == "__main__":
    migrate_db()