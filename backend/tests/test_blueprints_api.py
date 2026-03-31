"""
Backend API Tests for NPM (Neural Precision Monitor)
Tests Blueprint CRUD operations and related endpoints
"""
import pytest
import requests
import os
import time

# Get BASE_URL from environment - use the public preview URL
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://npm-audit-hub.preview.emergentagent.com').rstrip('/')


class TestHealthEndpoint:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✅ Health check passed: {data}")


class TestBlueprintsCRUD:
    """Blueprint CRUD API tests"""
    
    def test_list_blueprints(self):
        """Test GET /api/blueprints returns list of blueprints"""
        response = requests.get(f"{BASE_URL}/api/blueprints")
        assert response.status_code == 200
        data = response.json()
        assert "blueprints" in data
        assert "total" in data
        assert isinstance(data["blueprints"], list)
        assert data["total"] >= 5  # Should have seeded blueprints
        print(f"✅ List blueprints: {data['total']} blueprints found")
    
    def test_get_blueprint_by_id(self):
        """Test GET /api/blueprints/{id} returns blueprint details"""
        # First get list to find a valid ID
        list_response = requests.get(f"{BASE_URL}/api/blueprints")
        blueprints = list_response.json()["blueprints"]
        assert len(blueprints) > 0, "No blueprints found to test"
        
        bp_id = blueprints[0]["blueprint_id"]
        response = requests.get(f"{BASE_URL}/api/blueprints/{bp_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["blueprint_id"] == bp_id
        assert "name" in data
        assert "actions" in data
        print(f"✅ Get blueprint by ID: {data['name']}")
    
    def test_get_blueprint_not_found(self):
        """Test GET /api/blueprints/{id} returns 404 for non-existent blueprint"""
        response = requests.get(f"{BASE_URL}/api/blueprints/nonexistent_id_12345")
        assert response.status_code == 404
        print("✅ Get non-existent blueprint returns 404")
    
    def test_create_blueprint(self):
        """Test POST /api/blueprints creates a new blueprint"""
        payload = {
            "name": "TEST_Create_Blueprint",
            "description": "Test blueprint created by pytest",
            "version": "1.0",
            "variables": [
                {"name": "TEST_VAR", "default_value": "test_value", "type": "text", "required": False}
            ],
            "actions": [
                {"id": "act1", "type": "navigate", "url": "https://example.com", "timeout": 5000, "optional": False},
                {"id": "act2", "type": "screenshot", "timeout": 5000, "optional": False}
            ]
        }
        response = requests.post(f"{BASE_URL}/api/blueprints", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert "blueprint_id" in data
        assert data["message"] == "Blueprint created successfully"
        
        # Verify by fetching the created blueprint
        bp_id = data["blueprint_id"]
        get_response = requests.get(f"{BASE_URL}/api/blueprints/{bp_id}")
        assert get_response.status_code == 200
        created_bp = get_response.json()
        assert created_bp["name"] == "TEST_Create_Blueprint"
        assert len(created_bp["actions"]) == 2
        print(f"✅ Create blueprint: {bp_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/blueprints/{bp_id}")
    
    def test_update_blueprint(self):
        """Test PUT /api/blueprints/{id} updates a blueprint"""
        # First create a blueprint to update
        create_payload = {
            "name": "TEST_Update_Blueprint",
            "description": "Original description",
            "version": "1.0",
            "variables": [],
            "actions": [
                {"id": "act1", "type": "navigate", "url": "https://example.com", "timeout": 5000, "optional": False}
            ]
        }
        create_response = requests.post(f"{BASE_URL}/api/blueprints", json=create_payload)
        assert create_response.status_code == 201
        bp_id = create_response.json()["blueprint_id"]
        
        # Update the blueprint
        update_payload = {
            "name": "TEST_Update_Blueprint_Modified",
            "description": "Updated description",
            "actions": [
                {"id": "act1", "type": "navigate", "url": "https://updated-example.com", "timeout": 5000, "optional": False},
                {"id": "act2", "type": "screenshot", "timeout": 5000, "optional": False}
            ]
        }
        update_response = requests.put(f"{BASE_URL}/api/blueprints/{bp_id}", json=update_payload)
        assert update_response.status_code == 200
        
        # Verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/blueprints/{bp_id}")
        updated_bp = get_response.json()
        assert updated_bp["name"] == "TEST_Update_Blueprint_Modified"
        assert updated_bp["description"] == "Updated description"
        assert len(updated_bp["actions"]) == 2
        print(f"✅ Update blueprint: {bp_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/blueprints/{bp_id}")
    
    def test_delete_blueprint(self):
        """Test DELETE /api/blueprints/{id} deletes a blueprint"""
        # First create a blueprint to delete
        create_payload = {
            "name": "TEST_Delete_Blueprint",
            "description": "Blueprint to be deleted",
            "version": "1.0",
            "variables": [],
            "actions": [
                {"id": "act1", "type": "navigate", "url": "https://example.com", "timeout": 5000, "optional": False}
            ]
        }
        create_response = requests.post(f"{BASE_URL}/api/blueprints", json=create_payload)
        assert create_response.status_code == 201
        bp_id = create_response.json()["blueprint_id"]
        
        # Delete the blueprint
        delete_response = requests.delete(f"{BASE_URL}/api/blueprints/{bp_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/blueprints/{bp_id}")
        assert get_response.status_code == 404
        print(f"✅ Delete blueprint: {bp_id}")
    
    def test_duplicate_blueprint(self):
        """Test POST /api/blueprints/{id}/duplicate creates a copy"""
        # Get an existing blueprint
        list_response = requests.get(f"{BASE_URL}/api/blueprints")
        blueprints = list_response.json()["blueprints"]
        original_bp = blueprints[0]
        original_id = original_bp["blueprint_id"]
        
        # Duplicate it
        dup_response = requests.post(f"{BASE_URL}/api/blueprints/{original_id}/duplicate")
        assert dup_response.status_code == 200
        data = dup_response.json()
        assert "blueprint_id" in data
        new_id = data["blueprint_id"]
        
        # Verify the duplicate
        get_response = requests.get(f"{BASE_URL}/api/blueprints/{new_id}")
        assert get_response.status_code == 200
        dup_bp = get_response.json()
        assert "(Copy)" in dup_bp["name"]
        print(f"✅ Duplicate blueprint: {original_id} -> {new_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/blueprints/{new_id}")
    
    def test_inject_variables(self):
        """Test POST /api/blueprints/{id}/inject injects variables"""
        # Get a blueprint with variables (login_flow_v1)
        response = requests.get(f"{BASE_URL}/api/blueprints/login_flow_v1")
        if response.status_code != 200:
            pytest.skip("login_flow_v1 blueprint not found")
        
        # Inject variables
        inject_payload = {
            "variables": {
                "USER_EMAIL": "test@example.com",
                "USER_PASSWORD": "testpass123"
            }
        }
        inject_response = requests.post(f"{BASE_URL}/api/blueprints/login_flow_v1/inject", json=inject_payload)
        assert inject_response.status_code == 200
        data = inject_response.json()
        assert "blueprint" in data
        assert "ready_to_execute" in data
        print(f"✅ Inject variables: ready_to_execute={data['ready_to_execute']}")


class TestReportsAPI:
    """Reports API tests"""
    
    def test_get_reports_stats(self):
        """Test GET /api/reports/stats returns dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/reports/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_executions" in data
        assert "success_rate" in data
        assert "total_blueprints" in data
        print(f"✅ Reports stats: {data['total_executions']} executions, {data['success_rate']*100:.1f}% success rate")
    
    def test_list_reports(self):
        """Test GET /api/reports returns list of execution reports"""
        response = requests.get(f"{BASE_URL}/api/reports")
        assert response.status_code == 200
        data = response.json()
        assert "reports" in data
        assert "total" in data
        print(f"✅ List reports: {data['total']} reports found")


class TestExecuteAPI:
    """Execute API tests"""
    
    def test_execute_command(self):
        """Test POST /api/execute starts an execution"""
        payload = {
            "command": "Go to https://example.com and take a screenshot",
            "options": {}
        }
        response = requests.post(f"{BASE_URL}/api/execute", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "execution_id" in data
        assert data["status"] == "RUNNING"
        print(f"✅ Execute command: {data['execution_id']}")
        
        # Wait a bit and check status
        time.sleep(2)
        status_response = requests.get(f"{BASE_URL}/api/execute/{data['execution_id']}/status")
        assert status_response.status_code == 200
        print(f"✅ Execution status: {status_response.json()['status']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
