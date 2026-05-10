import requests

url = "https://enterprise-ops-backend.onrender.com/api/v1/auth/login"
payload = {
    "email": "arjungaur2727@gmail.com",
    "password": "arjun123"
}

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
