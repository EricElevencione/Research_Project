import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    df = pd.read_excel(r"c:\thes\Research_Project\src\docs\Philrice\philrice_seeds_fertilizers.xlsx")
    print("Columns:")
    for col in df.columns:
        print(f"- {col}")
except Exception as e:
    print(f"Error: {e}")
