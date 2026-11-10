"""Create (or update) the admin and the 3 reviewer accounts from scripts/.env.

Accounts are created pre-confirmed, so each person signs in with a magic link
sent to their address. Re-running is safe: existing users are reused and their
profile (name, role, slot) is updated.

Usage:  python scripts/create_users.py
"""

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


def main() -> None:
    client = admin_client()
    people = [("admin", None, env("ADMIN_EMAIL"), env("ADMIN_NAME"))]
    for slot in (1, 2, 3):
        people.append(("reviewer", slot, env(f"REVIEWER_{slot}_EMAIL"), env(f"REVIEWER_{slot}_NAME")))

    emails = [p[2].lower() for p in people]
    if len(set(emails)) != len(emails):
        raise SystemExit("Each account needs a different email address.")

    for role, slot, email, name in people:
        user_id = ensure_user(client, email)
        client.table("profiles").upsert(
            {"id": user_id, "display_name": name, "role": role, "reviewer_slot": slot}
        ).execute()
        label = "admin" if role == "admin" else f"reviewer {slot}"
        print(f"OK  {label}: {name}")

    print("Done. Users sign in at /login with their email address.")


if __name__ == "__main__":
    main()
