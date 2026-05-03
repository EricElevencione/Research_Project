import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    df = pd.read_excel(r"c:\thes\Research_Project\src\docs\Philrice\philrice_seeds_fertilizers.xlsx", sheet_name='🧪 Fertilizers Catalog', header=None)
    for i, row in df.iterrows():
        print(f"Row {i}: {row.tolist()}")
except Exception as e:
    print(f"Error: {e}")
