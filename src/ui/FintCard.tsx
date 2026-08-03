import { Card, type CardProps } from "tamagui";
import { useThemeMode } from "../theme/ThemeMode";

interface FintCardProps extends CardProps {
  raised?: boolean;
}

export function FintCard({ raised = false, ...props }: FintCardProps) {
  const { themeMode } = useThemeMode();

  return (
    <Card
      bg="$card"
      borderColor="$borderColor"
      borderWidth={1}
      p="$4"
      rounded={18}
      shadowColor={
        raised ? (themeMode === "dark" ? "#000000" : "#104452") : undefined
      }
      shadowOffset={raised ? { width: 0, height: 8 } : undefined}
      shadowOpacity={raised ? (themeMode === "dark" ? 0.28 : 0.14) : undefined}
      shadowRadius={raised ? 20 : undefined}
      elevation={raised ? 4 : 0}
      {...props}
    />
  );
}
