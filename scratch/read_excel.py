import pandas as pd
import sys
import io

# Set encoding to utf-8 for output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    df = pd.read_excel(r"c:\thes\Research_Project\src\docs\Philrice\philrice_seeds_fertilizers.xlsx")
    print("Columns:", df.columns.tolist())
    # Try to find fertilizer related columns
    # Let's print the first sheet's content
    print(df.to_string())
except Exception as e:
    print(f"Error: {e}")
