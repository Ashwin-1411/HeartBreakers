import pandas as pd

def profile_dataset(df: pd.DataFrame):
    profile = {"attributes": {}}
    total = len(df)

    for col in df.columns:
        series = df[col]

        profile["attributes"][col] = {
            "null_rate": float(series.isnull().sum() / total),
            "duplicate_rate": float(1 - series.nunique() / total),
            "data_type": str(series.dtype)
        }

    return profile