import { ChevronRight } from "@tamagui/lucide-icons-2";
import { Button, Paragraph, XStack } from "tamagui";

/**
 * Fila "Ver las N restantes en el export" para las cards de Reportes que
 * ahora solo muestran el top-N -- el detalle completo sigue existiendo, pero
 * únicamente en el PDF/XLSX exportado, no en el tab.
 */
export function ReportOverflowFootnote({
  remainingCount,
  onPress,
  label,
}: {
  remainingCount: number;
  onPress: () => void;
  label: string;
}) {
  if (remainingCount <= 0) return null;
  return (
    <Button chromeless minH={44} px="$2" onPress={onPress}>
      <XStack items="center" gap="$1">
        <Paragraph color="$primary" fontWeight="600" fontSize="$2">
          {label}
        </Paragraph>
        <ChevronRight size={14} color="$primary" />
      </XStack>
    </Button>
  );
}
