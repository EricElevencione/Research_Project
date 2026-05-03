import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    df = pd.read_excel(r"c:\thes\Research_Project\src\docs\Philrice\philrice_seeds_fertilizers.xlsx", sheet_name='🌾 Mestiso 1 (M1)')
    print(df.to_string())
except Exception as e:
    print(f"Error: {e}")
