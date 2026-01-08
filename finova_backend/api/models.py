from django.contrib.auth import get_user_model
from django.db import models


class AnalysisResult(models.Model):
	user = models.ForeignKey(
		get_user_model(),
		on_delete=models.CASCADE,
		related_name="analysis_results",
	)
	dataset_name = models.CharField(max_length=255)
	created_at = models.DateTimeField(auto_now_add=True)
	overall_dqs = models.FloatField()
	dimension_scores = models.JSONField(default=dict)
	reasoned_stats = models.JSONField(default=list)
	genai_summary = models.TextField(blank=True)
	genai_recommendations = models.JSONField(default=list)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self) -> str:  # pragma: no cover - convenience only
		return f"{self.dataset_name} ({self.overall_dqs:.2f})"
