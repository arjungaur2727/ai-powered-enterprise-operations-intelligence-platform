import requests
import uuid

url = "https://enterprise-ops-backend.onrender.com/api/v1/auth/register"
email = f"test_{uuid.uuid4().hex[:6]}@example.com"
payload = {
    "email": email,
    "full_name": "Test User",
    "password": "password123",
    "role": "analyst"
}

try:
    print(f"Registering: {email}")
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
