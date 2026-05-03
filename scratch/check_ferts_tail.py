import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    xl = pd.ExcelFile(r"c:\thes\Research_Project\src\docs\Philrice\philrice_seeds_fertilizers.xlsx")
    df = xl.parse('🧪 Fertilizers Catalog')
    print(df.iloc[20:].to_string())
except Exception as e:
    print(f"Error: {e}")
