import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    xl = pd.ExcelFile(r"c:\thes\Research_Project\src\docs\Philrice\philrice_seeds_fertilizers.xlsx")
    all_ferts = set()
    for s in xl.sheet_names:
        if s.startswith('🌾 Mestiso') or s.startswith('🌿 NSIC') or s.startswith('🌿 Tubigan') or s.startswith('🌿 Sahod') or s.startswith('🌿 Salinas') or s.startswith('🌿 Malagkit') or s.startswith('🌿 Lumping') or s.startswith('🌿 LP'):
            df = xl.parse(s, header=None)
            # Find the header row (contains 'Urea')
            header_row = None
            for i, row in df.iterrows():
                if any('Urea' in str(cell) for cell in row):
                    header_row = i
                    break
            if header_row is not None:
                headers = df.iloc[header_row].tolist()
                for h in headers:
                    h_str = str(h).strip()
                    if h_str and h_str != 'nan' and ('(' in h_str or 'Liquid' in h_str):
                        all_ferts.add(h_str)
    
    print("Fertilizers found in seed sheets:")
    for f in sorted(list(all_ferts)):
        print(f"- {f}")
except Exception as e:
    print(f"Error: {e}")
