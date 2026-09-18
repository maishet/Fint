import { ChevronRight } from "@tamagui/lucide-icons-2";
import { Button, Paragraph, XStack } from "tamagui";

/**
 * Fila "Ver las N restantes" para las cards de Reportes que solo muestran el
 * top-N -- el detalle completo iba en el PDF/XLSX exportado; mientras exportar
 * esté oculto (rama de lanzamiento), el tap solo avisa que está por venir.
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
