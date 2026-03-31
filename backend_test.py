#!/usr/bin/env python3
"""
NPM Backend API Testing Suite
Tests all backend endpoints as specified in the review request.
"""

import asyncio
import json
import time
import requests
from typing import Dict, Any, Optional
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')
print(f"Testing backend at: {BACKEND_URL}")

class NPMBackendTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.test_results = []
        self.created_blueprint_id = None
        self.execution_id = None

    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        if response_data and not success:
            print(f"    Response: {response_data}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details,
            'response': response_data if not success else None
        })

    def test_health_endpoint(self):
        """Test GET /api/health"""
        try:
            response = self.session.get(f"{self.base_url}/api/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                expected_keys = ['status', 'database']
                
                if all(key in data for key in expected_keys):
                    if data['status'] == 'healthy' and data['database'] == 'connected':
                        self.log_test("GET /api/health", True, f"Status: {data['status']}, DB: {data['database']}")
                    else:
                        self.log_test("GET /api/health", False, f"Unexpected status or database state", data)
                else:
                    self.log_test("GET /api/health", False, f"Missing required keys", data)
            else:
                self.log_test("GET /api/health", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("GET /api/health", False, f"Exception: {str(e)}")

    def test_blueprints_list(self):
        """Test GET /api/blueprints - should return 5 templates"""
        try:
            response = self.session.get(f"{self.base_url}/api/blueprints", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                # Handle wrapped response format
                blueprints = data.get('blueprints', data) if isinstance(data, dict) else data
                
                if isinstance(blueprints, list) and len(blueprints) >= 5:
                    self.log_test("GET /api/blueprints", True, f"Found {len(blueprints)} blueprints (expected ≥5)")
                else:
                    self.log_test("GET /api/blueprints", False, f"Expected ≥5 blueprints, got {len(blueprints) if isinstance(blueprints, list) else 'non-list'}", data)
            else:
                self.log_test("GET /api/blueprints", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("GET /api/blueprints", False, f"Exception: {str(e)}")

    def test_reports_stats(self):
        """Test GET /api/reports/stats"""
        try:
            response = self.session.get(f"{self.base_url}/api/reports/stats", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                expected_keys = ['total_executions', 'success_rate', 'avg_duration']
                
                if all(key in data for key in expected_keys):
                    self.log_test("GET /api/reports/stats", True, f"Stats: {data}")
                else:
                    self.log_test("GET /api/reports/stats", False, f"Missing expected keys", data)
            else:
                self.log_test("GET /api/reports/stats", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("GET /api/reports/stats", False, f"Exception: {str(e)}")

    def test_reports_list(self):
        """Test GET /api/reports"""
        try:
            response = self.session.get(f"{self.base_url}/api/reports", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                # Handle wrapped response format
                reports = data.get('reports', data) if isinstance(data, dict) else data
                
                if isinstance(reports, list):
                    self.log_test("GET /api/reports", True, f"Found {len(reports)} reports")
                else:
                    self.log_test("GET /api/reports", False, f"Expected list, got {type(reports)}", data)
            else:
                self.log_test("GET /api/reports", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("GET /api/reports", False, f"Exception: {str(e)}")

    def test_execute_command(self):
        """Test POST /api/execute"""
        try:
            payload = {
                "command": "Go to https://example.com and take a screenshot",
                "options": {"headless": True}
            }
            
            response = self.session.post(f"{self.base_url}/api/execute", 
                                       json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'execution_id' in data:
                    self.execution_id = data['execution_id']
                    self.log_test("POST /api/execute", True, f"Execution started: {self.execution_id}")
                else:
                    self.log_test("POST /api/execute", False, f"Missing execution_id", data)
            else:
                self.log_test("POST /api/execute", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("POST /api/execute", False, f"Exception: {str(e)}")

    def test_execution_completion(self):
        """Wait for execution to complete and verify new report"""
        if not self.execution_id:
            self.log_test("Execution completion check", False, "No execution_id available")
            return
            
        print(f"⏳ Waiting 30 seconds for execution {self.execution_id} to complete...")
        time.sleep(30)
        
        try:
            # Check if new report was added
            response = self.session.get(f"{self.base_url}/api/reports", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                # Handle wrapped response format
                reports = data.get('reports', data) if isinstance(data, dict) else data
                
                # Look for our execution in the reports
                execution_report = None
                for report in reports:
                    if isinstance(report, dict) and report.get('execution_id') == self.execution_id:
                        execution_report = report
                        break
                
                if execution_report:
                    status = execution_report.get('status', 'UNKNOWN')
                    if status == 'SUCCESS':
                        self.log_test("Execution completion", True, f"Execution {self.execution_id} completed with status: {status}")
                        
                        # Test detailed report endpoint
                        self.test_detailed_report(self.execution_id)
                    else:
                        self.log_test("Execution completion", False, f"Execution {self.execution_id} status: {status}")
                else:
                    self.log_test("Execution completion", False, f"Execution {self.execution_id} not found in reports")
            else:
                self.log_test("Execution completion", False, f"Failed to fetch reports: HTTP {response.status_code}")
                
        except Exception as e:
            self.log_test("Execution completion", False, f"Exception: {str(e)}")

    def test_detailed_report(self, execution_id: str):
        """Test GET /api/reports/{execution_id}"""
        try:
            response = self.session.get(f"{self.base_url}/api/reports/{execution_id}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['action_timeline', 'network_logs', 'ai_summary']
                
                missing_fields = [field for field in required_fields if field not in data or not data[field]]
                
                if not missing_fields:
                    self.log_test(f"GET /api/reports/{execution_id}", True, "All required fields populated")
                else:
                    self.log_test(f"GET /api/reports/{execution_id}", False, f"Missing/empty fields: {missing_fields}")
            else:
                self.log_test(f"GET /api/reports/{execution_id}", False, f"HTTP {response.status_code}")
                
        except Exception as e:
            self.log_test(f"GET /api/reports/{execution_id}", False, f"Exception: {str(e)}")

    def test_create_blueprint(self):
        """Test POST /api/blueprints"""
        try:
            blueprint_data = {
                "name": "Test Blueprint",
                "description": "Test blueprint for API testing",
                "actions": [
                    {"type": "navigate", "url": "https://example.com"},
                    {"type": "screenshot", "filename": "test"}
                ],
                "variables": []
            }
            
            response = self.session.post(f"{self.base_url}/api/blueprints", 
                                       json=blueprint_data, timeout=10)
            
            if response.status_code == 201:
                data = response.json()
                # Handle both 'id' and 'blueprint_id' response formats
                blueprint_id = data.get('id') or data.get('blueprint_id')
                if blueprint_id:
                    self.created_blueprint_id = blueprint_id
                    self.log_test("POST /api/blueprints", True, f"Blueprint created: {self.created_blueprint_id}")
                else:
                    self.log_test("POST /api/blueprints", False, f"Missing blueprint id", data)
            else:
                self.log_test("POST /api/blueprints", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("POST /api/blueprints", False, f"Exception: {str(e)}")

    def test_get_blueprint(self):
        """Test GET /api/blueprints/{id}"""
        if not self.created_blueprint_id:
            self.log_test("GET /api/blueprints/{id}", False, "No blueprint ID available")
            return
            
        try:
            response = self.session.get(f"{self.base_url}/api/blueprints/{self.created_blueprint_id}", 
                                      timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('name') == 'Test Blueprint':
                    self.log_test("GET /api/blueprints/{id}", True, f"Blueprint retrieved successfully")
                else:
                    self.log_test("GET /api/blueprints/{id}", False, f"Blueprint data mismatch", data)
            else:
                self.log_test("GET /api/blueprints/{id}", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("GET /api/blueprints/{id}", False, f"Exception: {str(e)}")

    def test_inject_variables(self):
        """Test POST /api/blueprints/{id}/inject"""
        if not self.created_blueprint_id:
            self.log_test("POST /api/blueprints/{id}/inject", False, "No blueprint ID available")
            return
            
        try:
            variables = {"variables": {"TEST": "value"}}
            
            response = self.session.post(f"{self.base_url}/api/blueprints/{self.created_blueprint_id}/inject", 
                                       json=variables, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("POST /api/blueprints/{id}/inject", True, f"Variables injected successfully")
            else:
                self.log_test("POST /api/blueprints/{id}/inject", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("POST /api/blueprints/{id}/inject", False, f"Exception: {str(e)}")

    def test_delete_blueprint(self):
        """Test DELETE /api/blueprints/{id}"""
        if not self.created_blueprint_id:
            self.log_test("DELETE /api/blueprints/{id}", False, "No blueprint ID available")
            return
            
        try:
            response = self.session.delete(f"{self.base_url}/api/blueprints/{self.created_blueprint_id}", 
                                         timeout=10)
            
            if response.status_code == 200:
                self.log_test("DELETE /api/blueprints/{id}", True, f"Blueprint deleted successfully")
            else:
                self.log_test("DELETE /api/blueprints/{id}", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("DELETE /api/blueprints/{id}", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("=" * 60)
        print("NPM Backend API Testing Suite")
        print("=" * 60)
        
        # Basic health and data endpoints
        self.test_health_endpoint()
        self.test_blueprints_list()
        self.test_reports_stats()
        self.test_reports_list()
        
        # Execution flow
        self.test_execute_command()
        self.test_execution_completion()
        
        # Blueprint CRUD
        self.test_create_blueprint()
        self.test_get_blueprint()
        self.test_inject_variables()
        self.test_delete_blueprint()
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"❌ {result['test']}: {result['details']}")
        
        return passed == total

def main():
    tester = NPMBackendTester(BACKEND_URL)
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        exit(0)
    else:
        print("\n💥 Some tests failed!")
        exit(1)

if __name__ == "__main__":
    main()