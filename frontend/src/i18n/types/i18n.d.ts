import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    returnNull: false;
    returnObjects: false;
    defaultNS: 'translation';
    resources: {
      translation: typeof import('../en/translation.json');
    };
  }
}
