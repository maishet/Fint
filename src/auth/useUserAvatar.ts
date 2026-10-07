import { resolveDisplayName } from "./displayName";
import { useCurrentSession } from "./sessionStore";

/**
 * La cara de la persona: la foto de su cuenta (Google la trae en
 * `avatar_url` o `picture`) y, si no hay, sus iniciales. La usan el avatar del
 * Inicio y el pin de los mapas. Lee la sesión de `sessionStore`, no de
 * `useAuth`: el pin también se dibuja dentro de hojas, fuera de `AuthProvider`.
 */
export function useUserAvatar() {
  const session = useCurrentSession();
  const metadata = session?.user.user_metadata ?? {};
  const avatarUrl =
    typeof metadata.avatar_url === "string" ? metadata.avatar_url : typeof metadata.picture === "string" ? metadata.picture : null;
  const initials =
    resolveDisplayName(session)
      ?.split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "F";
  return { avatarUrl, initials };
}
