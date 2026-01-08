import pandas as pd
from profiler.data_profiler import profile_dataset
from knowledge_layer.knowledge_engine import run_knowledge_layer

df = pd.read_csv("messy_clients_with_fatf_ofac.csv")  # your AML/KYC CSV

profile = profile_dataset(df)
print("\n=== PROFILE ===")
print(profile)

knowledge = run_knowledge_layer(profile)
print("\n=== KNOWLEDGE OUTPUT ===")
print(knowledge)