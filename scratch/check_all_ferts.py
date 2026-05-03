import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    xl = pd.ExcelFile(r"c:\thes\Research_Project\src\docs\Philrice\philrice_seeds_fertilizers.xlsx")
    # Search for all sheets that might contain fertilizer info
    for sheet in xl.sheet_names:
        if 'Fertilizer' in sheet or 'Abonong' in sheet:
            print(f"--- Sheet: {sheet} ---")
            df = xl.parse(sheet)
            print(df.head(20).to_string())
except Exception as e:
    print(f"Error: {e}")
