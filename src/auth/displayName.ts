import type { Session } from '@supabase/supabase-js'
export function resolveDisplayName(session: Session | null): string | undefined {
  const metadata = session?.user.user_metadata ?? {}
  if (typeof metadata.display_name === 'string') return metadata.display_name
  if (typeof metadata.full_name === 'string') return metadata.full_name
  if (typeof metadata.name === 'string') return metadata.name
  return session?.user.email
}
