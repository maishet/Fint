import { createContext, useCallback, useContext, useState, type ComponentType, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions } from "react-native";
import { View, YStack } from "tamagui";
import type { ComingSoonFeature } from "../config/comingSoon";
import { SlabMesh } from "../home/HeroMesh";
import { space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { ExportDemo, GmailDemo, KeywordsDemo, ScanDemo, STAGE_HEIGHT, type DemoProps } from "./comingSoon/demos";
import { useLoop } from "./comingSoon/loop";
import { FintButton } from "./FintButton";
import { FintSheet } from "./FintSheet";
import { FText } from "./FText";
import { SoonBadge } from "./SoonBadge";

const HERO_HEIGHT = 232;

const demos: Record<ComingSoonFeature, ComponentType<DemoProps>> = {
  photoCapture: ScanDemo,
  gmail: GmailDemo,
  reportExport: ExportDemo,
  emailKeywords: KeywordsDemo,
};

const ComingSoonContext = createContext<(feature: ComingSoonFeature) => void>(() => {});

export function useComingSoon() {
  return useContext(ComingSoonContext);
}

export function ComingSoonProvider({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<ComingSoonFeature | null>(null);
  const [open, setOpen] = useState(false);
  const show = useCallback((next: ComingSoonFeature) => {
    setFeature(next);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <ComingSoonContext.Provider value={show}>
      {children}
      {feature ? <ComingSoonSheet feature={feature} open={open} onClose={close} /> : null}
    </ComingSoonContext.Provider>
  );
}

function ComingSoonSheet({ feature, open, onClose }: { feature: ComingSoonFeature; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const progress = useLoop(open);
  const Demo = demos[feature];

  const hero = (
    <View height={HERO_HEIGHT} bg="$slab" overflow="hidden" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <SlabMesh width={width} height={HERO_HEIGHT} paused={!open} />
      <View position="absolute" t={22} l={space[5]}>
        <SoonBadge onSlab />
      </View>
      <View position="absolute" l={0} r={0} t={HERO_HEIGHT - STAGE_HEIGHT - 12} items="center">
        <Demo key={feature} progress={progress} />
      </View>
    </View>
  );

  return (
    <FintSheet open={open} onClose={onClose} hero={hero}>
      <YStack px={space[5]} pt={space[5]} accessible accessibilityLabel={`${t("comingSoon.badge")}. ${t(`comingSoon.${feature}.kicker`)}. ${t(`comingSoon.${feature}.title`)}. ${t(`comingSoon.${feature}.line`)}`}>
        <FText tone="brand" style={{ fontFamily: fontFace.sans[600], fontSize: 12, lineHeight: 16 }}>
          {t(`comingSoon.${feature}.kicker`)}
        </FText>
        <FText variant="title" style={{ fontSize: 23, lineHeight: 28, marginTop: 4 }}>
          {t(`comingSoon.${feature}.title`)}
        </FText>
        <FText tone="inkMuted" style={{ fontSize: 14, lineHeight: 21, marginTop: 6 }}>
          {t(`comingSoon.${feature}.line`)}
        </FText>
      </YStack>
      <YStack px={space[5]} pt={space[5]}>
        <FintButton onPress={onClose}>{t("comingSoon.ok")}</FintButton>
      </YStack>
    </FintSheet>
  );
}
