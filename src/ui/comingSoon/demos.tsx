import { Banknote, CalendarDays, Car, Check, CreditCard, FileSpreadsheet, FileText, Mail, ShoppingCart, Store, Tv } from "@tamagui/lucide-icons-2";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TextStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { Text, View, XStack, YStack, useTheme } from "tamagui";
import { withAlpha } from "../../theme/color";
import { fintPalette } from "../../theme/palette";
import { radius } from "../../theme/tokens";
import { fontFace, textStyles } from "../../theme/typography";
import { fadeOut, stage, useReveal } from "./loop";

export const STAGE_WIDTH = 296;
export const STAGE_HEIGHT = 168;

const paper = fintPalette.light;

export interface DemoProps {
  progress: SharedValue<number>;
}

function PaperText({ children, variant = "caption", style }: { children: ReactNode; variant?: keyof typeof textStyles; style?: TextStyle }) {
  return <Text style={[textStyles[variant] as TextStyle, { color: paper.ink }, style]}>{children}</Text>;
}

function SlabText({ children, variant = "label", style }: { children: ReactNode; variant?: keyof typeof textStyles; style?: TextStyle }) {
  return (
    <Text color="$slabInk" numberOfLines={1} style={[textStyles[variant] as TextStyle, style]}>
      {children}
    </Text>
  );
}

function Paper({ children, width, height, padding = 12 }: { children: ReactNode; width?: number; height?: number; padding?: number }) {
  return (
    <View width={width} height={height} p={padding} rounded={radius.md} style={{ backgroundColor: paper.surface }}>
      {children}
    </View>
  );
}

function Tile({ children, tint }: { children: ReactNode; tint?: string }) {
  const theme = useTheme();
  return (
    <View width={28} height={28} rounded={9} items="center" justify="center" style={{ backgroundColor: withAlpha(tint ?? theme.brandSlab.val, 0.22) }}>
      {children}
    </View>
  );
}

function GlassRow({ children, height = 46 }: { children: ReactNode; height?: number }) {
  return (
    <XStack height={height} items="center" gap={10} px={10} rounded={radius.md} bg="$glassSlab" borderWidth={1} borderColor="$glassSlabLine">
      {children}
    </XStack>
  );
}

function MovementRow({ icon, label, amount, trailing }: { icon: ReactNode; label: string; amount: string; trailing?: ReactNode }) {
  return (
    <GlassRow>
      <Tile>{icon}</Tile>
      <SlabText style={{ flex: 1 }}>{label}</SlabText>
      <SlabText variant="amount-sm">{amount}</SlabText>
      {trailing}
    </GlassRow>
  );
}

function CheckPop({ progress, from }: { progress: SharedValue<number>; from: number }) {
  const style = useReveal(progress, from, from + 0.08, { scale: 0 });
  return (
    <Animated.View style={style}>
      <View width={20} height={20} rounded={999} items="center" justify="center" bg="$flowInSlab">
        <Check size={12} color="$slab" strokeWidth={3} />
      </View>
    </Animated.View>
  );
}

function Lines({ widths }: { widths: number[] }) {
  return (
    <YStack gap={6} mt={8}>
      {widths.map((w, i) => (
        <View key={i} height={5} rounded={3} width={`${w}%`} style={{ backgroundColor: withAlpha(paper.ink, 0.1) }} />
      ))}
    </YStack>
  );
}

export function ScanDemo({ progress }: DemoProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const barStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: stage(p, 0.04, 0.1) * (1 - stage(p, 0.42, 0.48)),
      transform: [{ translateY: 6 + stage(p, 0.06, 0.42) * 98 }],
    };
  });
  const chip1 = useReveal(progress, 0.44, 0.54, { x: -10 });
  const chip2 = useReveal(progress, 0.48, 0.58, { x: -10 });
  const chip3 = useReveal(progress, 0.52, 0.62, { x: -10 });
  const row = useReveal(progress, 0.58, 0.7, { y: 26 });
  const chips = [
    { style: chip1, icon: <Banknote size={14} color="$brandSlab" strokeWidth={2} />, label: "S/ 45.90" },
    { style: chip2, icon: <Store size={14} color="$brandSlab" strokeWidth={2} />, label: t("comingSoon.demo.store") },
    { style: chip3, icon: <CalendarDays size={14} color="$brandSlab" strokeWidth={2} />, label: t("comingSoon.demo.today") },
  ];

  return (
    <View width={STAGE_WIDTH} height={STAGE_HEIGHT}>
      <View position="absolute" l={0} t={0}>
        <Paper width={122} height={112}>
          <XStack items="center" gap={6}>
            <View width={18} height={18} rounded={6} style={{ backgroundColor: paper.brand }} />
            <PaperText variant="label">{t("comingSoon.demo.receipt")}</PaperText>
          </XStack>
          <PaperText variant="amount-lg" style={{ marginTop: 8, fontSize: 18, lineHeight: 22 }}>
            S/ 45.90
          </PaperText>
          <Lines widths={[82, 60, 70]} />
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 6,
                right: 6,
                top: 0,
                height: 3,
                borderRadius: 2,
                backgroundColor: theme.brandSlab.val,
                boxShadow: `0 0 12px 3px ${withAlpha(theme.brandSlab.val, 0.8)}`,
              },
              barStyle,
            ]}
          />
        </Paper>
      </View>
      <YStack position="absolute" l={136} t={4} gap={8} width={STAGE_WIDTH - 136}>
        {chips.map((chip, i) => (
          <Animated.View key={i} style={chip.style}>
            <GlassRow height={30}>
              {chip.icon}
              <SlabText variant="caption">{chip.label}</SlabText>
            </GlassRow>
          </Animated.View>
        ))}
      </YStack>
      <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 122 }, row]}>
        <MovementRow
          icon={<ShoppingCart size={15} color="$brandSlab" strokeWidth={2} />}
          label={`${t("comingSoon.demo.store")} · ${t("comingSoon.demo.today")}`}
          amount="−S/ 45.90"
          trailing={<CheckPop progress={progress} from={0.68} />}
        />
      </Animated.View>
    </View>
  );
}

export function GmailDemo({ progress }: DemoProps) {
  const { t } = useTranslation();
  const mailStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const enter = stage(p, 0.04, 0.14);
    const leave = stage(p, 0.34, 0.46);
    return {
      opacity: enter * (1 - leave),
      transform: [{ translateY: (1 - enter) * -30 + leave * 40 }, { scale: 1 - leave * 0.1 }],
    };
  });
  const rows = [
    { style: useReveal(progress, 0.4, 0.5, { y: 16 }), icon: <ShoppingCart size={15} color="$brandSlab" strokeWidth={2} />, label: t("comingSoon.demo.groceries"), amount: "−S/ 89.00" },
    { style: useReveal(progress, 0.54, 0.64, { y: 16 }), icon: <Car size={15} color="$brandSlab" strokeWidth={2} />, label: t("comingSoon.demo.taxi"), amount: "−S/ 18.50" },
    { style: useReveal(progress, 0.68, 0.78, { y: 16 }), icon: <Tv size={15} color="$brandSlab" strokeWidth={2} />, label: t("comingSoon.demo.streaming"), amount: "−S/ 44.90" },
  ];

  return (
    <View width={STAGE_WIDTH} height={STAGE_HEIGHT}>
      <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 6 }, mailStyle]}>
        <Paper padding={10}>
          <XStack items="center" gap={10}>
            <View width={30} height={30} rounded={9} items="center" justify="center" style={{ backgroundColor: paper.brand }}>
              <Mail size={16} color="#FFFFFF" strokeWidth={2} />
            </View>
            <YStack flex={1} minW={0}>
              <PaperText variant="label" style={{ fontFamily: fontFace.sans[600] }}>
                {t("comingSoon.demo.mailFrom")}
              </PaperText>
              <Text numberOfLines={1} style={[textStyles.caption as TextStyle, { color: paper.inkMuted }]}>
                {t("comingSoon.demo.mailPreview")}
              </Text>
            </YStack>
          </XStack>
        </Paper>
      </Animated.View>
      {rows.map((row, i) => (
        <Animated.View key={i} style={[{ position: "absolute", left: 0, right: 0, top: 6 + i * 54 }, row.style]}>
          <MovementRow icon={row.icon} label={row.label} amount={row.amount} />
        </Animated.View>
      ))}
    </View>
  );
}

function Bar({ progress, height, color, delay }: { progress: SharedValue<number>; height: number; color: string; delay: number }) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const grow = stage(p, 0.06 + delay, 0.3 + delay) * (1 - stage(p, 0.93, 1));
    return { height: Math.max(3, height * grow) };
  });
  return <Animated.View style={[{ flex: 1, borderRadius: 4, backgroundColor: color }, style]} />;
}

export function ExportDemo({ progress }: DemoProps) {
  const { t } = useTranslation();
  const pdf = useReveal(progress, 0.36, 0.5, { x: -50, y: 10, scale: 0.5 });
  const xlsx = useReveal(progress, 0.46, 0.6, { x: -80, y: 10, scale: 0.5 });
  const bars = [0.6, 0.9, 0.45, 0.7, 0.35];
  const files = [
    { style: pdf, icon: <FileText size={20} color={paper.chart[4]} strokeWidth={2} />, label: "PDF", hint: t("comingSoon.demo.pdf") },
    { style: xlsx, icon: <FileSpreadsheet size={20} color={paper.flowIn} strokeWidth={2} />, label: "Excel", hint: t("comingSoon.demo.xlsx") },
  ];

  return (
    <View width={STAGE_WIDTH} height={STAGE_HEIGHT}>
      <View position="absolute" l={0} t={4}>
        <Paper width={152} height={156}>
          <Text style={[textStyles.caption as TextStyle, { color: paper.inkMuted }]}>{t("comingSoon.demo.month")}</Text>
          <PaperText variant="amount" style={{ fontSize: 16, lineHeight: 20, fontFamily: fontFace.mono[600] }}>
            S/ 2,480.60
          </PaperText>
          <XStack items="flex-end" gap={7} height={72} mt={12}>
            {bars.map((h, i) => (
              <Bar key={i} progress={progress} height={72 * h} color={paper.chart[i]} delay={i * 0.02} />
            ))}
          </XStack>
        </Paper>
      </View>
      {files.map((file, i) => (
        <Animated.View key={file.label} style={[{ position: "absolute", left: 168, right: 0, top: 10 + i * 76 }, file.style]}>
          <Paper padding={10}>
            <XStack items="center" gap={6}>
              {file.icon}
              <PaperText variant="label" style={{ fontFamily: fontFace.sans[600] }}>
                {file.label}
              </PaperText>
            </XStack>
            <Text numberOfLines={1} style={[textStyles.caption as TextStyle, { color: paper.inkMuted, marginTop: 4, fontSize: 11 }]}>
              {file.hint}
            </Text>
          </Paper>
        </Animated.View>
      ))}
    </View>
  );
}

function Mark({ progress, from, children }: { progress: SharedValue<number>; from: number; children: string }) {
  const theme = useTheme();
  const glow = withAlpha(theme.brandSlab.val, 0.45);
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(stage(progress.value, from, from + 0.1) * fadeOut(progress.value), [0, 1], ["rgba(0,0,0,0)", glow]),
  }));
  return (
    <Animated.View style={[{ borderRadius: 4, paddingHorizontal: 2 }, style]}>
      <PaperText style={{ fontFamily: fontFace.sans[600] }}>{children}</PaperText>
    </Animated.View>
  );
}

function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <PaperText key={i}>{word}</PaperText>
      ))}
    </>
  );
}

export function KeywordsDemo({ progress }: DemoProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const card = t("comingSoon.demo.card");
  const chip1 = useReveal(progress, 0.4, 0.54, { x: -60, y: -10, scale: 0.7 });
  const chip2 = useReveal(progress, 0.48, 0.62, { x: -90, y: -10, scale: 0.7 });
  const ring = useAnimatedStyle(() => {
    const p = progress.value;
    const k = stage(p, 0.64, 0.72) * (1 - stage(p, 0.74, 0.86));
    return { opacity: k, transform: [{ scaleX: 0.96 + k * 0.04 }, { scaleY: 0.9 + k * 0.1 }] };
  });

  return (
    <View width={STAGE_WIDTH} height={STAGE_HEIGHT}>
      <View position="absolute" l={0} t={0}>
        <Paper width={180} padding={10}>
          <PaperText variant="label" style={{ fontFamily: fontFace.sans[600], marginBottom: 4 }}>
            {t("comingSoon.demo.mailFrom")}
          </PaperText>
          <XStack flexWrap="wrap" columnGap={4} rowGap={2} items="center">
            <Words text={t("comingSoon.demo.kwBefore")} />
            <Mark progress={progress} from={0.16}>{card}</Mark>
            <Words text={t("comingSoon.demo.kwMiddle")} />
            <Mark progress={progress} from={0.2}>4521</Mark>
            <Words text={t("comingSoon.demo.kwAfter")} />
          </XStack>
        </Paper>
      </View>
      <YStack position="absolute" l={194} t={6} gap={8} items="flex-start">
        {[
          { style: chip1, label: card },
          { style: chip2, label: "4521" },
        ].map((chip) => (
          <Animated.View key={chip.label} style={chip.style}>
            <View px={9} py={4} rounded={radius.pill} bg="$brandSlab">
              <Text color="$slab" style={[textStyles.caption as TextStyle, { fontFamily: fontFace.sans[600] }]}>
                {chip.label}
              </Text>
            </View>
          </Animated.View>
        ))}
      </YStack>
      <View position="absolute" l={0} r={0} t={120}>
        <Animated.View
          style={[{ position: "absolute", left: -6, right: -6, top: -6, bottom: -6, borderRadius: radius.md + 6, backgroundColor: withAlpha(theme.flowInSlab.val, 0.3) }, ring]}
        />
        <MovementRow
          icon={<CreditCard size={15} color="$flowInSlab" strokeWidth={2} />}
          label={card}
          amount="−S/ 120.00"
          trailing={<CheckPop progress={progress} from={0.68} />}
        />
      </View>
    </View>
  );
}
