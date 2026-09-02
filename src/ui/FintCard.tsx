import { Card, type CardProps } from "tamagui";
import { useThemeMode } from "../theme/ThemeMode";

interface FintCardProps extends CardProps {
  raised?: boolean;
}

export function FintCard({ raised = false, ...props }: FintCardProps) {
  const { themeMode } = useThemeMode();
  const shadowColor = themeMode === "dark" ? "#000000" : "#043036";

  return (
    <Card
      transition="quick"
      bg="$card"
      borderColor="$borderColor"
      borderWidth={1}
      p="$4"
      rounded={20}
      shadowColor={shadowColor}
      shadowOffset={{ width: 0, height: raised ? 10 : 3 }}
      shadowOpacity={
        raised
          ? themeMode === "dark"
            ? 0.32
            : 0.07
          : themeMode === "dark"
            ? 0.24
            : 0.05
      }
      shadowRadius={raised ? 24 : 10}
      elevation={raised ? 4 : 1}
      {...props}
    />
  );
}
