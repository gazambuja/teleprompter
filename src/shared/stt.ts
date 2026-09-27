export type SttLang = 'es' | 'en';
export type SttLangSetting = 'auto' | SttLang;

export const STT_LANG_NAMES: Record<SttLang, string> = {
  es: 'Spanish',
  en: 'English'
};
