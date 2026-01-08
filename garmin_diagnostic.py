#!/usr/bin/env python3
"""
Garmin Connect API Diagnostic Script
Tests authentication and various endpoints to identify issues.

Usage:
    pip install garminconnect
    python garmin_diagnostic.py

Or with environment variables:
    export GARMIN_EMAIL="your_email"
    export GARMIN_PASSWORD="your_password"
    python garmin_diagnostic.py
"""

import os
import sys
from datetime import date, timedelta
from getpass import getpass

# Check if garminconnect is installed
try:
    from garminconnect import (
        Garmin,
        GarminConnectAuthenticationError,
        GarminConnectConnectionError,
        GarminConnectTooManyRequestsError,
    )
    import garminconnect
except ImportError:
    print("❌ garminconnect not installed. Run: pip install garminconnect")
    sys.exit(1)


def get_credentials():
    """Get credentials from environment or prompt."""
    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")
    
    if not email:
        email = input("Garmin Email: ")
    if not password:
        password = getpass("Garmin Password: ")
    
    return email, password


def test_endpoint(name, func, *args, **kwargs):
    """Test an endpoint and return result."""
    try:
        result = func(*args, **kwargs)
        print(f"  ✅ {name}")
        return True, result
    except GarminConnectConnectionError as e:
        print(f"  ❌ {name}: Connection error - {e}")
        return False, str(e)
    except GarminConnectTooManyRequestsError as e:
        print(f"  ⚠️  {name}: Rate limited - {e}")
        return False, str(e)
    except Exception as e:
        error_msg = str(e)
        if "403" in error_msg:
            print(f"  ❌ {name}: 403 Forbidden (known issue)")
        elif "404" in error_msg:
            print(f"  ❌ {name}: 404 Not Found")
        else:
            print(f"  ❌ {name}: {error_msg[:80]}")
        return False, error_msg


def main():
    print("=" * 60)
    print("Garmin Connect API Diagnostic")
    print("=" * 60)
    
    # Show version
    version = getattr(garminconnect, "__version__", "unknown")
    print(f"\nLibrary version: {version}")
    
    # Get credentials
    print("\n[1/5] Getting credentials...")
    email, password = get_credentials()
    
    # Initialize client
    print("\n[2/5] Initializing client...")
    api = Garmin(email, password)
    
    # Test authentication
    print("\n[3/5] Testing authentication...")
    try:
        api.login()
        print("  ✅ Login successful")
    except GarminConnectAuthenticationError as e:
        print(f"  ❌ Authentication failed: {e}")
        print("\n  Possible causes:")
        print("    - Wrong email/password")
        print("    - MFA required (not supported in this script)")
        print("    - Account locked due to too many attempts")
        sys.exit(1)
    except GarminConnectTooManyRequestsError:
        print("  ❌ Rate limited. Wait 1 hour and try again.")
        sys.exit(1)
    except Exception as e:
        print(f"  ❌ Login error: {e}")
        sys.exit(1)
    
    # Test lightweight profile endpoints
    print("\n[4/5] Testing profile endpoints (lightweight)...")
    results = {}
    
    results["full_name"] = test_endpoint("get_full_name()", api.get_full_name)
    results["unit_system"] = test_endpoint("get_unit_system()", api.get_unit_system)
    
    # Test activity endpoints (these may fail with 403)
    print("\n[5/5] Testing activity endpoints...")
    today = date.today().isoformat()
    week_ago = (date.today() - timedelta(days=7)).isoformat()
    
    results["activities"] = test_endpoint(
        "get_activities(0, 1)", 
        api.get_activities, 0, 1
    )
    results["last_activity"] = test_endpoint(
        "get_last_activity()", 
        api.get_last_activity
    )
    results["activities_by_date"] = test_endpoint(
        f"get_activities_by_date({week_ago}, {today})",
        api.get_activities_by_date, week_ago, today
    )
    
    # Test health endpoints
    print("\n[Bonus] Testing health endpoints...")
    results["stats"] = test_endpoint(
        f"get_stats({today})",
        api.get_stats, today
    )
    results["steps"] = test_endpoint(
        f"get_steps_data({today})",
        api.get_steps_data, today
    )
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for k, (ok, _) in results.items() if ok)
    total = len(results)
    
    print(f"\nPassed: {passed}/{total}")
    
    # Diagnosis
    profile_ok = results["full_name"][0] and results["unit_system"][0]
    activities_ok = results["activities"][0]
    
    print("\nDiagnosis:")
    if profile_ok and activities_ok:
        print("  ✅ Everything working! You're good to go.")
    elif profile_ok and not activities_ok:
        print("  ⚠️  Auth works, but activity endpoints are failing.")
        print("     This matches the known Nov 2025 issue (403 Forbidden).")
        print("     Options:")
        print("       - Wait for library update")
        print("       - Use Garmin's GDPR data export")
        print("       - Check: https://github.com/cyberjunky/python-garminconnect/issues")
    elif not profile_ok:
        print("  ❌ Profile endpoints failing - likely an auth issue.")
        print("     Try deleting ~/.garminconnect and re-authenticating.")
    
    print()


if __name__ == "__main__":
    main()
