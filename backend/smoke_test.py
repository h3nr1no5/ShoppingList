#!/usr/bin/env python3
"""
Post-deployment smoke test for the Shopping List API.

Exercises the full API surface after a deployment to verify:
  - Health endpoint (app + database reachable)
  - Frontend SPA serves correctly
  - User registration and authentication
  - List creation and retrieval
  - Item creation and retrieval
  - List sharing (share codes, unauthenticated access)

Usage:
    python backend/smoke_test.py <BASE_URL> <REGISTRATION_KEY>

Example:
    python backend/smoke_test.py https://shoppinglist.example.com my-invite-code

Returns exit code 0 on success, non-zero on failure.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Optional, Union

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REQUEST_TIMEOUT = 15  # seconds per request
UNIQUE_SUFFIX = str(int(time.time()))  # unique email per run

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FAILED = False


def fail(step: str, message: str) -> None:
    """Mark a step as failed but continue testing."""
    global FAILED
    FAILED = True
    print(f"  FAIL [{step}]: {message}")


def request(
    url: str,
    method: str = "GET",
    body: Optional[dict] = None,
    headers: Optional[dict] = None,
) -> tuple[int, Union[dict, str]]:
    """
    Make an HTTP request and return (status_code, parsed_json_or_raw_body).
    Returns (0, error_message) on network/parse failure.
    """
    req_headers = {"Accept": "application/json"}
    if headers:
        req_headers.update(headers)

    data = None
    if body is not None:
        req_headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")

    try:
        req = urllib.request.Request(
            url, data=data, headers=req_headers, method=method
        )
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            raw = resp.read().decode("utf-8")
            content_type = resp.headers.get("Content-Type", "")
            if "application/json" in content_type:
                return resp.status, json.loads(raw)
            return resp.status, raw
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read().decode("utf-8"))
        except Exception:
            detail = str(e)
        return e.code, detail
    except urllib.error.URLError as e:
        return 0, f"Network error: {e.reason}"
    except Exception as e:
        return 0, f"Unexpected error: {e}"


def check(step: str, condition: bool, detail: str = "") -> None:
    """Assert a condition; log pass/fail."""
    if condition:
        print(f"  PASS [{step}]")
    else:
        fail(step, detail)


def parse_json_body(body: Union[dict, str], step: str) -> Optional[dict]:
    """Ensure body is a parsed dict, fail if not."""
    if not isinstance(body, dict):
        fail(step, f"Expected JSON object, got: {body}")
        return None
    return body


# ---------------------------------------------------------------------------
# Smoke test steps
# ---------------------------------------------------------------------------


def test_health(base_url: str) -> None:
    """Step 1: Health endpoint — verify app + DB are reachable."""
    print("\n[1/11] Health check")
    status, body = request(f"{base_url}/health")
    check("GET /health", status == 200, f"Expected 200, got {status}")
    if isinstance(body, dict):
        check("status == healthy", body.get("status") == "healthy", str(body))
        check("database == ok", body.get("database") == "ok", str(body))


def test_spa(base_url: str) -> None:
    """Step 2: SPA — verify frontend HTML is served."""
    print("\n[2/11] SPA check")
    status, body = request(f"{base_url}/")
    check("GET /", status == 200, f"Expected 200, got {status}")
    if isinstance(body, str):
        has_root = '<div id="root"></div>' in body
        check("has root div", has_root, "Missing <div id='root'> in HTML")
    else:
        fail("SPA HTML", f"Expected HTML string, got JSON: {body}")


def test_registration(base_url: str, registration_key: str) -> tuple[str, str]:
    """Step 3: Register a test user. Returns (email, password)."""
    email = f"smoke-test-{UNIQUE_SUFFIX}@test.com"
    password = "SmokeTest123!"

    print(f"\n[3/11] Registration ({email})")
    status, body = request(
        f"{base_url}/api/auth/register",
        method="POST",
        body={
            "email": email,
            "password": password,
            "invite_code": registration_key,
        },
    )

    # 409 (already exists) is acceptable for re-runs
    if status == 409:
        body_dict = parse_json_body(body, "register (already exists)")
        check("register (conflict, acceptable)", True)
        return email, password
    if status == 201 or status == 200:
        body_dict = parse_json_body(body, "register")
        if body_dict:
            check("register", body_dict.get("id") is not None, str(body_dict))
    else:
        fail("register", f"Expected 200/201/409, got {status}: {body}")

    return email, password


def test_login(base_url: str, email: str, password: str) -> Optional[str]:
    """Step 4: Login. Returns access_token or None."""
    print("\n[4/11] Login")
    # Use x-www-form-urlencoded as per OAuth2 spec
    data = urllib.parse.urlencode({
        "username": email,
        "password": password,
        "grant_type": "password",
    }).encode("utf-8")

    try:
        req = urllib.request.Request(
            f"{base_url}/api/auth/token",
            data=data,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            raw = resp.read().decode("utf-8")
            body = json.loads(raw)
            token = body.get("access_token")
            check("login", token is not None, "No access_token in response")
            return token
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8")
        fail("login", f"HTTP {e.code}: {detail}")
        return None
    except Exception as e:
        fail("login", f"Unexpected error: {e}")
        return None


def test_create_list(base_url: str, token: str) -> Optional[str]:
    """Step 5: Create a shopping list. Returns list_id or None."""
    print("\n[5/11] Create list")
    status, body = request(
        f"{base_url}/api/lists",
        method="POST",
        body={"name": "Smoke Test List"},
        headers={"Authorization": f"Bearer {token}"},
    )
    body_dict = parse_json_body(body, "create list")
    if body_dict and status in (200, 201):
        list_id = body_dict.get("id")
        check("create list", list_id is not None, str(body_dict))
        return list_id
    fail("create list", f"Expected 200/201, got {status}: {body}")
    return None


def test_add_item(base_url: str, token: str, list_id: str) -> None:
    """Step 6: Add an item to the list."""
    print("\n[6/11] Add item")
    status, body = request(
        f"{base_url}/api/lists/{list_id}/items",
        method="POST",
        body={"name": "Smoke Test Item", "quantity": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    body_dict = parse_json_body(body, "add item")
    if body_dict and status in (200, 201):
        check("add item", body_dict.get("id") is not None, str(body_dict))
    else:
        fail("add item", f"Expected 200/201, got {status}: {body}")


def test_get_items(base_url: str, token: str, list_id: str) -> None:
    """Step 7: Retrieve items and verify the added item exists."""
    print("\n[7/11] Get items")
    status, body = request(
        f"{base_url}/api/lists/{list_id}/items",
        headers={"Authorization": f"Bearer {token}"},
    )
    if status != 200:
        fail("get items", f"Expected 200, got {status}: {body}")
        return

    items = body if isinstance(body, list) else []
    check("get items (200)", status == 200)
    check(
        "item count >= 1",
        len(items) >= 1,
        f"Expected >=1 item, got {len(items)}",
    )
    if items:
        try:
            match = any(
                isinstance(item, dict) and item.get("name") == "Smoke Test Item"
                for item in items
            )
        except Exception:
            match = False
        check("found 'Smoke Test Item'", match, str(items))


def test_generate_share_code(base_url: str, token: str, list_id: str) -> Optional[str]:
    """Step 8: Generate a share code for an existing list. Returns share_code or None."""
    print("\n[8/11] Generate share code")
    status, body = request(
        f"{base_url}/api/lists/{list_id}/share",
        method="POST",
        headers={"Authorization": f"Bearer {token}"},
    )
    body_dict = parse_json_body(body, "generate share code")
    if body_dict and status == 200:
        share_code = body_dict.get("share_code")
        check("generate share code", share_code is not None, str(body_dict))
        # Validate UUID format
        is_valid_uuid = isinstance(share_code, str)
        try:
            uuid.UUID(share_code)
        except (ValueError, AttributeError):
            is_valid_uuid = False
        check("share code is valid UUID", is_valid_uuid, str(share_code))
        return share_code
    fail("generate share code", f"Expected 200, got {status}: {body}")
    return None


def test_access_shared_list(base_url: str, share_code: str) -> None:
    """Step 9: Access the shared list WITHOUT auth using the share code."""
    print("\n[9/11] Access shared list (no auth)")
    status, body = request(f"{base_url}/api/lists/shared/{share_code}")
    body_dict = parse_json_body(body, "access shared list")
    if not body_dict or status != 200:
        fail("access shared list", f"Expected 200, got {status}: {body}")
        return
    check("list name == 'Smoke Test List'", body_dict.get("name") == "Smoke Test List", str(body_dict))
    check("list id present", body_dict.get("id") is not None, str(body_dict))


def test_access_items_via_share_code(base_url: str, list_id: str, share_code: str) -> None:
    """Step 10: Access items via share_code query param WITHOUT auth."""
    print("\n[10/11] Access items via share code (no auth)")
    status, body = request(
        f"{base_url}/api/lists/{list_id}/items?share_code={share_code}"
    )
    if status != 200:
        fail("access items via share code", f"Expected 200, got {status}: {body}")
        return

    items = body if isinstance(body, list) else []
    check("access items via share code (200)", status == 200)
    check(
        "item count >= 1",
        len(items) >= 1,
        f"Expected >=1 item, got {len(items)}",
    )
    if items:
        try:
            match = any(
                isinstance(item, dict) and item.get("name") == "Smoke Test Item"
                for item in items
            )
        except Exception:
            match = False
        check("found 'Smoke Test Item'", match, str(items))


def cleanup(base_url: str, token: str, list_id: Optional[str]) -> None:
    """Clean up: delete the test list (best-effort, don't fail on error)."""
    if not list_id or not token:
        return
    print("\n[11/11] Cleanup")
    try:
        req = urllib.request.Request(
            f"{base_url}/api/lists/{list_id}",
            method="DELETE",
            headers={"Authorization": f"Bearer {token}"},
        )
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            print(f"  PASS [cleanup] List {list_id} deleted (HTTP {resp.status})")
    except Exception as e:
        # Cleanup failures don't fail the overall test
        print(f"  INFO [cleanup] Could not delete list {list_id}: {e}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    # Prefer environment variables (more secure — not visible in process list).
    # Fall back to CLI arguments for convenience.
    base_url = os.environ.get("SMOKE_BASE_URL") or (
        sys.argv[1].rstrip("/") if len(sys.argv) >= 2 else ""
    )
    registration_key = os.environ.get("SMOKE_REGISTRATION_KEY") or (
        sys.argv[2] if len(sys.argv) >= 3 else ""
    )

    if not base_url:
        print("Usage: python backend/smoke_test.py <BASE_URL> [REGISTRATION_KEY]")
        print("       Or set SMOKE_BASE_URL and SMOKE_REGISTRATION_KEY env vars.")
        return 1

    if not registration_key:
        print("ERROR: Registration key is required (set SMOKE_REGISTRATION_KEY env var or pass as second CLI argument)")
        return 1

    # Validate URL to prevent SSRF / misuse
    parsed = urllib.parse.urlparse(base_url)
    if parsed.scheme not in ("http", "https"):
        print(f"ERROR: base_url must use http or https scheme, got: {parsed.scheme}")
        return 1
    if not parsed.netloc:
        print(f"ERROR: base_url is not a valid URL: {base_url}")
        return 1

    print(f"Smoke Test — {base_url}")
    print(f"Timestamp: {UNIQUE_SUFFIX}")

    test_health(base_url)
    test_spa(base_url)
    email, password = test_registration(base_url, registration_key)
    token = test_login(base_url, email, password)

    list_id = None
    if token:
        list_id = test_create_list(base_url, token)
        if list_id:
            test_add_item(base_url, token, list_id)
            test_get_items(base_url, token, list_id)
            # Step 8-10: Test list sharing
            share_code = test_generate_share_code(base_url, token, list_id)
            if share_code:
                test_access_shared_list(base_url, share_code)
                test_access_items_via_share_code(base_url, list_id, share_code)
            else:
                print("\n  SKIP [8-10/11] Skipping sharing tests (share code generation failed)")
        else:
            print("\n  SKIP [6-11/11] Skipping remaining API tests (list creation failed)")
    else:
        print("\n  SKIP [5-11/11] Skipping API tests (login failed)")

    cleanup(base_url, token, list_id)

    print()
    if FAILED:
        print("SMOKE TEST FAILED — one or more checks did not pass.")
        return 1
    else:
        print("SMOKE TEST PASSED — all checks successful.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
