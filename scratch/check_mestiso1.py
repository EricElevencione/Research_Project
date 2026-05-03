import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    xl = pd.ExcelFile(r"c:\thes\Research_Project\src\docs\Philrice\philrice_seeds_fertilizers.xlsx")
    df = xl.parse('🌾 Mestiso 1 (M1)')
    print(df.to_string())
except Exception as e:
    print(f"Error: {e}")
