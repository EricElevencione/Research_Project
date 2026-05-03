import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    xl = pd.ExcelFile(r"c:\thes\Research_Project\src\docs\Philrice\philrice_seeds_fertilizers.xlsx")
    df = xl.parse('🌾 Seeds Catalog')
    # Row 2 contains Variety Names
    # Varieties start from row 4
    varieties = df.iloc[4:, 1].dropna().tolist()
    print(f"Varieties in Excel: {varieties}")
except Exception as e:
    print(f"Error: {e}")
