import { Clock } from "@tamagui/lucide-icons-2";
import { useTranslation } from "react-i18next";
import { XStack } from "tamagui";
import { radius } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FText } from "./FText";

/** "Pronto": marca un botón que se ve pero todavía no se puede usar (`isComingSoon`). */
export function SoonBadge({ onSlab = false }: { onSlab?: boolean }) {
  const { t } = useTranslation();
  return (
    <XStack
      items="center"
      gap={3}
      px={7}
      height={20}
      rounded={radius.pill}
      bg={onSlab ? "$glassSlab" : "$surfaceSunken"}
      borderWidth={1}
      borderColor={onSlab ? "$glassSlabLine" : "$line"}
    >
      <Clock size={11} color={onSlab ? "$slabInk" : "$inkMuted"} strokeWidth={2.2} />
      <FText tone={onSlab ? "slabInk" : "inkMuted"} style={{ fontFamily: fontFace.sans[600], fontSize: 11, lineHeight: 14 }}>
        {t("comingSoon.badge")}
      </FText>
    </XStack>
  );
}
