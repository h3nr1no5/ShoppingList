import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageToggle: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('hu') ? 'hu' : 'en';

  const toggleLanguage = (): void => {
    const newLang = i18n.language?.startsWith('hu') ? 'en' : 'hu';
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="btn btn-icon lang-toggle"
      title={currentLang === 'hu' ? t('nav.switch_to_english') : t('nav.switch_to_hungarian')}
    >
      {currentLang === 'hu' ? 'EN' : 'HU'}
    </button>
  );
};

export default LanguageToggle;