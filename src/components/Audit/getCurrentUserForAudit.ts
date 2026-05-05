import { supabase } from "../../supabase";

// ─────────────────────────────────────────────────────────────────────────────
// getCurrentUserForAudit
//
// Reusable helper for all logger calls across every JO/Technician/Admin page.
// Instead of doing localStorage.getItem("user") which returns nothing,
// this pulls the email from localStorage and fetches the real name from
// the users table in Supabase.
//
// USAGE in any registration/edit/delete/export page:
//
//   import { getCurrentUserForAudit } from "../../components/Audit/getCurrentUserForAudit";
//
//   const user = await getCurrentUserForAudit();
//   await auditLogger.logFarmerRegistration(user, submissionId, farmerName, farmDetails);
//
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditUser {
  id?: number | string; // change this line
  name: string;
  role: string;
}

export const getCurrentUserForAudit = async (): Promise<AuditUser> => {
  const userEmail = localStorage.getItem("userEmail");
  const userRole = localStorage.getItem("userRole") || "unknown";

  // If no email in localStorage at all, return fallback
  if (!userEmail) {
    return {
      name: "Unknown",
      role: userRole,
    };
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, first_name, last_name, role")
      .eq("email", userEmail)
      .single();

    if (error || !data) {
      // Fallback to email if lookup fails
      console.warn(
        "Could not fetch user for audit log, using email as fallback:",
        error?.message,
      );
      return {
        name: userEmail,
        role: userRole,
      };
    }

    // Combine first and last name — handle nulls gracefully
    const fullName = [data.first_name, data.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      id: data.id,
      name: fullName || userEmail, // fallback to email if name fields are empty
      role: data.role || userRole,
    };
  } catch (err) {
    console.warn("getCurrentUserForAudit failed, using email fallback:", err);
    return {
      name: userEmail,
      role: userRole,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HOW TO REPLACE OLD LOGGER CALLS
//
// BEFORE (broken — "user" key doesn't exist in localStorage):
//   const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
//   await auditLogger.logFarmerRegistration(
//     {
//       id: currentUser.id,
//       name: currentUser.name || currentUser.username || "Unknown",
//       role: currentUser.role || "JO",
//     },
//     submitted.submissionId,
//     farmerName,
//     farmDetails,
//   );
//
// AFTER (works — pulls real name from Supabase users table):
//   const user = await getCurrentUserForAudit();
//   await auditLogger.logFarmerRegistration(
//     user,
//     submitted.submissionId,
//     farmerName,
//     farmDetails,
//   );
//
// ─────────────────────────────────────────────────────────────────────────────
// PAGES THAT NEED THIS CHANGE:
//
// 1. JoRsbsaRegisLandowner.tsx   → logFarmerRegistration call in handleFinalSubmit
// 2. JoRsbsaRegisFarmer.tsx      → logFarmerRegistration call in handleFinalSubmit
// 3. Tenant/Lessee page          → logFarmerRegistration call (once built)
// 4. Edit Farmer page            → logCRUD("UPDATE", ...) — needs logger call added
// 5. Delete Farmer               → logCRUD("DELETE", ...) — needs logger call added
// 6. Export Farmers              → logExport(...) — needs logger call added
// 7. Transfer Ownership          → logCRUD("UPDATE", ...) — needs logger call added
// ─────────────────────────────────────────────────────────────────────────────
