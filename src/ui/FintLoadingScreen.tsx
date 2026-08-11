import { useTranslation } from "react-i18next";
import { Paragraph, YStack, type YStackProps } from "tamagui";
import { FintCoinStack } from "./FintCoinStack";

export interface FintLoadingScreenProps extends YStackProps {
  /** Texto bajo el isotipo. Por defecto, `states.loading`. */
  label?: string;
  size?: number;
}

/**
 * Pantalla de carga estándar de la app: el isotipo de Fint animado sobre el
 * fondo del tema. Para pantallas cuyo layout se conoce de antemano usa los
 * skeletons de `src/components/Skeleton.tsx` en su lugar.
 */
export function FintLoadingScreen({
  label,
  size = 96,
  ...props
}: FintLoadingScreenProps) {
  const { t } = useTranslation();
  const text = label ?? t("states.loading");

  return (
    <YStack
      accessible
      accessibilityLabel={text}
      accessibilityRole="progressbar"
      bg="$background"
      flex={1}
      gap="$4"
      items="center"
      justify="center"
      p="$4"
      {...props}
    >
      <FintCoinStack size={size} />
      <Paragraph color="$color10" text="center">
        {text}
      </Paragraph>
    </YStack>
  );
}
