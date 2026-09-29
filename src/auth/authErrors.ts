export type AuthErrorField = "email" | "password" | null;

/**
 * Traduce el error de Supabase al mensaje que ya existe y al campo que lo
 * causó, para marcar ese campo en `dangerHard`: credenciales incorrectas van en
 * la contraseña; correo sin confirmar o ya registrado, en el correo. Un error
 * desconocido no marca ningún campo y se muestra tal cual.
 */
export function authErrorFor(message: string): { field: AuthErrorField; key: string | null } {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login")) return { field: "password", key: "auth.invalidCredentials" };
  if (normalized.includes("email not confirmed")) return { field: "email", key: "auth.emailNotConfirmed" };
  if (normalized.includes("already registered")) return { field: "email", key: "auth.alreadyRegistered" };
  return { field: null, key: null };
}
