# Agricultural Registry System
### RSBSA & Farmland Management Platform — Municipality of Dumarao, Capiz

A web-based information system for managing farmer registrations (RSBSA), farmland parcel records, land ownership history, seed/fertilizer distribution, and regional reporting.

Built with **React + TypeScript + Vite** and backed by **Supabase** (PostgreSQL).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Vanilla CSS (`src/index.css`) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email + password) |
| Maps | Leaflet.js |
| Charts | Recharts |

---

## Prerequisites

Install the following before getting started:

1. **Node.js v18+** — https://nodejs.org/
2. **npm** — comes with Node.js
3. **Git** — https://git-scm.com/

Verify your versions:
```bash
node --version   # should be v18 or higher
npm --version    # should be v9 or higher
```

---

## 1. Clone the Repository

```bash
git clone <repository-url>
cd Research-Project
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Environment Setup

The project connects to a hosted Supabase instance. The connection keys are already configured in `src/supabase.ts`.

> **Note:** The Supabase URL and anon key are public (safe-to-share) keys. The database is secured via **Row Level Security (RLS)** — see the Security section below.

If you need to point to a different Supabase project, create a `.env` file in the root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Then update `src/supabase.ts` to read from `import.meta.env`.

---

## 4. Run the Application

```bash
npm run dev
```

Open your browser at: **http://localhost:5173**

---

## 5. User Roles

The system has 4 roles. Each role is assigned during account registration and stored in Supabase Auth `user_metadata`.

| Role | Description | Access Level |
|---|---|---|
| `admin` | Municipal Agricultural Officer | Full access — read, write, delete everything |
| `jo` | Job Order encoder | Read all + encode farmer registrations, land transfers, distribution records |
| `technician` | Field technician | Read all + manage land plots (GIS), farmer registration status, requests |
| `region` | Regional officer | Read all + manage inventory and regional allocations |

### Creating a New User Account

1. Click **"Sign In Here"** then **"New Account"** on the login page
2. Fill in the user details and assign the correct role
3. The user will receive a confirmation email before they can log in

> Alternatively, an admin can create accounts directly from the Supabase Dashboard under **Authentication > Users > Invite User**.

---

## 6. Database Security (RLS)

The database is secured with **Row Level Security** on all tables. Only logged-in users with the correct role can access or modify data.

The full policy migration is saved at `database/rls_policies.sql`.

### If setting up a fresh Supabase project

1. Open the **Supabase Dashboard** > **SQL Editor** > **New Query**
2. Copy the contents of `database/rls_policies.sql`
3. Paste and click **Run**
4. Verify under **Authentication > Policies** that all tables show policies

### Policy overview

| Table | Read | Write | Delete |
|---|---|---|---|
| `rsbsa_submission` | All roles | jo, admin | admin |
| `rsbsa_farm_parcels` | All roles | jo, admin | admin |
| `land_history` | All roles | jo, admin | admin |
| `land_parcels` | All roles | jo, admin | admin |
| `land_plots` | All roles | technician, jo, admin | admin |
| `farmer_requests` | All roles | technician, jo, admin | admin |
| `distribution_records` | All roles | jo, admin | admin |
| `inventory` | All roles | region, admin | admin |
| `regional_allocations` | All roles | region, admin | admin |
| `shortages_*` | All roles | region, admin | admin |
| `ownership_transfers` | All roles | jo, admin | admin |
| `audit_logs` | All roles | All roles | Nobody (immutable) |
| `users` | Own row + admin | Self (own row) + admin | admin |
| Backup tables | admin only | admin only | admin only |

---

## 7. Project Structure

```
Research-Project/
├── database/
│   └── rls_policies.sql        # Supabase RLS security policies
├── public/                     # Static assets
├── src/
│   ├── api.ts                  # All Supabase database calls
│   ├── supabase.ts             # Supabase client initialization
│   ├── index.tsx               # App entry point + routing
│   ├── index.css               # Global styles
│   ├── components/
│   │   ├── Registration/
│   │   │   └── authRegistration.tsx   # Login, register, getUserRole
│   │   └── Sidebar/            # Role-specific sidebars
│   ├── login/
│   │   └── PageLogin.tsx       # Login page
│   ├── screens/
│   │   ├── admin/              # Admin-only screens
│   │   ├── JO/                 # Job Order encoder screens
│   │   ├── technicians/        # Technician screens
│   │   └── region/             # Region screens
│   └── utils/                  # Helper utilities
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 8. Building for Production

```bash
npm run build
```

Output is placed in the `dist/` folder. Deploy the contents of `dist/` to any static hosting service (Netlify, Vercel, GitHub Pages, etc.).

---

## 9. Troubleshooting

### "new row violates row-level security policy"
You are trying to write to a table without the required role.
- Confirm the logged-in user has the correct role in Supabase > **Authentication > Users** > click the user > check `raw_user_meta_data.role`
- If the role is wrong, update it in the Supabase dashboard or re-register the account with the correct role

### App loads but shows no data
- Check the browser console (F12) for `permission denied` errors
- Ensure you are logged in — unauthenticated users cannot access any data
- Verify your Supabase project URL and anon key are correct in `src/supabase.ts`

### Login fails with valid credentials
- Check that the Supabase Auth user exists under **Authentication > Users**
- Ensure the user confirmed their email (check for "Unconfirmed" status)
- Try resetting the password via **Authentication > Users > Send Password Recovery**

### "Failed to fetch" or CORS errors
- Your Supabase project might be paused (free tier pauses after inactivity)
- Go to the Supabase Dashboard and resume the project

### Reinstall dependencies (Windows)
```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

---

## 10. Development Notes

- **Dev server:** runs on `http://localhost:5173` (Vite)
- **Routing:** uses `HashRouter` — URLs use `#/path` format
- **Auth:** Supabase Auth manages sessions; role is stored in `user_metadata.role`
- **No backend server needed** — all database calls go directly through the Supabase client
- **Font:** Arial, sans-serif (global)
- **Console logs:** removed project-wide for production cleanliness

---

## Additional Resources

- **Supabase Dashboard:** https://supabase.com/dashboard/project/ufhymmbrynufimayalsc
- **GIS Map Reference:** https://www.google.com/maps/d/u/0/edit?hl=en&mid=15_ampwP-jkZ61_Coki20I0kG9dJrU10&ll=10.821462438695141%2C122.70912895551383&z=14
- **Supabase Docs:** https://supabase.com/docs