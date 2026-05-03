
import sys

file_path = 'c:/thes/Research_Project/src/screens/technicians/TechManageRequests.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Lines are 1-indexed in my head, but 0-indexed in list
# Line 2645 is index 2644
# Line 2707 is index 2706
# We want to remove lines 2645 to 2707 inclusive.
start_idx = 2644
end_idx = 2706

new_lines = lines[:start_idx] + lines[end_idx+1:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Removed lines {start_idx+1} to {end_idx+1}")
