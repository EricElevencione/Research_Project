import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    xl = pd.ExcelFile(r"c:\thes\Research_Project\src\docs\Philrice\philrice_seeds_fertilizers.xlsx")
    
    # Check "Abonong Swak" sheet
    if 'Abonong Swak' in xl.sheet_names:
        print("\n--- Sheet: Abonong Swak ---")
        df = xl.parse('Abonong Swak')
        print(df.to_string())
        
    # Check "Fertilizer Derby" sheet
    if 'Fertilizer Derby' in xl.sheet_names:
        print("\n--- Sheet: Fertilizer Derby ---")
        df = xl.parse('Fertilizer Derby')
        print(df.to_string())

except Exception as e:
    print(f"Error: {e}")
