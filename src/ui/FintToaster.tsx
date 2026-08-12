import { AlertCircle, CheckCircle2, Info } from "@tamagui/lucide-icons-2";
import { Toaster } from "sonner-native";
import { useThemeMode } from "../theme/ThemeMode";
import { fintPalette } from "../theme/palette";

export function FintToaster() {
  const { themeMode } = useThemeMode();
  const palette = fintPalette[themeMode];

  return (
    <Toaster
      theme={themeMode}
      position="top-center"
      offset={56}
      gap={10}
      visibleToasts={3}
      swipeToDismissDirection="up"
      icons={{
        success: <CheckCircle2 size={20} color={palette.success} />,
        error: <AlertCircle size={20} color={palette.danger} />,
        info: <Info size={20} color={palette.primary} />,
      }}
      toastOptions={{
        style: {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: 14,
        },
        titleStyle: {
          color: palette.text,
          fontFamily: "InterBold",
          fontSize: 15,
        },
        descriptionStyle: {
          color: palette.muted,
          fontFamily: "InterRegular",
          fontSize: 13,
        },
        actionButtonStyle: {
          backgroundColor: palette.subtle,
          borderRadius: 10,
        },
        actionButtonTextStyle: {
          color: palette.primary,
          fontFamily: "InterSemiBold",
        },
      }}
    />
  );
}
