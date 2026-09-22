#!/usr/bin/env python3
"""End-to-end test of the deployed fiuu-notify webhook.

Runs against the LIVE function, signing payloads with the real merchant secret
so it exercises the same path Fiuu does. Cleans up every row it creates.

Usage:
    python3 scripts/test-webhook.py

Reads SUPABASE_URL, FIUU_SECRET_KEY, FIUU_MERCHANT_ID, FIUU_APP_TOKEN and
FIUU_DEBUG_TOKEN from .env. FIUU_DEBUG_TOKEN is only needed for cleanup; without
it the test still runs but leaves its rows behind.
"""
import hashlib
import json
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load_env():
    env = {}
    path = ROOT / ".env"
    if not path.exists():
        sys.exit("No .env found")
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"')
    return env


ENV = load_env()
BASE = ENV.get("SUPABASE_URL", "").rstrip("/")
if not BASE:
    sys.exit("SUPABASE_URL missing from .env")
URL = f"{BASE}/functions/v1/fiuu-notify"
SECRET = ENV.get("FIUU_SECRET_KEY", "")
DOMAIN = ENV.get("FIUU_MERCHANT_ID", "")
APP_TOKEN = ENV.get("FIUU_APP_TOKEN", "")
DEBUG_TOKEN = ENV.get("FIUU_DEBUG_TOKEN", "")

ORDER = "WEBHOOK-SELFTEST"
results = []


def md5(s):
    return hashlib.md5(s.encode()).hexdigest()


def sign(p, secret):
    """key0 = md5(tranID+orderid+status+domain+amount+currency)
       key1 = md5(paydate+domain+key0+appcode+secret)"""
    k0 = md5(f"{p['tranID']}{p['orderid']}{p['status']}{p['domain']}{p['amount']}{p['currency']}")
    return md5(f"{p['paydate']}{p['domain']}{k0}{p.get('appcode','')}{secret}")


def request(method, path="", data=None, headers=None):
    url = URL + path
    body = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    if body:
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:  # noqa: BLE001 - surfaced as a test failure
        return 0, str(e)


def check(name, condition, detail=""):
    results.append((name, bool(condition), detail))
    print(f"  {'PASS' if condition else 'FAIL'}  {name}{('  -> ' + detail) if detail and not condition else ''}")


def payload(status="00", amount="1.10", order=ORDER):
    return {
        "nbcb": "2", "tranID": "900000001", "orderid": order, "status": status,
        "domain": DOMAIN, "amount": amount, "currency": "RM",
        "paydate": "2026-09-22 10:00:00", "appcode": "TEST01",
        "error_code": "", "error_desc": "",
    }


print(f"Testing {URL}\n")

# 1. Health probe - the portal's Check button sends no parameters.
print("Endpoint reachable")
status, body = request("GET")
check("bare GET returns 200 (portal Check)", status == 200, f"got {status}")
check("health body is JSON ok", '"ok"' in body, body[:80])

# 2. A correctly signed notification must be accepted and marked paid.
print("\nGenuine notification")
p = payload()
p["skey"] = sign(p, SECRET)
status, body = request("POST", data=p)
check("accepts signed notification", status == 200, f"got {status}")
check("replies CBTOKEN:MPSTATOK", "CBTOKEN:MPSTATOK" in body, body[:80])

status, body = request("GET", f"?order_id={ORDER}")
row = json.loads(body) if status == 200 else {}
check("reports paid=true", row.get("paid") is True, body[:140])
check("marks verified=true", (row.get("payment") or {}).get("verified") is True)
check("stores status 00", (row.get("payment") or {}).get("status") == "00")
check("stores the amount", str((row.get("payment") or {}).get("amount")) in ("1.1", "1.10"))

# 3. A forged signature must never be reported as paid. This is the one that matters.
print("\nForged notification is rejected")
forged = payload(amount="9999.00", order=ORDER + "-FORGED")
forged["skey"] = "deadbeefdeadbeefdeadbeefdeadbeef"
request("POST", data=forged)
status, body = request("GET", f"?order_id={ORDER}-FORGED")
row = json.loads(body) if status == 200 else {}
check("forged NOT reported paid", row.get("paid") is False, body[:140])
check("forged marked verified=false", (row.get("payment") or {}).get("verified") is False)
check("forged stored as status -1", (row.get("payment") or {}).get("status") == "-1")

# 4. Tampering with a signed field must invalidate the signature.
print("\nTampering is detected")
t = payload(order=ORDER + "-TAMPER")
t["skey"] = sign(t, SECRET)
t["amount"] = "5000.00"  # changed after signing
request("POST", data=t)
status, body = request("GET", f"?order_id={ORDER}-TAMPER")
row = json.loads(body) if status == 200 else {}
check("amount tampering rejected", row.get("paid") is False, body[:140])

# 5. A declined payment must not read as paid.
print("\nDeclined payment")
d = payload(status="11", order=ORDER + "-DECLINED")
d["skey"] = sign(d, SECRET)
request("POST", data=d)
status, body = request("GET", f"?order_id={ORDER}-DECLINED")
row = json.loads(body) if status == 200 else {}
check("declined not paid", row.get("paid") is False)
check("declined stored as status 11", (row.get("payment") or {}).get("status") == "11")

# 6. The transaction list must require the app token.
print("\nTransaction list authorisation")
status, _ = request("GET", "?list=1")
check("list rejects missing token (401)", status == 401, f"got {status}")
status, _ = request("GET", "?list=1", headers={"x-app-token": "wrong"})
check("list rejects wrong token (401)", status == 401, f"got {status}")
if APP_TOKEN:
    status, body = request("GET", "?list=1", headers={"x-app-token": APP_TOKEN})
    listed = json.loads(body).get("transactions", []) if status == 200 else []
    check("list accepts correct token", status == 200, f"got {status}")
    check("list includes the test order", any(t["order_id"] == ORDER for t in listed))

# 7. Unknown orders must answer cleanly rather than erroring.
print("\nUnknown order")
status, body = request("GET", "?order_id=DOES-NOT-EXIST-12345")
row = json.loads(body) if status == 200 else {}
check("unknown order paid=false", row.get("paid") is False, f"{status} {body[:80]}")
check("unknown order payment=null", row.get("payment") is None)

# Cleanup
print("\nCleanup")
if DEBUG_TOKEN:
    removed = 0
    for suffix in ("", "-FORGED", "-TAMPER", "-DECLINED"):
        s, _ = request("DELETE", f"?debug={urllib.parse.quote(DEBUG_TOKEN)}&order_id={ORDER}{suffix}")
        removed += 1 if s == 200 else 0
    check("removed all test rows", removed == 4, f"{removed}/4 deleted")
else:
    print("  SKIP  FIUU_DEBUG_TOKEN not set; test rows left in place")

passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"\n{passed}/{total} checks passed")
sys.exit(0 if passed == total else 1)
