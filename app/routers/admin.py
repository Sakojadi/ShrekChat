from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, distinct, and_, desc, extract, inspect
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
import calendar

from ..database import SessionLocal, User, Message, Room, room_members, GroupMember, BlockedUser

# Define a proper dependency for database access
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
)

@router.get("/stats/users")
async def get_user_stats(db: Session = Depends(get_db)):
    """
    Get user registration statistics
    """
    try:
        # Get current date for time-based queries
        now = datetime.utcnow()
        today_start = datetime(now.year, now.month, now.day)
        week_start = today_start - timedelta(days=today_start.weekday())
        month_start = datetime(now.year, now.month, 1)
        
        # Total users count
        total_users = db.query(func.count(User.id)).scalar()
        
        # Get new users registered using registration_date
        new_users_today = db.query(func.count(User.id)).filter(
            User.registration_date >= today_start
        ).scalar() or 0
        
        # New users registered this week
        new_users_week = db.query(func.count(User.id)).filter(
            User.registration_date >= week_start
        ).scalar() or 0
        
        # New users registered this month
        new_users_month = db.query(func.count(User.id)).filter(
            User.registration_date >= month_start
        ).scalar() or 0
        
        # Find most active user of the day
        most_active_user = db.query(
            User.id,
            User.username,
            User.avatar,
            func.count(Message.id).label('message_count')
        ).join(
            Message, Message.sender_id == User.id
        ).filter(
            Message.timestamp >= today_start
        ).group_by(
            User.id
        ).order_by(
            func.count(Message.id).desc()
        ).first()
        
        # If we found an active user, format their data
        if most_active_user:
            most_active_user_data = {
                "id": most_active_user.id,
                "username": most_active_user.username,
                "avatar": most_active_user.avatar,
                "message_count": most_active_user.message_count
            }
        else:
            # No active user found, provide placeholder
            most_active_user_data = {
                "id": None,
                "username": "No active users today",
                "avatar": "/static/images/shrek.jpg",
                "message_count": 0
            }
        
        # Monthly registration history for the chart (last 12 months)
        monthly_registrations = []
        
        # Get current month and year
        current_month = now.month
        current_year = now.year
        
        # Get registration counts by month using registration_date for the last 12 months
        for i in range(12):
            # Calculate the month and year for this data point (going backward)
            month_offset = i - 11  # -11, -10, -9, ... 0
            target_month = current_month + month_offset
            target_year = current_year
            
            # Adjust the year if the month wraps around
            while target_month <= 0:
                target_month += 12
                target_year -= 1
            while target_month > 12:
                target_month -= 12
                target_year += 1
            
            # Calculate the start and end of the month
            month_start = datetime(target_year, target_month, 1)
            
            # Calculate the end of the month (1st day of next month)
            if target_month == 12:
                month_end = datetime(target_year + 1, 1, 1)
            else:
                month_end = datetime(target_year, target_month + 1, 1)
            
            # Count users registered in this specific month
            month_count = db.query(func.count(User.id)).filter(
                User.registration_date >= month_start,
                User.registration_date < month_end
            ).scalar() or 0
            
            # Create date object to get the month abbreviation
            month_date = date(target_year, target_month, 1)
            month_name = month_date.strftime("%b")
            
            monthly_registrations.append({
                "month": month_name,
                "year": target_year,
                "count": month_count
            })
        
        return {
            "success": True,
            "data": {
                "total_users": total_users,
                "new_users_today": new_users_today,
                "new_users_week": new_users_week,
                "new_users_month": new_users_month,
                "most_active_user": most_active_user_data,
                "monthly_registrations": monthly_registrations
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/stats/activity")
async def get_activity_stats(db: Session = Depends(get_db)):
    """
    Get user activity statistics
    """
    try:
        # Current date for time-based queries
        now = datetime.utcnow()
        today_start = datetime(now.year, now.month, now.day)

        # Active users right now (online users) - This will work correctly
        active_users_now = db.query(func.count(User.id)).filter(User.is_online == True).scalar()

        # Active users today (users who logged in today) - This should work if last_seen is updated
        active_users_today = db.query(func.count(User.id)).filter(
            User.last_seen >= today_start
        ).scalar() or 0  # Default to 0 if None

        # Calculate average daily active users over the past week using actual login data
        # week_start = today_start - timedelta(days=7) # This variable is not needed here

        # For each of the past 7 days (including today), count unique users who were active
        daily_active_users = []
        for i in range(7):
            day_start = today_start - timedelta(days=i)
            day_end = day_start + timedelta(days=1)

            # Count users who were seen on this day
            day_active = db.query(func.count(distinct(User.id))).filter(
                User.last_seen >= day_start,
                User.last_seen < day_end
            ).scalar() or 0

            daily_active_users.append(day_active)

        # Calculate the average over the past 7 days
        total_active_users_past_week = sum(daily_active_users)
        num_days = len(daily_active_users) # This should be 7

        if num_days > 0:
            # Calculate average and cast to integer
            avg_daily_active = int(round(total_active_users_past_week / num_days))
        else:
            # Fallback if no data was collected (shouldn't happen with range(7))
            avg_daily_active = 0

        # Find peak activity hours based on message timestamps
        week_start = today_start - timedelta(days=7) # This variable is used here
        hour_counts = db.query(
            extract('hour', Message.timestamp).label('hour'),
            func.count(Message.id).label('count')
        ).filter(
            Message.timestamp >= week_start
        ).group_by(
            extract('hour', Message.timestamp)
        ).order_by(
            func.count(Message.id).desc()
        ).first()

        # If we have message data with timestamps, use it
        if hour_counts:
            peak_hour = hour_counts.hour
            peak_hour_formatted = f"{int(peak_hour):02d}:00 - {int(peak_hour)+1:02d}:00"
        else:
            # Default to evening hours if no data
            peak_hour_formatted = "20:00 - 21:00"

        # Get weekly activity pattern from actual messages
        weekday_activity = []
        weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

        # Get the date for last Monday (start of the week)
        last_monday = today_start - timedelta(days=today_start.weekday())

        for i in range(7):
            day_date = last_monday + timedelta(days=i)
            day_end = day_date + timedelta(days=1)

            # Get actual message count for this day
            message_count = db.query(func.count(Message.id)).filter(
                Message.timestamp >= day_date,
                Message.timestamp < day_end
            ).scalar() or 0

            # Get unique active users for this day based on message sending
            unique_active_users = db.query(func.count(distinct(Message.sender_id))).filter(
                Message.timestamp >= day_date,
                Message.timestamp < day_end
            ).scalar() or 0

            # If we have no messages but have login data, use that
            if unique_active_users == 0:
                unique_active_users = db.query(func.count(distinct(User.id))).filter(
                    User.last_seen >= day_date,
                    User.last_seen < day_end
                ).scalar() or 0

            weekday_activity.append({
                "day": weekdays[i],
                "active_users": unique_active_users,
                "message_count": message_count
            })

        return {
            "success": True,
            "data": {
                "active_users_now": active_users_now,
                "active_users_today": active_users_today,
                "avg_daily_active": avg_daily_active,
                "peak_activity_time": peak_hour_formatted,
                "weekday_activity": weekday_activity
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

        

@router.get("/stats/messages")
async def get_message_stats(db: Session = Depends(get_db)):
    """
    Get message statistics
    """
    try:
        # Current date for time-based queries
        now = datetime.utcnow()
        today_start = datetime(now.year, now.month, now.day)
        
        # Total messages - This will work correctly if we have message data
        total_messages = db.query(func.count(Message.id)).scalar() or 0
        
        # Messages sent today - This will work correctly if message timestamps exist
        messages_today = db.query(func.count(Message.id)).filter(
            Message.timestamp >= today_start
        ).scalar() or 0
        
        # Calculate average messages per day based on past week
        week_start = today_start - timedelta(days=7)
        messages_past_week = db.query(func.count(Message.id)).filter(
            Message.timestamp >= week_start
        ).scalar() or 0
        
        # Calculate the average daily messages over the past week
        # If we have data for the past week, use that; otherwise, use today's data or a fallback
        if messages_past_week > 0:
            avg_messages_per_day = int(round(messages_past_week / 7))
        elif messages_today > 0:
            avg_messages_per_day = int(messages_today)
        else:
            # Fallback if no message data at all
            avg_messages_per_day = 0
        
        # Find most active chat based on message count
        most_active_chat = db.query(
            Room.id,
            Room.name,
            Room.is_group,
            func.count(Message.id).label('message_count')
        ).join(
            Message, Message.room_id == Room.id
        ).group_by(
            Room.id
        ).order_by(
            func.count(Message.id).desc()
        ).first()
        
        # Format most active chat name
        if most_active_chat:
            most_active_chat_name = most_active_chat.name if most_active_chat.is_group else "Direct Chat"
            if not most_active_chat.is_group:
                # Try to get usernames for direct chats
                users = db.query(User.username).join(
                    room_members, room_members.c.user_id == User.id
                ).filter(
                    room_members.c.room_id == most_active_chat.id
                ).all()
                usernames = [user.username for user in users if user.username]
                if len(usernames) == 2:
                    most_active_chat_name = " & ".join(usernames)
        else:
            most_active_chat_name = "No active chats"
        
        # Get the most recent activity dates from the messages table
        # We'll get the 24 most recent time slots with messages
        recent_activity = db.query(
            func.date(Message.timestamp).label('date'), 
            func.strftime('%H', Message.timestamp).label('hour'),
            func.count(Message.id).label('count')
        ).group_by(
            'date', 'hour'
        ).order_by(
            func.date(Message.timestamp).desc(),
            func.strftime('%H', Message.timestamp)
        ).limit(24).all()
        
        # Create hourly distribution for charting
        hourly_distribution = []
        
        if recent_activity:
            for activity in recent_activity:
                # Format as readable label showing both date and hour
                date_obj = datetime.strptime(str(activity.date), '%Y-%m-%d')
                month_day = date_obj.strftime('%b %d')
                hour_label = f"{month_day} {int(activity.hour):02d}:00"
                
                hourly_distribution.append({
                    "hour": hour_label,
                    "message_count": activity.count
                })
            
            # Make sure we have the data in chronological order
            hourly_distribution.reverse()
        else:
            # Fallback if no messages
            for i in range(24):
                hour_label = f"{i:02d}:00"
                hourly_distribution.append({
                    "hour": hour_label,
                    "message_count": 0
                })
        
        return {
            "success": True,
            "data": {
                "total_messages": total_messages,
                "messages_today": messages_today,
                "avg_messages_per_day": avg_messages_per_day,
                "most_active_chat": most_active_chat_name,
                "hourly_distribution": hourly_distribution
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
        

@router.get("/users/list")
async def get_registered_users(
    page: int = 1, 
    limit: int = 10, 
    search: str = None,
    db: Session = Depends(get_db)
):
    """
    Get a paginated list of registered users
    """
    try:
        # Base query - always include registration_date as it exists in the database
        query = db.query(User)
        
        # Apply search filter if provided
        if search:
            query = query.filter(User.username.ilike(f"%{search}%"))
        
        # Get total count for pagination
        total_count = query.count()
        
        # Apply pagination
        offset = (page - 1) * limit
        users = query.order_by(User.id).offset(offset).limit(limit).all()
        
        # Format user data
        user_list = []
        for user in users:
            # Always use the registration_date from the database
            registration_date = user.registration_date.isoformat() if user.registration_date else datetime.utcnow().isoformat()
            
            user_list.append({
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "avatar": user.avatar or "/static/images/shrek.jpg",
                "is_online": user.is_online,
                "last_seen": user.last_seen.isoformat() if user.last_seen else None,
                "registered_date": registration_date,
                "country": user.country
            })
        
        return {
            "success": True,
            "data": {
                "users": user_list,
                "pagination": {
                    "total": total_count,
                    "page": page,
                    "limit": limit,
                    "pages": (total_count + limit - 1) // limit  # Ceiling division
                }
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a user by ID and all associated data
    """
    try:
        # Find the user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Store username for return message
        username = user.username
        
        # 1. Find all direct chat rooms where the user is a member
        direct_rooms = db.query(Room).filter(
            Room.is_group == False,
            Room.id.in_(
                db.query(room_members.c.room_id).filter(
                    room_members.c.user_id == user_id
                )
            )
        ).all()
        
        # Delete direct chat room memberships first
        for room in direct_rooms:
            # Delete memberships for both users in the direct chat
            db.execute(
                room_members.delete().where(
                    room_members.c.room_id == room.id
                )
            )
            # Then delete the room itself
            db.delete(room)
        
        # 2. Delete group chat memberships separately
        db.execute(
            room_members.delete().where(
                and_(
                    room_members.c.user_id == user_id,
                    room_members.c.room_id.in_(
                        db.query(Room.id).filter(Room.is_group == True)
                    )
                )
            )
        )
        
        # 3. Remove from group_members table
        db.query(GroupMember).filter(GroupMember.user_id == user_id).delete()
        
        # 4. Clean up blocking relationships
        db.query(BlockedUser).filter(BlockedUser.user_id == user_id).delete()
        db.query(BlockedUser).filter(BlockedUser.blocked_user_id == user_id).delete()
        
        # 5. Finally delete the user
        db.delete(user)
        db.commit()
        
        return {
            "success": True,
            "message": f"User {username} and all associated data has been deleted successfully"
        }
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        return {"success": False, "error": str(e)}