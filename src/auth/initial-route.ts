export function getInitialRoute(hasSession: boolean, isUnauthorized: boolean, setupComplete?: boolean) {
  if (!hasSession || isUnauthorized) return '/login'
  return setupComplete === false ? '/onboarding' : '/(tabs)/dashboard'
}
