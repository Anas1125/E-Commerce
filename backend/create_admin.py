from getpass import getpass

from sqlalchemy import select

from app.database import SessionLocal
from app.models.user import User
from app.services.auth import hash_password


def main():
    first_name = input("First name: ").strip()
    last_name = input("Last name (optional): ").strip() or None
    email = input("Admin email: ").strip().lower()
    phone_number = input("Admin phone number: ").strip()
    password = getpass("Admin password: ")

    db = SessionLocal()

    try:
        existing_user = db.scalar(
            select(User).where(User.email == email)
        )

        if existing_user:
            print("A user with this email already exists.")
            return

        existing_phone = db.scalar(
            select(User).where(User.phone_number == phone_number)
        )

        if existing_phone:
            print("A user with this phone number already exists.")
            return

        admin = User(
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone_number=phone_number,
            password_hash=hash_password(password),
            role="admin",
            is_active=True,
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        print(f"Admin created successfully. ID: {admin.id}")

    finally:
        db.close()


if __name__ == "__main__":
    main()