import os
import glob

jo_dir = r'c:\thes\Research_Project\src\screens\JO'
jo_files = glob.glob(os.path.join(jo_dir, '*.tsx'))

state_logic = '''
  const [currentUser, setCurrentUser] = useState<{
    firstName: string;
    lastName: string;
  } | null>(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const firstName = user.user_metadata?.first_name || '';
        const lastName = user.user_metadata?.last_name || '';
        setCurrentUser({ firstName, lastName });
      }
    };
    fetchCurrentUser();
  }, []);
'''

ui_logic = '''
            {currentUser && (
              <div className="sidebar-current-user">
                <div className="sidebar-current-user-avatar">
                  {currentUser.firstName.charAt(0).toUpperCase()}
                  {currentUser.lastName.charAt(0).toUpperCase()}
                </div>
                <div className="sidebar-current-user-info">
                  <span className="sidebar-current-user-name">
                    {currentUser.firstName} {currentUser.lastName}
                  </span>
                  <span className="sidebar-current-user-label">Logged in</span>
                </div>
              </div>
            )}
'''

for filepath in jo_files:
    if 'JoDashboard.tsx' in filepath:
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'setCurrentUser' in content:
        continue

    if 'import { supabase }' not in content:
        content = content.replace('import React', 'import { supabase } from \"../../supabase\";\\nimport React', 1)

    # Some files might not useLocation, let's use navigate as fallback
    if 'const location = useLocation();' in content:
        content = content.replace('const location = useLocation();\\n', f'const location = useLocation();\\n{state_logic}\\n')
    else:
        content = content.replace('const navigate = useNavigate();\\n', f'const navigate = useNavigate();\\n{state_logic}\\n')

    # Add UI logic
    if '</nav>' in content:
        content = content.replace('          </nav>', f'{ui_logic}          </nav>')
    elif '        </nav>' in content:
        content = content.replace('        </nav>', f'{ui_logic}        </nav>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print('Done processing JO files!')
