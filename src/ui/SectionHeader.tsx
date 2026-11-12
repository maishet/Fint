import { ChevronRight } from "@tamagui/lucide-icons-2";
import { XStack } from "tamagui";
import { COMPACT_FONT_SCALE, space } from "../theme/tokens";
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

/** Título de sección del Inicio y las pestañas: 18/800 a la izquierda, enlace en `ink` con su chevron a la derecha. */
export function SectionHeader({ title, actionLabel, onAction, aside }: SectionHeaderProps) {
  return (
    <XStack items="center" justify="space-between" gap={space[3]} mb={space[3]}>
      <FText
        variant="section-title"
        accessibilityRole="header"
        maxFontSizeMultiplier={1.5}
        style={{ flexShrink: 1, fontFamily: fontFace.display[700], fontSize: 18, lineHeight: 23, letterSpacing: -0.36 }}
      >
        {title}
      </FText>
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} hitSlop={12} accessibilityRole="link">
          <XStack items="center" gap={2} minH={32}>
            <FText variant="label" tone="ink" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.sans[600], fontSize: 14 }}>
              {actionLabel}
            </FText>
            <ChevronRight size={16} color="$ink" strokeWidth={2.2} />
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
