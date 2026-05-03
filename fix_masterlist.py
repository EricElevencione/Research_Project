import re
import os

file_path = r'c:\thes\Research_Project\src\screens\admin\MasterlistPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add state variables
state_injection = """  const [printingRecordIds, setPrintingRecordIds] = useState<Set<string>>(
    new Set(),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(15);"""

content = content.replace('  const [printingRecordIds, setPrintingRecordIds] = useState<Set<string>>(\n    new Set(),\n  );', state_injection)

# Add useEffect to reset page
effect_injection = """  useEffect(() => {
    fetchRSBSARecords();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, barangayFilter]);"""

content = content.replace('  useEffect(() => {\n    fetchRSBSARecords();\n  }, []);', effect_injection)

# Fix the slice logic (it's already there, but we need the state variables we just added)

# Add pagination UI
# Find the end of the table container
pagination_ui = """              </div>

              {!loading && !error && filteredRecords.length > recordsPerPage && (
                <div className="masterlist-admin-pagination">
                  <button
                    className="masterlist-admin-pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span className="masterlist-admin-pagination-info">
                    Page {currentPage} of {Math.ceil(filteredRecords.length / recordsPerPage)}
                  </span>
                  <button
                    className="masterlist-admin-pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredRecords.length / recordsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(filteredRecords.length / recordsPerPage)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>"""

# Replace the closing divs of the table container area
content = content.replace('              </div>\n            </div>', pagination_ui)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated MasterlistPage.tsx")
