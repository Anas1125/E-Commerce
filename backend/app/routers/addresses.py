from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.address import Address
from app.models.user import User
from app.schemas.address import AddressCreate, AddressResponse
from app.services.dependencies import get_current_user


router = APIRouter(
    prefix="/api/addresses",
    tags=["Addresses"],
)

MAX_ADDRESSES_PER_USER = 20


def _lock_user(db: Session, user_id: int) -> None:
    """Serialise address changes for one customer.

    Two quick requests (double click, two tabs) would otherwise both read the
    same "current default" and both succeed, leaving two defaults. Locking the
    user row makes the second request wait for the first. This is a no-op on
    SQLite, so keep the partial unique index on the database too.
    """
    db.execute(select(User.id).where(User.id == user_id).with_for_update())


def _get_owned_address(db: Session, user_id: int, address_id: int) -> Address:
    address = db.scalar(
        select(Address).where(
            Address.id == address_id,
            Address.user_id == user_id,
        )
    )

    if address is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found",
        )

    return address


def _clear_defaults(db: Session, user_id: int, except_id: int | None = None) -> None:
    statement = (
        update(Address)
        .where(Address.user_id == user_id, Address.is_default.is_(True))
        .values(is_default=False)
    )

    if except_id is not None:
        statement = statement.where(Address.id != except_id)

    db.execute(statement)


def _save_failed() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="We couldn't save your address because it was changed "
        "at the same time. Please try again.",
    )


@router.get(
    "/",
    response_model=list[AddressResponse],
)
def get_my_addresses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Address)
        .where(Address.user_id == current_user.id)
        .order_by(Address.is_default.desc(), Address.id.desc())
        .limit(MAX_ADDRESSES_PER_USER)
    ).all()


@router.post(
    "/",
    response_model=AddressResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_address(
    address_data: AddressCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _lock_user(db, current_user.id)

    address_count = db.scalar(
        select(func.count())
        .select_from(Address)
        .where(Address.user_id == current_user.id)
    )

    if address_count >= MAX_ADDRESSES_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You can save up to {MAX_ADDRESSES_PER_USER} addresses. "
            "Delete one before adding another.",
        )
    make_default = address_data.is_default or address_count == 0

    if make_default:
        _clear_defaults(db, current_user.id)

    address = Address(
        user_id=current_user.id,
        address_line1=address_data.address_line1,
        address_line2=address_data.address_line2,
        city=address_data.city,
        state=address_data.state,
        postal_code=address_data.postal_code,
        country=address_data.country,
        is_default=make_default,
    )

    db.add(address)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _save_failed()

    db.refresh(address)

    return address


@router.put(
    "/{address_id}",
    response_model=AddressResponse,
)
def update_address(
    address_id: int,
    address_data: AddressCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _lock_user(db, current_user.id)

    address = _get_owned_address(db, current_user.id, address_id)

    make_default = address_data.is_default or address.is_default

    if make_default and not address.is_default:
        _clear_defaults(db, current_user.id, except_id=address.id)

    address.address_line1 = address_data.address_line1
    address.address_line2 = address_data.address_line2
    address.city = address_data.city
    address.state = address_data.state
    address.postal_code = address_data.postal_code
    address.country = address_data.country
    address.is_default = make_default

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _save_failed()

    db.refresh(address)

    return address


@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _lock_user(db, current_user.id)

    address = _get_owned_address(db, current_user.id, address_id)
    was_default = address.is_default

    try:
        db.delete(address)
        db.flush()

        if was_default:
            replacement = db.scalar(
                select(Address)
                .where(Address.user_id == current_user.id)
                .order_by(Address.id.desc())
                .limit(1)
            )

            if replacement is not None:
                replacement.is_default = True

        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This address can't be deleted right now. Please try again.",
        )

    return None