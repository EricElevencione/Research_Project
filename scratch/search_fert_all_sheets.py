import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    xl = pd.ExcelFile(r"c:\thes\Research_Project\src\docs\Philrice\philrice_seeds_fertilizers.xlsx")
    for s in xl.sheet_names:
        df = xl.parse(s)
        matches = df[df.apply(lambda row: row.astype(str).str.contains('Fertilizer', case=False).any(), axis=1)]
        if not matches.empty:
            print(f"--- Sheet: {s} ---")
            print(matches.to_string())
except Exception as e:
    print(f"Error: {e}")
