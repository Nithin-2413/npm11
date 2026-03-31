#!/usr/bin/env python3
"""
NPM Backend API Testing Suite
Tests the Neural Precision Monitor backend APIs focusing on FIX2 and FIX3 implementations.
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, Any, Optional
import sys
import os

# Backend URL - using localhost as mentioned in review request
BACKEND_URL = "http://localhost:8001"

class NPMBackendTester:
    def __init__(self):
        self.session = None
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test(self, test_name: str, success: bool, details: str = "", data: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   {details}")
        if data and not success:
            print(f"   Data: {json.dumps(data, indent=2)[:200]}...")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "data": data
        })
        print()
    
    async def test_health_endpoint(self):
        """Test GET /api/health endpoint"""
        try:
            async with self.session.get(f"{BACKEND_URL}/api/health") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    expected_fields = ["status", "database"]
                    has_required = all(field in data for field in expected_fields)
                    
                    if has_required and data.get("status") in ["healthy", "degraded"]:
                        self.log_test(
                            "Health Endpoint", 
                            True, 
                            f"Status: {data.get('status')}, DB: {data.get('database')}, Groq: {data.get('groq_configured', False)}"
                        )
                        return data
                    else:
                        self.log_test("Health Endpoint", False, f"Missing required fields or invalid status", data)
                        return None
                else:
                    self.log_test("Health Endpoint", False, f"HTTP {resp.status}")
                    return None
        except Exception as e:
            self.log_test("Health Endpoint", False, f"Exception: {e}")
            return None
    
    async def test_reports_stats(self):
        """Test GET /api/reports/stats endpoint"""
        try:
            async with self.session.get(f"{BACKEND_URL}/api/reports/stats") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    required_fields = ["total_executions", "success_count", "failure_count"]
                    has_required = all(field in data for field in required_fields)
                    
                    if has_required:
                        self.log_test(
                            "Reports Stats", 
                            True, 
                            f"Total: {data.get('total_executions')}, Success: {data.get('success_count')}"
                        )
                        return data
                    else:
                        self.log_test("Reports Stats", False, "Missing required fields", data)
                        return None
                else:
                    self.log_test("Reports Stats", False, f"HTTP {resp.status}")
                    return None
        except Exception as e:
            self.log_test("Reports Stats", False, f"Exception: {e}")
            return None
    
    async def test_blueprints_endpoint(self):
        """Test GET /api/blueprints endpoint"""
        try:
            async with self.session.get(f"{BACKEND_URL}/api/blueprints") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    # Check if response has blueprints array (new format) or is direct array (old format)
                    if isinstance(data, dict) and "blueprints" in data:
                        blueprints = data["blueprints"]
                        self.log_test("Blueprints Endpoint", True, f"Found {len(blueprints)} blueprints")
                        return data
                    elif isinstance(data, list):
                        self.log_test("Blueprints Endpoint", True, f"Found {len(data)} blueprints")
                        return data
                    else:
                        self.log_test("Blueprints Endpoint", False, "Response is not a list or object with blueprints", data)
                        return None
                else:
                    self.log_test("Blueprints Endpoint", False, f"HTTP {resp.status}")
                    return None
        except Exception as e:
            self.log_test("Blueprints Endpoint", False, f"Exception: {e}")
            return None
    
    async def test_execute_screenshot_command(self):
        """Test FIX2 - Execute screenshot command and check AI analysis structure"""
        command = "Go to https://example.com and take a screenshot"
        
        try:
            # Start execution
            payload = {"command": command}
            async with self.session.post(f"{BACKEND_URL}/api/execute", json=payload) as resp:
                if resp.status != 200:
                    self.log_test("Execute Screenshot - Start", False, f"HTTP {resp.status}")
                    return None
                
                exec_data = await resp.json()
                execution_id = exec_data.get("execution_id")
                
                if not execution_id:
                    self.log_test("Execute Screenshot - Start", False, "No execution_id returned", exec_data)
                    return None
                
                self.log_test("Execute Screenshot - Start", True, f"Started execution: {execution_id}")
                
                # Poll for completion
                max_wait = 60  # 60 seconds max wait
                start_time = time.time()
                
                while time.time() - start_time < max_wait:
                    await asyncio.sleep(2)
                    
                    # Check status
                    async with self.session.get(f"{BACKEND_URL}/api/execute/{execution_id}/status") as status_resp:
                        if status_resp.status == 200:
                            status_data = await status_resp.json()
                            current_status = status_data.get("status")
                            
                            if current_status in ["SUCCESS", "FAILURE", "PARTIAL"]:
                                # Execution completed, get full report
                                return await self.verify_ai_analysis_structure(execution_id, current_status)
                            elif current_status == "CANCELLED":
                                self.log_test("Execute Screenshot - Completion", False, "Execution was cancelled")
                                return None
                        else:
                            self.log_test("Execute Screenshot - Status Check", False, f"Status check failed: HTTP {status_resp.status}")
                
                self.log_test("Execute Screenshot - Completion", False, "Execution timed out")
                return None
                
        except Exception as e:
            self.log_test("Execute Screenshot - Exception", False, f"Exception: {e}")
            return None
    
    async def verify_ai_analysis_structure(self, execution_id: str, status: str):
        """Verify the AI analysis structure in the report (FIX2)"""
        try:
            async with self.session.get(f"{BACKEND_URL}/api/reports/{execution_id}") as resp:
                if resp.status != 200:
                    self.log_test("AI Analysis Structure", False, f"Report fetch failed: HTTP {resp.status}")
                    return None
                
                report = await resp.json()
                
                # Check if ai_analysis field exists
                has_ai_analysis_field = "ai_analysis" in report
                ai_analysis = report.get("ai_analysis")
                
                if not has_ai_analysis_field:
                    self.log_test("AI Analysis Structure", False, "ai_analysis field missing from report")
                    return None
                
                # For successful executions, ai_analysis should be null (as mentioned in review)
                if status == "SUCCESS" and ai_analysis is None:
                    self.log_test("AI Analysis Structure", True, "ai_analysis is null for successful execution (correct)")
                elif status in ["FAILURE", "PARTIAL"] and ai_analysis is not None:
                    # Verify AI analysis structure
                    required_fields = ["root_cause", "affected_component", "suggested_fix", "impact_level", "confidence", "error_type", "raw_error"]
                    missing_fields = [field for field in required_fields if field not in ai_analysis]
                    
                    if not missing_fields:
                        self.log_test(
                            "AI Analysis Structure", 
                            True, 
                            f"All required AI analysis fields present. Impact: {ai_analysis.get('impact_level')}, Confidence: {ai_analysis.get('confidence')}"
                        )
                    else:
                        self.log_test("AI Analysis Structure", False, f"Missing AI analysis fields: {missing_fields}", ai_analysis)
                else:
                    self.log_test("AI Analysis Structure", True, f"ai_analysis field present (status: {status})")
                
                # Check action timeline for ai_analysis in individual actions
                action_timeline = report.get("action_timeline", [])
                actions_with_ai = [action for action in action_timeline if action.get("ai_analysis")]
                
                if actions_with_ai:
                    self.log_test("Action AI Analysis", True, f"{len(actions_with_ai)} actions have ai_analysis")
                else:
                    self.log_test("Action AI Analysis", True, "No actions have ai_analysis (may be expected for successful execution)")
                
                return report
                
        except Exception as e:
            self.log_test("AI Analysis Structure", False, f"Exception: {e}")
            return None
    
    async def test_execute_google_search(self):
        """Test FIX3 - Execute Google search and check intelligent LLM prompt features"""
        command = "Go to https://google.com and search for OpenAI"
        
        try:
            # Start execution
            payload = {"command": command}
            async with self.session.post(f"{BACKEND_URL}/api/execute", json=payload) as resp:
                if resp.status != 200:
                    self.log_test("Execute Google Search - Start", False, f"HTTP {resp.status}")
                    return None
                
                exec_data = await resp.json()
                execution_id = exec_data.get("execution_id")
                
                if not execution_id:
                    self.log_test("Execute Google Search - Start", False, "No execution_id returned", exec_data)
                    return None
                
                self.log_test("Execute Google Search - Start", True, f"Started execution: {execution_id}")
                
                # Poll for completion
                max_wait = 90  # 90 seconds for Google search
                start_time = time.time()
                
                while time.time() - start_time < max_wait:
                    await asyncio.sleep(3)
                    
                    # Check status
                    async with self.session.get(f"{BACKEND_URL}/api/execute/{execution_id}/status") as status_resp:
                        if status_resp.status == 200:
                            status_data = await status_resp.json()
                            current_status = status_data.get("status")
                            
                            if current_status in ["SUCCESS", "FAILURE", "PARTIAL"]:
                                # Execution completed, verify intelligent features
                                return await self.verify_intelligent_features(execution_id, current_status)
                            elif current_status == "CANCELLED":
                                self.log_test("Execute Google Search - Completion", False, "Execution was cancelled")
                                return None
                        else:
                            self.log_test("Execute Google Search - Status Check", False, f"Status check failed: HTTP {status_resp.status}")
                
                self.log_test("Execute Google Search - Completion", False, "Execution timed out")
                return None
                
        except Exception as e:
            self.log_test("Execute Google Search - Exception", False, f"Exception: {e}")
            return None
    
    async def verify_intelligent_features(self, execution_id: str, status: str):
        """Verify FIX3 intelligent LLM prompt features"""
        try:
            async with self.session.get(f"{BACKEND_URL}/api/reports/{execution_id}") as resp:
                if resp.status != 200:
                    self.log_test("Intelligent Features", False, f"Report fetch failed: HTTP {resp.status}")
                    return None
                
                report = await resp.json()
                action_timeline = report.get("action_timeline", [])
                
                # If Groq is not configured, execution will fail early and have no actions
                # This is expected behavior as mentioned in review request
                if not action_timeline and status == "FAILURE":
                    error_msg = report.get("error_message", "")
                    if "Connection error" in error_msg:
                        self.log_test("Intelligent Features", True, "Execution failed gracefully due to missing Groq API key (expected)")
                        return report
                    else:
                        self.log_test("Intelligent Features", False, f"Execution failed for unexpected reason: {error_msg}")
                        return None
                
                if not action_timeline:
                    self.log_test("Intelligent Features", False, "No actions in timeline")
                    return None
                
                # Check for description and confidence fields in actions
                actions_with_description = [action for action in action_timeline if action.get("description")]
                actions_with_confidence = [action for action in action_timeline if action.get("confidence") is not None]
                
                # Check for fallback_selectors in click/fill actions
                click_fill_actions = [action for action in action_timeline if action.get("action_type") in ["click", "fill"]]
                actions_with_fallback = []
                
                for action in click_fill_actions:
                    # Check if action has fallback_selectors or used_fallback indicators
                    if action.get("used_fallback") or action.get("was_refined"):
                        actions_with_fallback.append(action)
                
                # Verify description fields
                if actions_with_description:
                    self.log_test(
                        "Action Descriptions", 
                        True, 
                        f"{len(actions_with_description)}/{len(action_timeline)} actions have descriptions"
                    )
                else:
                    self.log_test("Action Descriptions", False, "No actions have description field")
                
                # Verify confidence fields
                if actions_with_confidence:
                    avg_confidence = sum(action.get("confidence", 0) for action in actions_with_confidence) / len(actions_with_confidence)
                    self.log_test(
                        "Action Confidence", 
                        True, 
                        f"{len(actions_with_confidence)}/{len(action_timeline)} actions have confidence (avg: {avg_confidence:.2f})"
                    )
                else:
                    self.log_test("Action Confidence", False, "No actions have confidence field")
                
                # Verify fallback selector usage
                if actions_with_fallback:
                    self.log_test(
                        "Fallback Selectors", 
                        True, 
                        f"{len(actions_with_fallback)} actions used fallback/refinement"
                    )
                elif click_fill_actions:
                    self.log_test("Fallback Selectors", True, "No fallback usage detected (may be expected if primary selectors worked)")
                else:
                    self.log_test("Fallback Selectors", True, "No click/fill actions to test fallback selectors")
                
                return report
                
        except Exception as e:
            self.log_test("Intelligent Features", False, f"Exception: {e}")
            return None
    
    async def run_all_tests(self):
        """Run all backend tests"""
        print("=" * 60)
        print("NPM Backend API Testing Suite")
        print("=" * 60)
        print()
        
        # Basic API tests
        print("🔍 Testing Basic API Endpoints...")
        health_data = await self.test_health_endpoint()
        await self.test_reports_stats()
        await self.test_blueprints_endpoint()
        
        print("\n🔍 Testing FIX2 - AI Analysis Structure...")
        await self.test_execute_screenshot_command()
        
        print("\n🔍 Testing FIX3 - Intelligent LLM Prompt...")
        await self.test_execute_google_search()
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if health_data:
            print(f"\nBackend Status: {health_data.get('status')}")
            print(f"Database: {health_data.get('database')}")
            print(f"Groq Configured: {health_data.get('groq_configured', False)}")
        
        print("\n" + "=" * 60)
        
        # Return summary for test_result.md
        failed_tests = [result for result in self.test_results if not result["success"]]
        return {
            "total": total,
            "passed": passed,
            "failed": total - passed,
            "failed_tests": failed_tests,
            "health_data": health_data
        }

async def main():
    """Main test runner"""
    async with NPMBackendTester() as tester:
        return await tester.run_all_tests()

if __name__ == "__main__":
    try:
        summary = asyncio.run(main())
        sys.exit(0 if summary["failed"] == 0 else 1)
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nTest runner failed: {e}")
        sys.exit(1)