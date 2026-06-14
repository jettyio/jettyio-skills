#!/usr/bin/env python3
"""Jetty CLI auth — log in as your Clerk user and manage Connected Accounts.

The static ``mlc_`` API key (``~/.config/jetty/token``) is *collection-scoped*
(org identity). Subscription credentials (Nous / Codex / Anthropic) are
*user-scoped* to your Clerk user, so to link or run on them from the CLI you
must act as that user. This does the Clerk login (OAuth Authorization Code +
PKCE, localhost loopback) and stores a refreshable user token separately from
the ``mlc_`` key.

Commands:
  login            Browser login as your Clerk user; stores a refreshable token.
  logout           Forget the stored user token.
  whoami           Show the logged-in user (sub / email).
  token            Print a fresh access token (refreshing if near expiry).
  accounts         List your linked subscription accounts (mise Connected Accounts).
  connect <prov>   Link a subscription: `nous` (paste a Portal refresh token),
                   or `codex` / `anthropic` (browser OAuth, finish in the tab).

Stdlib only — no pip installs. Config is env-overridable; defaults are the
provisioned production values.
"""
from __future__ import annotations

import base64
import hashlib
import http.server
import json
import os
import secrets
import sys
import threading
import time
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

# --- Config (provisioned 2026-06-14; override via env) ----------------------
CLERK_ISSUER = os.getenv("JETTY_CLERK_ISSUER", "https://clerk.jetty.io").rstrip("/")
CLERK_CLIENT_ID = os.getenv("JETTY_CLERK_CLIENT_ID", "rD7TOA4HrSWohlly")
JETTY_API = os.getenv("JETTY_API", "https://flows-api.jetty.io").rstrip("/")
# NOTE: keep this in sync with the scopes registered on the Clerk OAuth app.
# `openid` is intentionally omitted — it is not registered on the provisioned
# app, and requesting it returns `invalid_scope`. Re-add it (and bump to an
# OIDC flow) only once the app registers it and issues JWT access tokens.
SCOPES = os.getenv(
    "JETTY_CLERK_SCOPES", "email profile offline_access user:org:read"
)
# Loopback: Clerk registers http://127.0.0.1/callback. Per RFC 8252 §7.3 the
# server should allow any port for a 127.0.0.1 redirect; we bind an ephemeral
# port unless JETTY_LOGIN_PORT pins one (set it + register that exact URI if
# your IdP enforces strict exact-match).
LOGIN_PORT = int(os.getenv("JETTY_LOGIN_PORT", "0"))
REFRESH_MARGIN_SEC = 60

TOKEN_DIR = Path(os.path.expanduser("~/.config/jetty"))
USER_TOKEN_PATH = TOKEN_DIR / "user-token.json"
AUTHORIZE_URL = f"{CLERK_ISSUER}/oauth/authorize"
TOKEN_URL = f"{CLERK_ISSUER}/oauth/token"
USERINFO_URL = f"{CLERK_ISSUER}/oauth/userinfo"


# --- small helpers ----------------------------------------------------------
def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


_UA = os.getenv(
    "JETTY_HTTP_UA",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
)


def _post_form(url: str, data: dict) -> dict:
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Accept": "application/json", "User-Agent": _UA},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:  # surface the IdP error code + body
        raw = ""
        try:
            raw = e.read().decode()
        except Exception:
            pass
        detail = ""
        try:
            j = json.loads(raw)
            if isinstance(j, dict):
                if j.get("error"):
                    detail = j.get("error_description") or j.get("error")
                elif j.get("errors"):
                    detail = "; ".join(
                        (x.get("long_message") or x.get("message") or x.get("code") or "")
                        for x in j["errors"] if isinstance(x, dict)
                    )
        except Exception:
            pass
        raise SystemExit(f"token endpoint returned {e.code} {detail or raw[:600]}".strip())


def _api(method: str, path: str, token: str, payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        f"{JETTY_API}/api/v1{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": _UA,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise SystemExit(f"{method} {path} -> {e.code}: {body[:300]}")


def _save_tokens(tok: dict) -> None:
    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    obtained = int(time.time())
    record = {
        "access_token": tok["access_token"],
        "refresh_token": tok.get("refresh_token"),
        "expires_at": obtained + int(tok.get("expires_in", 3600)),
        "id_token": tok.get("id_token"),
    }
    USER_TOKEN_PATH.write_text(json.dumps(record, indent=2))
    USER_TOKEN_PATH.chmod(0o600)


def _decode_jwt_claims(jwt: str | None) -> dict:
    if not jwt or jwt.count(".") < 2:
        return {}
    try:
        seg = jwt.split(".")[1]
        seg += "=" * (-len(seg) % 4)
        return json.loads(base64.urlsafe_b64decode(seg))
    except Exception:
        return {}


# --- loopback one-shot server ----------------------------------------------
class _CallbackHandler(http.server.BaseHTTPRequestHandler):
    result: dict = {}

    def do_GET(self):  # noqa: N802
        q = urllib.parse.urlparse(self.path)
        if q.path != "/callback":
            self.send_response(404)
            self.end_headers()
            return
        _CallbackHandler.result = dict(urllib.parse.parse_qsl(q.query))
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(
            b"<html><body style='font-family:sans-serif'>"
            b"<h3>Jetty CLI: you're signed in.</h3>"
            b"<p>You can close this tab and return to the terminal.</p>"
            b"</body></html>"
        )

    def log_message(self, *args):  # silence
        pass


# --- commands ---------------------------------------------------------------
def cmd_login(_args):
    verifier = _b64url(secrets.token_bytes(64))
    challenge = _b64url(hashlib.sha256(verifier.encode()).digest())
    state = secrets.token_urlsafe(24)

    # Bind the loopback first so we know the redirect_uri (port) before authorize.
    _CallbackHandler.result = {}
    server = http.server.HTTPServer(("127.0.0.1", LOGIN_PORT), _CallbackHandler)
    port = server.server_address[1]
    redirect_uri = f"http://127.0.0.1:{port}/callback"

    params = {
        "response_type": "code",
        "client_id": CLERK_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": SCOPES,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    url = f"{AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"
    print("Opening your browser to sign in…")
    print(f"  If it doesn't open, visit:\n  {url}\n")
    webbrowser.open(url)

    t = threading.Thread(target=server.handle_request, daemon=True)
    t.start()
    t.join(300)
    server.server_close()
    cb = _CallbackHandler.result
    if not cb:
        raise SystemExit("timed out waiting for the browser callback")
    if cb.get("error"):
        raise SystemExit(f"authorization failed: {cb.get('error')}")
    if cb.get("state") != state:
        raise SystemExit("state mismatch — aborting (possible CSRF)")

    tok = _post_form(
        TOKEN_URL,
        {
            "grant_type": "authorization_code",
            "code": cb["code"],
            "redirect_uri": redirect_uri,
            "client_id": CLERK_CLIENT_ID,
            "code_verifier": verifier,
        },
    )
    _save_tokens(tok)
    claims = _decode_jwt_claims(tok["access_token"])
    who = claims.get("email") or claims.get("sub") or "your account"
    print(f"✓ Logged in as {who}. Token stored at {USER_TOKEN_PATH}")


def _load_tokens() -> dict:
    if not USER_TOKEN_PATH.exists():
        raise SystemExit("not logged in — run `jetty login` first")
    return json.loads(USER_TOKEN_PATH.read_text())


def get_access_token() -> str:
    """Return a valid access token, refreshing if within the expiry margin."""
    rec = _load_tokens()
    if rec.get("expires_at", 0) - time.time() > REFRESH_MARGIN_SEC:
        return rec["access_token"]
    if not rec.get("refresh_token"):
        raise SystemExit("token expired and no refresh token — run `jetty login`")
    tok = _post_form(
        TOKEN_URL,
        {
            "grant_type": "refresh_token",
            "refresh_token": rec["refresh_token"],
            "client_id": CLERK_CLIENT_ID,
        },
    )
    # Clerk may rotate the refresh token — keep the new one if present.
    tok.setdefault("refresh_token", rec["refresh_token"])
    _save_tokens(tok)
    return tok["access_token"]


def cmd_token(_args):
    print(get_access_token())


def cmd_whoami(_args):
    claims = _decode_jwt_claims(get_access_token())
    print(json.dumps({"sub": claims.get("sub"), "email": claims.get("email"),
                      "azp": claims.get("azp")}, indent=2))


def cmd_logout(_args):
    if USER_TOKEN_PATH.exists():
        USER_TOKEN_PATH.unlink()
        print("✓ Logged out (removed user token).")
    else:
        print("Already logged out.")


def cmd_accounts(_args):
    accts = _api("GET", "/connected-accounts", get_access_token())
    if not accts:
        print("No connected accounts. Use `jetty connect <provider>` to link one.")
        return
    for a in accts:
        label = a.get("account_label") or "—"
        tier = f" · {a['subscription_tier']}" if a.get("subscription_tier") else ""
        print(f"  {a['provider']:<10} {a['status']:<9} {label}{tier}")


def cmd_connect(args):
    if not args:
        raise SystemExit("usage: jetty connect <nous|codex|anthropic>")
    provider = args[0]
    token = get_access_token()

    if provider == "nous":
        print(
            "Nous links by pasting a Portal refresh token.\n"
            "Run `hermes setup --portal` (writes ~/.hermes/auth.json), then paste the\n"
            "refresh token below."
        )
        rt = _read_nous_refresh_token()
        if not rt:
            raise SystemExit("no refresh token provided")
        acct = _api("POST", "/connected-accounts/nous/link", token,
                    {"refresh_token": rt})
        print(f"✓ Connected nous ({acct.get('status')}).")
        return

    # OAuth providers: drive begin → open the provider's authorize URL. Finishing
    # in the browser (provider → mise callback) is the supported path today; the
    # CLI then confirms via `accounts`. (Full CLI loopback for third-party
    # providers is a follow-up — their redirect is registered to mise, not us.)
    if provider in ("codex", "anthropic"):
        resp = _api("POST", f"/connected-accounts/{provider}/begin", token, {})
        print("Opening your browser to authorize…")
        print(f"  {resp['authorize_url']}\n")
        webbrowser.open(resp["authorize_url"])
        print("Finish in the browser, then run `jetty accounts` to confirm.")
        return

    raise SystemExit(f"unknown provider '{provider}'")


def _read_nous_refresh_token() -> str:
    # Convenience: offer to read it from ~/.hermes/auth.json if present.
    hermes = Path(os.path.expanduser("~/.hermes/auth.json"))
    if hermes.exists():
        try:
            data = json.loads(hermes.read_text())
            rt = data.get("refresh_token") or (data.get("nous") or {}).get("refresh_token")
            if rt and input(f"Use refresh token from {hermes}? [Y/n] ").strip().lower() in ("", "y", "yes"):
                return rt
        except Exception:
            pass
    return input("Portal refresh token: ").strip()


COMMANDS = {
    "login": cmd_login,
    "logout": cmd_logout,
    "whoami": cmd_whoami,
    "token": cmd_token,
    "accounts": cmd_accounts,
    "connect": cmd_connect,
}


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd, rest = argv[0], argv[1:]
    fn = COMMANDS.get(cmd)
    if not fn:
        print(f"unknown command '{cmd}'. Try: {', '.join(COMMANDS)}", file=sys.stderr)
        return 2
    fn(rest)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
