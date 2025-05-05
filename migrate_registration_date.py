#!/usr/bin/env python3
"""
Migration script to update registration dates for users.
This resolves issues with incorrect registration dates displayed in the admin panel.
"""
from sqlalchemy import update, inspect
from datetime import datetime
from app.database import SessionLocal, User, engine

def main():
    print("Starting migration of user registration dates...")
    
    # Create a database session
    db = SessionLocal()
    
    try:
        # Verify the registration_date column exists
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('users')]
        if 'registration_date' not in columns:
            print("Error: registration_date column does not exist in the users table.")
            return
        
        # Count users with NULL registration dates
        null_count = db.query(User).filter(User.registration_date == None).count()
        print(f"Found {null_count} users with missing registration dates.")
        
        # Set today's date for users with NULL registration dates
        if null_count > 0:
            now = datetime.utcnow()
            db.execute(
                update(User)
                .where(User.registration_date == None)
                .values(registration_date=now)
            )
            db.commit()
            print(f"Updated {null_count} users with current date: {now}")
        
        # Check if any users have future dates
        future_users = db.query(User).filter(User.registration_date > datetime.utcnow()).all()
        if future_users:
            print(f"Found {len(future_users)} users with future registration dates:")
            for user in future_users:
                print(f"User ID: {user.id}, Username: {user.username}, Registration date: {user.registration_date}")
                
                # Fix future dates by setting them to current time
                user.registration_date = datetime.utcnow()
                print(f"  → Updated to: {user.registration_date}")
                
            db.commit()
            print("Fixed all future registration dates.")
        else:
            print("No users with future registration dates found.")
        
        print("Migration completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()