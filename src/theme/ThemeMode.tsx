import { createContext, useContext } from 'react'

export type ThemeMode = 'light' | 'dark'
export type ThemePreference = ThemeMode | 'system'

interface ThemeModeContextValue {
  themeMode: ThemeMode
  themePreference: ThemePreference
  setThemePreference: (preference: ThemePreference) => void
}

export const ThemeModeContext = createContext<ThemeModeContextValue | null>(null)

export function useThemeMode() {
  const value = useContext(ThemeModeContext)
  if (!value) throw new Error('useThemeMode must be used inside AppProviders')
  return value
}
