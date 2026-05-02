import { supabase } from "../../supabase";

export const loginUser = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const registerUser = async (
  email: string,
  password: string,
  role: string,
  firstName: string,
  lastName: string,
) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, first_name: firstName, last_name: lastName },
      emailRedirectTo: `${window.location.origin}/login`,
    },
  });

  if (error) return { data, error };

  const { error: insertError } = await supabase.from("users").insert({
    id: data.user?.id,
    email,
    role,
    first_name: firstName,
    last_name: lastName,
  });

  return { data, error: insertError ?? null };
};

// ✅ Add these two missing exports
export const logoutUser = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getUserRole = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return null;

  // First check user_metadata (set during registration)
  const metaRole = data.user.user_metadata?.role;
  if (metaRole) return metaRole;

  // Fallback: check users table (for manually created users)
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", data.user.id)
    .single();

  return userData?.role ?? null;
};
