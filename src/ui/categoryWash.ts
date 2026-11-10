import { useTheme } from "tamagui";
import { withAlpha } from "../theme/color";
import { useThemeMode } from "../theme/ThemeMode";

const WASH = { light: 0.14, dark: 0.2 } as const;

export function useCategoryWash(color?: string): string | undefined {
  const theme = useTheme() as unknown as Record<string, { val: string } | undefined>;
  const { themeMode } = useThemeMode();
  if (!color || !/^\$chart[1-6]$/.test(color)) return undefined;
  const hex = theme[color.slice(1)]?.val;
  return hex ? withAlpha(hex, WASH[themeMode]) : undefined;
}
