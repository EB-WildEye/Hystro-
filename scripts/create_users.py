"""Create (or update) the admin and reviewer accounts from scripts/.env.

Reviewer slots left empty in scripts/.env are skipped, so accounts can be
added one at a time.

Accounts are created pre-confirmed, so each person signs in with a magic link
sent to their address. Re-running is safe: existing users are reused and their
profile (name, role, slot) is updated.

Usage:  python scripts/create_users.py
"""

import os

from common import admin_client, env


def find_user_id(client, email: str) -> str | None:
    page = 1
    while True:
        users = client.auth.admin.list_users(page=page, per_page=200)
        for u in users:
            if (u.email or "").lower() == email.lower():
                return u.id
        if len(users) < 200:
            return None
        page += 1


def ensure_user(client, email: str) -> str:
    user_id = find_user_id(client, email)
    if user_id:
        return user_id
    res = client.auth.admin.create_user({"email": email, "email_confirm": True})
    return res.user.id


EXTRA_ADMINS = range(2, 6)  # ADMIN_2_* .. ADMIN_5_*
REVIEWER_SLOTS = (1, 2, 3)  # must match profiles.reviewer_slot in the database


def optional_person(prefix: str, label: str) -> tuple[str, str] | None:
    email = os.environ.get(f"{prefix}_EMAIL", "").strip()
    name = os.environ.get(f"{prefix}_NAME", "").strip()
    if not email and not name:
        return None  # not assigned yet; re-run once it is
    if not email or not name:
        raise SystemExit(f"{label} needs both {prefix}_EMAIL and {prefix}_NAME.")
    return email, name


def main() -> None:
    client = admin_client()
    people = [("admin", None, env("ADMIN_EMAIL"), env("ADMIN_NAME"))]
    for n in EXTRA_ADMINS:
        person = optional_person(f"ADMIN_{n}", f"Admin {n}")
        if person:
            people.append(("admin", None, *person))
    for slot in REVIEWER_SLOTS:
        person = optional_person(f"REVIEWER_{slot}", f"Reviewer {slot}")
        if person:
            people.append(("reviewer", slot, *person))

    emails = [p[2].lower() for p in people]
    if len(set(emails)) != len(emails):
        raise SystemExit("Each account needs a different email address.")

    for role, slot, email, name in people:
        user_id = ensure_user(client, email)
        client.table("profiles").upsert(
            {"id": user_id, "display_name": name, "role": role, "reviewer_slot": slot}
        ).execute()
        label = role if role == "admin" else f"reviewer {slot}"
        print(f"OK  {label}: {name}")

    print("Done. Users sign in at /login with their email address.")


if __name__ == "__main__":
    main()
