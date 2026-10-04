export type AuthErrorField = "code" | "email" | "password" | null;

/**
 * Traduce el error de Supabase al mensaje que ya existe y al campo que lo
 * causó, para marcar ese campo en `dangerHard`: credenciales incorrectas van en
 * la contraseña; correo sin confirmar o ya registrado, en el correo; código de
 * verificación incorrecto o vencido, en el código. Un error desconocido no
 * marca ningún campo y se muestra tal cual.
 */
export function authErrorFor(message: string): { field: AuthErrorField; key: string | null } {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login")) return { field: "password", key: "auth.invalidCredentials" };
  if (normalized.includes("email not confirmed")) return { field: "email", key: "auth.emailNotConfirmed" };
  if (normalized.includes("already registered")) return { field: "email", key: "auth.alreadyRegistered" };
  if (normalized.includes("has expired")) return { field: "code", key: "loginScreen.invalidCode" };
  if (normalized.includes("security purposes") || normalized.includes("rate limit")) return { field: null, key: "loginScreen.resendTooSoon" };
  return { field: null, key: null };
}
