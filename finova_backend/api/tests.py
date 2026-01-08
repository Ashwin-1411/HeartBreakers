import textwrap
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient


class AnalyzeDatasetViewTests(TestCase):
	def setUp(self):
		user_model = get_user_model()
		self.user = user_model.objects.create_user(username="analyst", password="secret123")
		self.token = Token.objects.create(user=self.user)
		self.client = APIClient()
		self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

	def _post_csv(self, content: str, filename: str = "dataset.csv"):
		upload = SimpleUploadedFile(filename, content.encode("utf-8"), content_type="text/csv")
		url = reverse("analyze")
		return self.client.post(url, {"file": upload}, format="multipart")

	def test_rejects_non_finance_columns(self):
		csv_content = "address,price\n123 Main St,450000\n456 Side St,510000\n"
		response = self._post_csv(csv_content, "housing.csv")

		self.assertEqual(response.status_code, 400)
		body = response.json()
		self.assertIn("financial", body.get("error", "").lower())

	@patch("api.views.run_knowledge_layer")
	def test_rejects_when_ontology_matches_none(self, mock_run):
		mock_run.return_value = {
			"reasoned_stats": [],
			"summary": "No matches",
			"overall_dqs": 1.0,
			"dimension_scores": {},
			"matched_attributes": 0,
		}

		csv_content = textwrap.dedent(
			"""
			client_identifier,client_name,account_country,pep_flag,sanctions_flag
			1,Alice,US,0,0
			2,Bob,US,1,0
			"""
		).strip()

		response = self._post_csv(csv_content, "finance_like.csv")

		self.assertEqual(response.status_code, 400)
		body = response.json()
		self.assertIn("ontology", body.get("error", "").lower())

		mock_run.assert_called_once()


class AuthenticationSecurityTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.register_url = reverse("register")
		self.login_url = reverse("login")

	def test_registration_rejects_weak_password(self):
		payload = {
			"username": "weakling",
			"password": "password123",
			"email": "weak@example.com",
		}

		response = self.client.post(self.register_url, payload, format="json")

		self.assertEqual(response.status_code, 400)
		self.assertIn("password", response.json().get("error", "").lower())

	def test_registration_and_login_with_strong_password(self):
		strong_password = "UltraStrong!234"
		payload = {
			"username": "secureuser",
			"password": strong_password,
			"email": "secure@example.com",
		}

		response = self.client.post(self.register_url, payload, format="json")

		self.assertEqual(response.status_code, 201)
		body = response.json()
		self.assertIn("token", body)

		user = get_user_model().objects.get(username="secureuser")
		self.assertTrue(user.password.startswith("bcrypt_sha256$"))

		login_response = self.client.post(
			self.login_url,
			{"username": "secureuser", "password": strong_password},
			format="json",
		)

		self.assertEqual(login_response.status_code, 200)
		self.assertIn("token", login_response.json())
