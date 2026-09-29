/** Las secciones del Inicio que se pueden ordenar y ocultar en "Personalizar inicio". El hero no está: es fijo. */
export const HOME_SECTIONS = ["attention", "transactions", "spending"] as const;
export type HomeSectionId = (typeof HOME_SECTIONS)[number];
export type HomeLayout = { sections: Array<{ id: HomeSectionId; visible: boolean }> };

export const DEFAULT_HOME_LAYOUT: HomeLayout = { sections: HOME_SECTIONS.map((id) => ({ id, visible: true })) };

/** Lo que llegue, completado: cada sección una vez; la que falte va al final y visible; lo desconocido se descarta. */
export function normalizeHomeLayout(value: unknown): HomeLayout {
  const raw = (value as { sections?: unknown } | null | undefined)?.sections;
  if (!Array.isArray(raw)) return DEFAULT_HOME_LAYOUT;
  const seen = new Set<HomeSectionId>();
  const sections: HomeLayout["sections"] = [];
  for (const item of raw) {
    const id = (item as { id?: unknown } | null)?.id;
    if (typeof id !== "string" || !(HOME_SECTIONS as readonly string[]).includes(id) || seen.has(id as HomeSectionId)) continue;
    seen.add(id as HomeSectionId);
    sections.push({ id: id as HomeSectionId, visible: (item as { visible?: unknown }).visible !== false });
  }
  for (const id of HOME_SECTIONS) if (!seen.has(id)) sections.push({ id, visible: true });
  return { sections };
}

/** Mueve una sección a otra posición (arrastrar en la hoja). */
export function moveSection(layout: HomeLayout, id: HomeSectionId, to: number): HomeLayout {
  const from = layout.sections.findIndex((s) => s.id === id);
  if (from < 0) return layout;
  const target = Math.max(0, Math.min(layout.sections.length - 1, to));
  if (from === target) return layout;
  const sections = [...layout.sections];
  const [moved] = sections.splice(from, 1);
  sections.splice(target, 0, moved!);
  return { sections };
}

export function setSectionVisible(layout: HomeLayout, id: HomeSectionId, visible: boolean): HomeLayout {
  return { sections: layout.sections.map((s) => (s.id === id ? { ...s, visible } : s)) };
}
