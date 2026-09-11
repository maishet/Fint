export type AppLanguage = "es" | "en" | "pt";

let currentLanguage: AppLanguage = "es";

export function getStoredCurrentLanguage(): AppLanguage {
  return currentLanguage;
}

export function setStoredCurrentLanguage(language: string | null | undefined) {
  currentLanguage = language === "en" || language === "pt" ? language : "es";
}
