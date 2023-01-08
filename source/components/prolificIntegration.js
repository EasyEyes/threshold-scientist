import axios from "axios";
import { LANGUAGE_INDEX_PROLIFIC_MAPPING } from "../Constants";

const prolificLangType = {
  NATIVE: "NATIVE",
  FLUENT: "FLUENT",
};

const findProlificLanguageAttributes = (
  field,
  type = prolificLangType.NATIVE
) => {
  const result = [];
  const languages = field?.split(",") ?? [];
  languages.forEach((element) => {
    element = element?.trim();
    const v = { ...LANGUAGE_INDEX_PROLIFIC_MAPPING[element] };
    v["index"] = type === prolificLangType.FLUENT ? v["index"] + 1 : v["index"];
    v["value"] = true;
    result.push(v);
  });
  return result;
};

export const prolificCreateDraftOnClick = async (
  user,
  internalName,
  completionCode
) => {
  const prolificStudyDraftApiUrl = "https://api.prolific.co/api/v1/studies/";
  const payload = {
    name: user.currentExperiment.titleOfStudy ?? "",
    // internal_name: this._getPavloviaExperimentUrl(),
    internal_name: internalName,
    description: user.currentExperiment.descriptionOfStudy ?? "",
    external_study_url: user.currentExperiment.experimentUrl,
    prolific_id_option: "url_parameters",
    completion_code: completionCode,
    completion_option: "url",
    total_available_places: user.currentExperiment._participantsHowMany ?? 10,
    estimated_completion_time:
      user.currentExperiment._participantDurationMinutes ?? 1,
    reward: 1,
    device_compatibility: [],
    peripheral_requirements: [],
    eligibility_requirements: [
      {
        id: null,
        type: "SelectAnswer",
        attributes: findProlificLanguageAttributes(
          user.currentExperiment._participantLanguageNative
        ),
        query: {
          id: "54ac6ea9fdf99b2204feb899",
          question: "What is your first language?",
          description: "",
          title: "First language",
          help_text: "",
          participant_help_text: "",
          researcher_help_text: "",
          is_new: false,
          tags: ["onboarding-2", "core-5", "default_export_language"],
        },
      },
      {
        id: null,
        type: "MultiSelectAnswer",
        attributes: findProlificLanguageAttributes(
          user.currentExperiment._participantLanguageFluent,
          prolificLangType.FLUENT
        ),
        query: {
          id: "58c6b44ea4dd0a4799361afc",
          question: "Which of the following languages are you fluent in?",
          description: "Select the languages that you are fluent in.",
          title: "Fluent languages",
          help_text:
            "<b>Please note:</b> Participants who are fluent in any of the selected languages will be eligible for the study. For example, the study will recruit participants who are fluent in English or German, but not both.",
          participant_help_text: "",
          researcher_help_text: "",
          is_new: false,
          tags: ["rep_sample_language", "core-13"],
        },
      },
    ],
  };

  const response = await axios.post(
    prolificStudyDraftApiUrl,
    JSON.stringify(payload),
    {
      withCredentials: false,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        Authorization:
          "Token XlJQZJfE1vbw3nDXvrL64p1cFuvEgnDTr1eo1WzhiZ-XCNCt9wsqXomi7nhUba6UVsvRXedtvUcTzFTAyaScwQvY5e_nvgxfX_6QnXHeECchPcWOULjg9rGJ",
      },
    }
  );

  if (response.status !== 201) {
    console.log("Error:" + response);
  } else {
    window
      .open(
        "https://app.prolific.co/researcher/workspaces/studies/" +
          response.data.id,
        "_blank"
      )
      ?.focus();
  }
};
