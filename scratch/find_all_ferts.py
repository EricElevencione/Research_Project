import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    df = pd.read_excel(r"c:\thes\Research_Project\src\docs\Philrice\philrice_seeds_fertilizers.xlsx", sheet_name='🧪 Fertilizers Catalog', header=None)
    for i, row in df.iterrows():
        name = str(row[1]).strip()
        if name and name != 'nan' and name != 'Fertilizer Name' and not name.startswith('Source:') and not name.startswith('🟤') and not name.startswith('🔵'):
            print(f"Found Fertilizer: {name} (Category: {row[2]})")
except Exception as e:
    print(f"Error: {e}")
