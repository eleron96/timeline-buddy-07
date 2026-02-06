import { i18n } from "@lingui/core";
import { messages as enMessages } from "@/locales/en/messages.mjs";
import { messages as ruMessages } from "@/locales/ru/messages.mjs";

i18n.load({
  en: enMessages,
  ru: ruMessages,
});

export { i18n };
