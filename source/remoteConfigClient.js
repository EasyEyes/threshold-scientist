import { fetchAndActivate, getValue } from "firebase/remote-config";
import { remoteConfig } from "./components/firebase";

let _cache = null;

export async function getTranslationConfig() {
  if (_cache) return _cache;

  try {
    remoteConfig.settings.minimumFetchIntervalMillis = 0;
    remoteConfig.defaultConfig = {
      translation_supported_languages: "[]",
      translation_keys: "[]",
    };

    const activated = await fetchAndActivate(remoteConfig);
    console.log(
      "[remoteConfig] fetchAndActivate result (true=fresh, false=cached):",
      activated,
    );

    const rawLanguages = getValue(
      remoteConfig,
      "translation_supported_languages",
    ).asString();
    const rawKeys = getValue(remoteConfig, "translation_keys").asString();
    console.log(
      "[remoteConfig] raw translation_supported_languages:",
      rawLanguages,
    );
    console.log("[remoteConfig] raw translation_keys:", rawKeys);

    const supportedLanguages = JSON.parse(rawLanguages);
    const translationKeys = JSON.parse(rawKeys);
    console.log(
      "[remoteConfig] parsed supportedLanguages:",
      supportedLanguages,
    );
    console.log("[remoteConfig] parsed translationKeys:", translationKeys);

    _cache = { supportedLanguages, translationKeys };
    return _cache;
  } catch (e) {
    console.error("[remoteConfig] error fetching remote config:", e);
    return { supportedLanguages: [], translationKeys: [] };
  }
}
