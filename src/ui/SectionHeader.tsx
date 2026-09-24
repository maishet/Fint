import { ChevronRight } from "@tamagui/lucide-icons-2";
import { XStack } from "tamagui";
import { space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FText } from "./FText";
import { PressableScale } from "./PressableScale";

export interface SectionHeaderProps {
  title: string;
  /** Texto de la acción a la derecha: "Ver todos". */
  actionLabel?: string;
  onAction?: () => void;
  /** A la derecha, en lugar de la acción: un dato corto en `caption`. */
  aside?: string;
}

/** Título de sección del Inicio y las pestañas: `section-title` a la izquierda, acción en `brand` a la derecha. */
export function SectionHeader({ title, actionLabel, onAction, aside }: SectionHeaderProps) {
  return (
    <XStack items="baseline" justify="space-between" gap={space[3]} mb={space[3]}>
      <FText variant="section-title" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1 }}>
        {title}
      </FText>
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} hitSlop={8} accessibilityRole="link">
          <XStack items="center" gap={2}>
            <FText variant="label" tone="brand" style={{ fontFamily: fontFace.sans[600] }}>
              {actionLabel}
            </FText>
            <ChevronRight size={14} color="$brand" strokeWidth={2.2} />
          </XStack>
        </PressableScale>
      ) : aside ? (
        <FText variant="caption" tone="inkFaint">
          {aside}
        </FText>
      ) : null}
    </XStack>
  );
}
