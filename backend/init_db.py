"""
Initialize local SQLite database with tables
"""

from app.database import engine, Base
from app.models.activity import Activity

print("Creating database tables...")
Base.metadata.create_all(bind=engine)
print("[SUCCESS] Database tables created successfully!")