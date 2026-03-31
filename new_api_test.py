#!/usr/bin/env python3
"""
NPM Backend New API Testing Script
Tests all new endpoints as requested in the review.
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL
BASE_URL = "http://localhost:8001"

class NPMNewAPITester:
    def __init__(self):
        self.results = []
        self.session = requests.Session()
        
    def log_result(self, endpoint: str, method: str, status_code: int, 
                   response_data: Any = None, error: str = None):
        """Log test result"""
        result = {
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "success": 200 <= status_code < 300,
            "response_data": response_data,
            "error": error
        }
        self.results.append(result)
        
        status = "✅ PASS" if result["success"] else "❌ FAIL"
        print(f"{status} {method} {endpoint} -> {status_code}")
        if error:
            print(f"    Error: {error}")
        elif response_data and isinstance(response_data, dict):
            # Show key fields for verification
            if "secrets" in response_data:
                print(f"    Secrets count: {len(response_data['secrets'])}")
            elif "schedules" in response_data:
                print(f"    Schedules count: {len(response_data['schedules'])}")
            elif "workspaces" in response_data:
                print(f"    Workspaces count: {len(response_data['workspaces'])}")
            elif "webhooks" in response_data:
                print(f"    Webhooks count: {len(response_data['webhooks'])}")
            elif "ai_analysis" in response_data:
                print(f"    AI Analysis present: {response_data['ai_analysis'] is not None}")
        print()
        
    def test_endpoint(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        """Test a single endpoint"""
        url = f"{BASE_URL}{endpoint}"
        try:
            if method == "GET":
                response = self.session.get(url)
            elif method == "POST":
                response = self.session.post(url, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            try:
                response_data = response.json()
            except:
                response_data = response.text
                
            self.log_result(endpoint, method, response.status_code, response_data)
            return {"status_code": response.status_code, "data": response_data}
            
        except Exception as e:
            self.log_result(endpoint, method, 0, error=str(e))
            return {"status_code": 0, "error": str(e)}
    
    def run_all_tests(self):
        """Run all requested tests in sequence"""
        print("=" * 60)
        print("NPM Backend New API Testing - All New Endpoints")
        print("=" * 60)
        
        # 1. GET /api/secrets — should return {secrets: [], total: 0}
        print("1. Testing GET /api/secrets (should be empty initially)")
        result1 = self.test_endpoint("GET", "/api/secrets")
        
        # 2. POST /api/secrets — create a test secret
        print("2. Testing POST /api/secrets (create test secret)")
        secret_data = {
            "name": "Test Amazon",
            "type": "credentials",
            "domain": "amazon.in",
            "data": {
                "username": "test@test.com",
                "password": "testpass123"
            }
        }
        result2 = self.test_endpoint("POST", "/api/secrets", secret_data)
        
        # 3. GET /api/secrets — verify new secret is listed with password masked
        print("3. Testing GET /api/secrets (verify secret added with masked password)")
        result3 = self.test_endpoint("GET", "/api/secrets")
        
        # Check if password is masked
        if result3.get("data") and isinstance(result3["data"], dict):
            secrets = result3["data"].get("secrets", [])
            if secrets:
                secret = secrets[0]
                if "data" in secret and "password" in secret["data"]:
                    password_value = secret["data"]["password"]
                    is_masked = password_value == "***masked***"
                    print(f"    Password masking: {'✅ CORRECT' if is_masked else '❌ NOT MASKED'} (value: {password_value})")
        
        # 4. GET /api/schedules — should return empty list
        print("4. Testing GET /api/schedules (should be empty initially)")
        result4 = self.test_endpoint("GET", "/api/schedules")
        
        # 5. POST /api/schedules — create schedule
        print("5. Testing POST /api/schedules (create test schedule)")
        schedule_data = {
            "name": "Daily Test",
            "blueprint_id": "google_search_v1",
            "cron_expression": "0 9 * * *",
            "timezone": "UTC"
        }
        result5 = self.test_endpoint("POST", "/api/schedules", schedule_data)
        
        # 6. GET /api/schedules — verify schedule appears
        print("6. Testing GET /api/schedules (verify schedule added)")
        result6 = self.test_endpoint("GET", "/api/schedules")
        
        # 7. GET /api/workspaces — should return empty list
        print("7. Testing GET /api/workspaces (should be empty initially)")
        result7 = self.test_endpoint("GET", "/api/workspaces")
        
        # 8. POST /api/workspaces — create workspace
        print("8. Testing POST /api/workspaces (create test workspace)")
        workspace_data = {
            "name": "QA Team"
        }
        result8 = self.test_endpoint("POST", "/api/workspaces", workspace_data)
        
        # 9. GET /api/webhooks — should return empty
        print("9. Testing GET /api/webhooks (should be empty initially)")
        result9 = self.test_endpoint("GET", "/api/webhooks")
        
        # 10. POST /api/webhooks — create webhook
        print("10. Testing POST /api/webhooks (create test webhook)")
        webhook_data = {
            "name": "PR Test",
            "blueprint_id": "google_search_v1"
        }
        result10 = self.test_endpoint("POST", "/api/webhooks", webhook_data)
        
        # 11. GET /api/webhooks — verify webhook with masked token
        print("11. Testing GET /api/webhooks (verify webhook added with masked token)")
        result11 = self.test_endpoint("GET", "/api/webhooks")
        
        # Check if token is masked
        if result11.get("data") and isinstance(result11["data"], dict):
            webhooks = result11["data"].get("webhooks", [])
            if webhooks:
                webhook = webhooks[0]
                if "token" in webhook:
                    token_value = webhook["token"]
                    is_masked = "***" in token_value or token_value == "***masked***"
                    print(f"    Token masking: {'✅ CORRECT' if is_masked else '❌ NOT MASKED'} (value: {token_value})")
        
        # 12. GET /api/analytics/timeseries?period=7d — should return data array
        print("12. Testing GET /api/analytics/timeseries?period=7d")
        result12 = self.test_endpoint("GET", "/api/analytics/timeseries?period=7d")
        
        # 13. GET /api/analytics/flaky — should return flaky_blueprints array
        print("13. Testing GET /api/analytics/flaky")
        result13 = self.test_endpoint("GET", "/api/analytics/flaky")
        
        # 14. GET /api/analytics/regressions — should return regressions array
        print("14. Testing GET /api/analytics/regressions")
        result14 = self.test_endpoint("GET", "/api/analytics/regressions")
        
        # 15. GET /api/health — verify scheduler_running is true
        print("15. Testing GET /api/health (verify scheduler_running)")
        result15 = self.test_endpoint("GET", "/api/health")
        
        # Check scheduler status
        if result15.get("data") and isinstance(result15["data"], dict):
            scheduler_running = result15["data"].get("scheduler_running")
            print(f"    Scheduler running: {'✅ TRUE' if scheduler_running else '❌ FALSE'}")
        
        # Summary
        self.print_summary()
        return self.results
    
    def print_summary(self):
        """Print test summary"""
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print()
        
        # Show failed tests
        if failed_tests > 0:
            print("FAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"❌ {result['method']} {result['endpoint']} -> {result['status_code']}")
                    if result.get("error"):
                        print(f"   Error: {result['error']}")
            print()
        
        # Check for specific requirements
        print("REQUIREMENT CHECKS:")
        
        # Check for ai_analysis in responses
        ai_analysis_found = False
        for result in self.results:
            if result.get("response_data") and isinstance(result["response_data"], dict):
                if "ai_analysis" in result["response_data"]:
                    ai_analysis_found = True
                    break
        print(f"AI Analysis in responses: {'✅ FOUND' if ai_analysis_found else '❌ NOT FOUND'}")
        
        # Check for 500 errors
        server_errors = [r for r in self.results if r["status_code"] >= 500]
        print(f"500 Server Errors: {'❌ FOUND' if server_errors else '✅ NONE'}")
        if server_errors:
            for error in server_errors:
                print(f"   {error['method']} {error['endpoint']} -> {error['status_code']}")
        
        print("=" * 60)

if __name__ == "__main__":
    tester = NPMNewAPITester()
    results = tester.run_all_tests()
    
    # Exit with error code if any tests failed
    failed_count = sum(1 for r in results if not r["success"])
    sys.exit(1 if failed_count > 0 else 0)