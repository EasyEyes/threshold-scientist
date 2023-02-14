import {
  LANGUAGE_INDEX_PROLIFIC_MAPPING,
  LOCATION_INDEX_PROLIFIC_MAPPING,
} from "../Constants";

const prolificLangType = {
  NATIVE: "NATIVE",
  FLUENT: "FLUENT",
};

export const getProlificAccount = async (token) => {
  const headers = new Headers();
  headers.append("authorization", `Token ${token}`);

  const requestOptions = {
    method: "GET",
    headers: headers,
    redirect: "follow",
  };

  const response = await fetch(
    "/.netlify/functions/prolific/users/me/",
    requestOptions
  )
    .then((response) => {
      return response.json();
    })
    .catch((error) => console.log(error));

  if (response) return response;
  else return;
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

const findProlificLocationEligibilityAttributes = (field) => {
  const result = [];
  console.log(field, "field");
  if (!field || field == "All countries available") {
    return result;
  }
  const loc = { ...LOCATION_INDEX_PROLIFIC_MAPPING[field] };
  console.log(loc, "loc");
  loc["value"] = true;
  result.push(loc);
  console.log(result, "loc");
  return result;
};

const selectedLocation = {
  "All countries available": "all",
  USA: "usa",
  UK: "uk",
};

const findProlificLocationAttributes = (field) => {
  if (field in selectedLocation) {
    return selectedLocation[field];
  } else {
    return "more";
  }
};

export const prolificCreateDraft = async (
  user,
  internalName,
  completionCode,
  token
) => {
  const prolificStudyDraftApiUrl = "/.netlify/functions/prolific/studies/";
  const hours = parseFloat(
    (user.currentExperiment._participantDurationMinutes / 60).toFixed(2)
  );
  const pay = parseFloat(user.currentExperiment?._online2Pay) ?? 0;
  const payPerHour =
    parseFloat(user.currentExperiment?._online2PayPerHour) ?? 0;
  const reward = (pay + payPerHour * hours) * 100;
  let completionCodeAction = "MANUALLY_REVIEW";
  if (
    user.currentExperiment &&
    user.currentExperiment._online2SubmissionApproval == "automatic"
  ) {
    completionCodeAction = "AUTOMATICALLY_APPROVE";
  } else {
    completionCodeAction = "MANUALLY_REVIEW";
  }

  const payload = {
    name: user.currentExperiment.titleOfStudy ?? "",
    internal_name: internalName, // ! Looks weird
    description: user.currentExperiment.descriptionOfStudy ?? "",
    external_study_url: user.currentExperiment.experimentUrl,
    prolific_id_option: "url_parameters",
    completion_code: completionCode,
    completion_code_action: completionCodeAction,
    completion_option: "url",
    total_available_places: user.currentExperiment._participantsHowMany ?? 10,
    estimated_completion_time:
      user.currentExperiment._participantDurationMinutes ?? 1,
    reward: reward ?? 0,
    device_compatibility:
      user.currentExperiment._online3DeviceKind?.split(",") ?? [],
    peripheral_requirements:
      user.currentExperiment._online3RequiredServices?.split(",") ?? [],
    eligibility_requirements: [
      {
        id: null,
        type: "SelectAnswer",
        attributes: findProlificLanguageAttributes(
          user.currentExperiment._online5LanguageFirst
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
          user.currentExperiment._online5LanguageFluent,
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
      {
        id: null,
        type: "SelectAnswer",
        attributes: findProlificLocationEligibilityAttributes(
          user.currentExperiment._online4Location
        ),
        query: {
          id: "54bef0fafdf99b15608c504e",
          question: "In what country do you currently reside?",
          description: "",
          title: "Current Country of Residence",
          help_text:
            "Please note that Prolific is currently only available for participants who live in OECD countries. <a href='https://researcher-help.prolific.co/hc/en-gb/articles/360009220833-Who-are-the-people-in-your-participant-pool' target='_blank'>Read more about this</a>",
          participant_help_text: "",
          researcher_help_text: "",
          is_new: false,
          tags: [
            "rep_sample_country",
            "core-7",
            "default_export_country_of_residence",
          ],
        },
      },
    ],
    project: user.currentExperiment.prolificWorkspaceProjectId ?? undefined,
    selected_location: [
      findProlificLocationAttributes(user.currentExperiment._online4Location),
    ],
  };

  const response = await fetch(prolificStudyDraftApiUrl, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      authorization: `Token ${token}`,
    },
  })
    .then((response) => {
      return response.json();
    })
    .catch((error) => console.log(error));

  const result = response;

  if (result.status !== "UNPUBLISHED") {
    console.error(result);
  }

  return result;
};
