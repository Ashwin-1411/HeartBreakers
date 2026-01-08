import pandas as pd
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from core.profiler.data_profiler import profile_dataset
from core.knowledge_layer.knowledge_engine import run_knowledge_layer

@csrf_exempt
def analyze_dataset(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    csv_file = request.FILES.get("file")
    if not csv_file:
        return JsonResponse({"error": "No file uploaded"}, status=400)

    df = pd.read_csv(csv_file)

    profile = profile_dataset(df)
    knowledge_output = run_knowledge_layer(profile)

    return JsonResponse(knowledge_output, safe=False)