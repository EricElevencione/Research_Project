import { supabase } from "../../supabase";

// Login with email and password
export const loginUser = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

// Register new user with role stored in metadata
export const registerUser = async (
  email: string,
  password: string,
  role: string,
) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role }, // stored in user_metadata
      emailRedirectTo: `${window.location.origin}/login`,
    },
  });
  return { data, error };
};

// Logout
export const logoutUser = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

// Get current session role
export const getUserRole = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data?.user?.user_metadata?.role ?? null;
};
