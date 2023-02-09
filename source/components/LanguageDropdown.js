import React from "react";

const LanguageDropdown = ({
  selected,
  setSelectedLanguage,
  isViewingPreviousExperiment,
}) => {
  return (
    <select
      style={{ marginLeft: "10px" }}
      className="history-dropdown"
      name="languageDropdown"
      id="languageDropdown"
      value={selected}
      onChange={(e) => {
        setSelectedLanguage(e.target.value, isViewingPreviousExperiment);
      }}
    >
      {Object.keys(Languages).map((language) => {
        return (
          <option key={language} value={Languages[language]}>
            {language}
          </option>
        );
      })}
    </select>
  );
};

export default LanguageDropdown;

// Languages map from language name to language code (From EasyEyes Phrases doc)

export const Languages = {
  English: "en-US",
  Deutsch: "de",
  Français: "fr",
  Español: "es",
  Português: "pt",
  Italiano: "it",
  Română: "ro",
  Polski: "pl",
  Русский: "ru",
  հայերեն: "hy",
  Suomalainen: "fi",
  ქართული: "ka",
  עִברִית: "he",
  عربي: "ar",
  اردو: "ur",
  हिंदी: "hi",
  தமிழ்: "ta",
  മലയാളം: "ml",
  తెలుగు: "te",
  ಕನ್ನಡ: "kn",
  বাংলা: "bn",
  "bahasa Indonesia": "id",
  简体中文: "zh-CN",
  繁體中文: "zh-HK",
  日本: "ja",
  한국인: "ko",
};
