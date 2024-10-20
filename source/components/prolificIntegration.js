import {
  LANGUAGE_INDEX_PROLIFIC_MAPPING,
  LOCATION_INDEX_PROLIFIC_MAPPING,
  FLUENT_LANGUAGE_INDEX_PROLIFIC_MAPPING,
  PRIMARY_LANGUAGE_INDEX_PROLIFIC_MAPPING,
  OPERATING_SYSTEM_PROLIFIC_MAPPING,
  VISION_QUESTION_PROLIFIC_MAPPING,
  DYSLEXIA_QUESTION_PROLIFIC_MAPPING,
  HEARING_QUESTION_PROLIFIC_MAPPING,
  MUSIC_EXPERIENCE_PROLIFIC_MAPPING,
  LANGUAGE_DISORDER_PROLIFIC_MAPPING,
  COCHLEAR_PROLIFIC_MAPPING,
  SIMULATED_EXPERIENCE_PROLIFIC_MAPPING,
  VR_HEADSET_USAGE_PROLIFIC_MAPPING,
  VR_HEADSET_FREQUENCY_PROLIFIC_MAPPING,
  VISION_CORRECTION_PROLIFIC_MAPPING,
  COMPLETION_CODE_ACTION,
  COMPLETION_CODE_TYPE,
} from "./prolificConstants";
import { GLOSSARY } from "../../threshold/parameters/glossary";

const prolificLangType = {
  NATIVE: "NATIVE",
  FLUENT: "FLUENT",
};

const prolificStudySubmissionStatus = {
  RESERVED: "RESERVED",
  ACTIVE: "ACTIVE",
  "TIME-OUT": "TIME-OUT",
  "AWAITING REVIEW": "AWAITING REVIEW",
  APPROVED: "APPROVED",
  RETURNED: "RETURNED",
  REJECTED: "REJECTED",
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
    requestOptions,
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
  type = prolificLangType.NATIVE,
) => {
  const result = [];
  if (!field) {
    return result;
  }
  const languages = field?.split(",") ?? [];
  languages.forEach((element) => {
    element = element?.trim();
    const v = { ...LANGUAGE_INDEX_PROLIFIC_MAPPING[element] };
    v["index"] = type === prolificLangType.FLUENT ? v["index"] + 1 : v["index"];
    v["value"] = true;
    if ("index" in v) {
      result.push(v);
    }
  });
  return result;
};

const findProlificLanguageFluentAttributes = (field) => {
  const result = [];
  if (!field) {
    return result;
  }
  const languages = field?.split(",") ?? [];
  languages.forEach((element) => {
    element = element?.trim();
    const v = { ...FLUENT_LANGUAGE_INDEX_PROLIFIC_MAPPING[element] };
    v["value"] = true;
    if ("index" in v) {
      result.push(v);
    }
  });
  return result;
};

const findProlificLanguagePrimaryAttributes = (field) => {
  const result = [];
  if (!field) {
    return result;
  }
  const languages = field?.split(",") ?? [];
  languages.forEach((element) => {
    element = element?.trim();
    const v = { ...PRIMARY_LANGUAGE_INDEX_PROLIFIC_MAPPING[element] };
    v["value"] = true;
    if ("index" in v) {
      result.push(v);
    }
  });
  return result;
};

const findProlificOperatingSystemAttributes = (field) => {
  const result = [];
  if (!field) {
    return result;
  }
  const languages = field?.split(",") ?? [];
  languages.forEach((element) => {
    element = element?.trim();
    const v = { ...OPERATING_SYSTEM_PROLIFIC_MAPPING[element] };
    v["value"] = true;
    if ("index" in v) {
      result.push(v);
    }
  });
  return result;
};

const findProlificLocationEligibilityAttributes = (field) => {
  const result = [];

  if (!field) {
    return result;
  }
  const locations = field?.split(",") ?? [];
  locations.forEach((element) => {
    element = element?.trim();
    if (element && element !== "All countries available") {
      const loc = { ...LOCATION_INDEX_PROLIFIC_MAPPING[element] };
      loc["value"] = true;
      if ("name" in loc) {
        result.push(loc);
      }
    }
  });
  return result;
};

const findProlificVisionAttributes = (field) => {
  const result = [];
  if (!field) {
    return result;
  }
  const languages = field?.split(",") ?? [];
  languages.forEach((element) => {
    element = element?.trim();
    const v = { ...VISION_QUESTION_PROLIFIC_MAPPING[element] };
    v["value"] = true;
    if ("index" in v) {
      result.push(v);
    }
  });
  return result;
};

const findProlificDyslexiaAttributes = (field) => {
  const result = [];
  if (!field) {
    return result;
  }
  const languages = field?.split(",") ?? [];
  languages.forEach((element) => {
    element = element?.trim();
    const v = { ...DYSLEXIA_QUESTION_PROLIFIC_MAPPING[element] };
    v["value"] = true;
    if ("index" in v) {
      result.push(v);
    }
  });
  return result;
};

const findProlificHearingAttributes = (field) => {
  const result = [];
  if (!field) {
    return result;
  }
  const languages = field?.split(",") ?? [];
  languages.forEach((element) => {
    element = element?.trim();
    const v = { ...HEARING_QUESTION_PROLIFIC_MAPPING[element] };
    v["value"] = true;
    if ("index" in v) {
      result.push(v);
    }
  });
  return result;
};

const findProlificObjectiveScreeningAttributes = (field, constant) => {
  const result = [];
  if (!field) {
    return result;
  }
  const languages = field?.split(",") ?? [];
  languages.forEach((element) => {
    element = element?.trim();
    const v = { ...constant[element] };
    v["value"] = true;
    if ("index" in v) {
      result.push(v);
    }
  });
  return result;
};

const buildEligibilityRequirements = (
  whiteListParticipants,
  user,
  blockListParticipants,
) => {
  const req = [
    ...(user.currentExperiment && user.currentExperiment._online5LanguageFirst
      ? [
          {
            id: null,
            type: "SelectAnswer",
            attributes: findProlificLanguageAttributes(
              user.currentExperiment._online5LanguageFirst,
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
        ]
      : []),
    ...(user.currentExperiment && user.currentExperiment._online5LanguageFluent
      ? [
          {
            id: null,
            type: "MultiSelectAnswer",
            attributes: findProlificLanguageFluentAttributes(
              user.currentExperiment._online5LanguageFluent,
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
        ]
      : []),
    ...(user.currentExperiment && user.currentExperiment._online5LanguagePrimary
      ? [
          {
            id: null,
            type: "SelectAnswer",
            attributes: findProlificLanguagePrimaryAttributes(
              user.currentExperiment._online5LanguagePrimary,
            ),
            query: {
              id: "6228741119c5d3b399f98aaf",
              question:
                "Which of the following is your primary spoken language?",
              description: "",
              title: "Primary Language",
              help_text: "",
              participant_help_text:
                "The language(s) you use most regularly at this current time.",
              researcher_help_text: "",
              is_new: false,
              tags: [],
            },
          },
        ]
      : []),
    ...(user.currentExperiment &&
    user.currentExperiment._online3PhoneOperatingSystem
      ? [
          {
            id: null,
            type: "SelectAnswer",
            attributes: findProlificOperatingSystemAttributes(
              user.currentExperiment._online3PhoneOperatingSystem,
            ),
            query: {
              id: "56d6310bfc7879000b77511a",
              question:
                "What operating system (OS) does your primary mobile phone have?",
              description: "",
              title: "Phone Operating System",
              help_text: "",
              participant_help_text: "",
              researcher_help_text: "",
              is_new: false,
              tags: [],
            },
            _cls: "web.eligibility.models.SelectAnswerEligibilityRequirement",
          },
        ]
      : []),
    ...(user.currentExperiment && user.currentExperiment._online4Location
      ? [
          {
            id: null,
            type: "SelectAnswer",
            attributes: findProlificLocationEligibilityAttributes(
              user.currentExperiment._online4Location,
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
        ]
      : []),
    ...(user.currentExperiment && user.currentExperiment._online5Vision
      ? [
          {
            id: null,
            type: "MultiSelectAnswer",
            attributes: findProlificVisionAttributes(
              user.currentExperiment._online5Vision,
            ),
            query: {
              id: "57a0c4d2717b34954e81b919",
              question: "Do you have normal or corrected-to-normal vision?",
              description: "",
              title: "Vision",
              help_text: "",
              participant_help_text:
                "For example, you can see colour normally, and if you need glasses, you are wearing them or contact lenses",
              researcher_help_text: "",
              is_new: false,
              tags: ["core-21"],
            },
          },
        ]
      : []),
    ...(user.currentExperiment && user.currentExperiment._online5Dyslexia
      ? [
          {
            id: null,
            type: "MultiSelectAnswer",
            attributes: findProlificDyslexiaAttributes(
              user.currentExperiment._online5Dyslexia,
            ),
            query: {
              id: "63497384f86b5bc7cb27c8a8",
              question: "Have you received a medical diagnosis for dyslexia?",
              description: "",
              title: "Dyslexia",
              help_text: "",
              participant_help_text: "",
              researcher_help_text: "",
              is_new: false,
              tags: [],
            },
          },
        ]
      : []),
    ...(user.currentExperiment &&
    user.currentExperiment._online5HearingDifficulties
      ? [
          {
            id: null,
            type: "SelectAnswer",
            attributes: findProlificHearingAttributes(
              user.currentExperiment._online5HearingDifficulties,
            ),
            query: {
              id: "5a9d10c989de8200013f17ce",
              question: "Do you have any hearing loss or hearing difficulties?",
              description: "",
              title: "Hearing difficulties",
              help_text: "",
              participant_help_text: "",
              researcher_help_text: "",
              is_new: false,
              tags: [],
            },
          },
        ]
      : []),
    ...(user.currentExperiment &&
    user.currentExperiment._online5MusicalInstrumentExperience
      ? [
          {
            id: null,
            type: "SelectAnswer",
            attributes: findProlificObjectiveScreeningAttributes(
              user.currentExperiment._online5MusicalInstrumentExperience,
              MUSIC_EXPERIENCE_PROLIFIC_MAPPING,
            ),
            query: {
              id: "5aababea44adc700014c8415",
              question:
                "Do you play a musical instument, if so for how many years?",
              description: "",
              title: "Experience with musical instruments",
              help_text: "",
              participant_help_text: "",
              researcher_help_text: "",
              is_new: false,
              tags: [],
            },
          },
        ]
      : []),
    ...(user.currentExperiment &&
    user.currentExperiment._online5LanguageRelatedDisorders
      ? [
          {
            id: null,
            type: "SelectAnswer",
            attributes: findProlificObjectiveScreeningAttributes(
              user.currentExperiment._online5LanguageRelatedDisorders,
              LANGUAGE_DISORDER_PROLIFIC_MAPPING,
            ),
            query: {
              id: "59b00f20180e8300015758b6",
              question: "Do you have any language related disorders?",
              description: "Do you have any language related disorders?",
              title: "Language related disorders",
              help_text: "",
              participant_help_text: "",
              researcher_help_text: "",
              is_new: false,
              tags: [],
            },
          },
        ]
      : []),
    ...(user.currentExperiment && user.currentExperiment._online5CochlearImplant
      ? [
          {
            id: null,
            type: "SelectAnswer",
            attributes: findProlificObjectiveScreeningAttributes(
              user.currentExperiment._online5CochlearImplant,
              COCHLEAR_PROLIFIC_MAPPING,
            ),
            query: {
              id: "6155e181100d59248cd68f0e",
              question: "Do you have a cochlear implant?",
              description:
                "If you're not sure, select 'No'. A hearing aid is not a cochlear implant.",
              title: "Cochlear implant",
              help_text: "",
              participant_help_text: "",
              researcher_help_text: "",
              is_new: false,
              tags: [],
            },
          },
        ]
      : []),
    ...(user.currentExperiment && user.currentExperiment._online5VRExperiences
      ? [
          {
            id: null,
            type: "MultiSelectAnswer",
            attributes: findProlificObjectiveScreeningAttributes(
              user.currentExperiment._online5VRExperiences,
              SIMULATED_EXPERIENCE_PROLIFIC_MAPPING,
            ),
            query: {
              id: "5eabe23bb79d980009a5eab7",
              question:
                "Have you engaged in any of the following simulated experiences before? Choose all that apply:",
              description: "",
              title: "Simulated Experiences",
              help_text: "",
              participant_help_text: "",
              researcher_help_text: "",
              is_new: false,
              tags: [],
            },
          },
        ]
      : []),
    ...(user.currentExperiment && user.currentExperiment._online5VRHeadset
      ? [
          {
            id: null,
            type: "SelectAnswer",
            attributes: findProlificObjectiveScreeningAttributes(
              user.currentExperiment._online5VRHeadset,
              VR_HEADSET_USAGE_PROLIFIC_MAPPING,
            ),
            query: {
              id: "5eac255ff716eb05e0ed3853",
              question: "Do you own a VR (Virtual Reality) headset?",
              description: "",
              title: "VR headset (ownership)",
              help_text: "",
              participant_help_text: "",
              researcher_help_text: "",
              is_new: false,
              tags: [],
            },
          },
        ]
      : []),
    ...(user.currentExperiment && user.currentExperiment._online5VRHeadsetUsage
      ? [
          {
            id: null,
            type: "SelectAnswer",
            attributes: findProlificObjectiveScreeningAttributes(
              user.currentExperiment._online5VRHeadsetUsage,
              VR_HEADSET_FREQUENCY_PROLIFIC_MAPPING,
            ),
            query: {
              id: "5eac24dacdc446055b9fa3f6",
              question:
                "In a given month, how frequently do you use a VR headset?",
              description: "",
              title: "VR headset (frequency)",
              help_text: "",
              participant_help_text: "",
              researcher_help_text: "",
              is_new: false,
              tags: [],
            },
          },
        ]
      : []),
    ...(user.currentExperiment &&
    user.currentExperiment._online5VisionCorrection
      ? [
          {
            id: null,
            type: "SelectAnswer",
            attributes: findProlificObjectiveScreeningAttributes(
              user.currentExperiment._online5VisionCorrection,
              VISION_CORRECTION_PROLIFIC_MAPPING,
            ),
            query: {
              id: "5a5e22b3eedc32000142ba06",
              question:
                "I currently use glasses or contact lenses to correct my vision",
              description: "",
              title: "Corrected vision",
              help_text: "",
              participant_help_text: "",
              researcher_help_text: "",
              is_new: false,
              tags: [],
            },
          },
        ]
      : []),
    ...(whiteListParticipants.length > 0
      ? [
          {
            requirement_type: "Allow List",
            query: {
              question: null,
              description:
                "A comma separated list of Prolific IDs for users you want to participate in the study.",
              title: "Custom Whitelist",
              help_text:
                "ONLY these participants will be eligible for this study. (i.e. longitudinal design). <a href='https://researcher-help.prolific.com/hc/en-gb/articles/360015365674-How-to-invite-specific-participants-to-your-study'>Read about how to invite specific participants to your study.</a>",
              researcher_help_text:
                "ONLY these participants will be eligible for this study. (i.e. longitudinal design). <a href='https://researcher-help.prolific.com/hc/en-gb/articles/360015365674-How-to-invite-specific-participants-to-your-study'>Read about how to invite specific participants to your study.</a>",
              participant_help_text: null,
              is_new: null,
            },
            attributes: [
              {
                value: whiteListParticipants,
                name: "white_list",
                label: "White List",
                default_value: [],
              },
            ],
            _cls: "web.eligibility.models.CustomWhitelistEligibilityRequirement",
          },
        ]
      : []),
    ...(blockListParticipants.length > 0
      ? [
          {
            requirement_type: "Block List",
            query: {
              question: null,
              description:
                "A comma separated list of Prolific IDs of the users you wish to make ineligible for the study.",
              title: "Custom Blacklist",
              help_text:
                "<a href='https://researcher-help.prolific.com/hc/en-gb/articles/360009094374-How-to-prevent-certain-participants-from-accessing-your-study'>Read about how to prevent certain participants from accessing your study.</a>",
              researcher_help_text:
                "<a href='https://researcher-help.prolific.com/hc/en-gb/articles/360009094374-How-to-prevent-certain-participants-from-accessing-your-study'>Read about how to prevent certain participants from accessing your study.</a>",
              participant_help_text: null,
              is_new: null,
            },
            attributes: [
              {
                value: blockListParticipants,
                name: "black_list",
                label: "Black List",
                default_value: [],
              },
            ],
            _cls: "web.eligibility.models.CustomBlacklistEligibilityRequirement",
          },
        ]
      : []),
  ];
  return req;
};
const selectedLocation = {
  "All countries available": "all",
  USA: "usa",
  UK: "uk",
};

const findProlificLocationAttributes = (field) => {
  const result = [];
  if (!field) {
    return result;
  }
  const locations = field?.split(",") ?? [];
  locations.forEach((element) => {
    element = element?.trim();
    if (
      element in selectedLocation &&
      result.indexOf(selectedLocation[element]) === -1
    ) {
      result.push(selectedLocation[element]);
    } else {
      if (result.indexOf("more") === -1) {
        result.push("more");
      }
    }
  });

  return result;
};

export const prolificCreateDraft = async (
  user,
  internalName,
  completionCode,
  incompatibleCompletionCode,
  abortedCompletionCode,
  token,
) => {
  // const prolificStudyDraftApiUrl = "https://api.prolific.com/api/v1/studies/";
  const prolificStudyDraftApiUrl = "/.netlify/functions/prolific/studies/";
  const hours =
    parseFloat(user.currentExperiment._participantDurationMinutes / 60) || 0;
  const pay = parseFloat(user.currentExperiment?._online2Pay) || 0;
  const payPerHour =
    parseFloat(user.currentExperiment?._online2PayPerHour) || 0;
  const reward = parseInt(
    parseFloat((pay + payPerHour * hours).toFixed(2) * 100),
  );
  let completionCodeAction = COMPLETION_CODE_ACTION.MANUALLY_REVIEW;
  if (
    user.currentExperiment &&
    user.currentExperiment._online2SubmissionApproval == "automatic"
  ) {
    completionCodeAction = COMPLETION_CODE_ACTION.AUTOMATICALLY_APPROVE;
  } else {
    completionCodeAction = COMPLETION_CODE_ACTION.MANUALLY_REVIEW;
  }
  const allowList = user.currentExperiment._online4CustomAllowList;
  const whiteListParticipants = allowList
    ? allowList.split(",").map((item) => item.trim())
    : [];

  const blockList = user.currentExperiment._online4CustomBlockList;
  const blockListParticipants = blockList
    ? blockList.split(",").map((item) => item.trim())
    : [];

  const payload = {
    name:
      user.currentExperiment.titleOfStudy &&
      user.currentExperiment.titleOfStudy !== ""
        ? user.currentExperiment.titleOfStudy
        : GLOSSARY["_online1Title"].default,
    internal_name:
      user.currentExperiment._online1InternalName &&
      user.currentExperiment._online1InternalName !== ""
        ? user.currentExperiment._online1InternalName
        : internalName,
    description:
      user.currentExperiment.descriptionOfStudy &&
      user.currentExperiment.descriptionOfStudy !== ""
        ? user.currentExperiment.descriptionOfStudy
        : GLOSSARY["_online2Description"].default,
    external_study_url: user.currentExperiment.experimentUrl,
    prolific_id_option: "url_parameters",
    completion_option: "url",
    completion_codes: [
      {
        code: completionCode,
        code_type: COMPLETION_CODE_TYPE.COMPLETED,
        actions: [
          {
            action: completionCodeAction,
          },
        ],
      },
      {
        code: incompatibleCompletionCode,
        code_type: COMPLETION_CODE_TYPE.INCOMPATIBLE_DEVICE,
        actions: [
          {
            action: COMPLETION_CODE_ACTION.REQUEST_RETURN,
            return_reason: "Incompatible device",
          },
        ],
      },
      {
        code: abortedCompletionCode,
        code_type: COMPLETION_CODE_TYPE.ABORTED,
        actions: [
          {
            action: completionCodeAction,
          },
        ],
      },
    ],
    total_available_places: isNaN(
      parseInt(user.currentExperiment._participantsHowMany),
    )
      ? 1
      : parseInt(user.currentExperiment._participantsHowMany),
    estimated_completion_time: isNaN(
      parseInt(user.currentExperiment._participantDurationMinutes),
    )
      ? 1
      : parseInt(user.currentExperiment._participantDurationMinutes),
    reward: reward ?? 0,
    device_compatibility:
      user.currentExperiment._online3DeviceKind
        ?.split(",")
        .map((el) => el.trim())
        .filter((element) => element != "") ?? [],
    peripheral_requirements:
      user.currentExperiment._online3RequiredServices
        ?.split(",")
        .map((element) => element.trim())
        .filter((element) => element != "") ?? [],
    eligibility_requirements: buildEligibilityRequirements(
      whiteListParticipants,
      user,
      blockListParticipants,
    ),
    project: user.currentExperiment.prolificWorkspaceProjectId ?? undefined,
    selected_location: findProlificLocationAttributes(
      user.currentExperiment._online4Location,
    ),
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

  if (result?.status !== "UNPUBLISHED") {
    console.error(result);
  }

  return result;
};

const fetchProlificStudy = async (token, prolificStudyId) => {
  // const prolificFetchStudiesUrl = `https://api.prolific.com/api/v1/studies/${prolificStudyId}/`;
  const prolificFetchStudiesUrl = `/.netlify/functions/prolific/studies/${prolificStudyId}/`;
  const response =
    (await fetch(prolificFetchStudiesUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        authorization: `Token ${token}`,
      },
    })
      .then((response) => {
        return response.json();
      })
      .catch((error) => {
        console.log(error, "error");
        return "";
      })) || "";
  return response;
};

const fetchProlificStudySubmissions = async (token, prolificStudyId) => {
  // const prolificFetchStudiesUrl = `https://api.prolific.com/api/v1/studies/${prolificStudyId}/submissions/`;
  const prolificFetchStudiesUrl = `/.netlify/functions/prolific/studies/${prolificStudyId}/submissions/`;
  const response =
    (await fetch(prolificFetchStudiesUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        authorization: `Token ${token}`,
      },
    })
      .then((response) => {
        return response.json();
      })
      .catch((error) => {
        console.log(error, "error");
        return "";
      })) || "";
  return response;
};

export const getProlificStudySubmissions = async (token, prolificStudyId) => {
  const study = await fetchProlificStudy(token, prolificStudyId);
  const submissions = await fetchProlificStudySubmissions(
    token,
    prolificStudyId,
  );
  if (!study || !("status" in study)) {
    return "";
  }
  let numberOfSubmissions = 0;
  if (submissions?.results.length > 0) {
    const submissionResults = submissions.results;
    const res = submissionResults.filter(
      (submissionResult) =>
        submissionResult.status === prolificStudySubmissionStatus.ACTIVE ||
        submissionResult.status ===
          prolificStudySubmissionStatus["AWAITING REVIEW"] ||
        submissionResult.status === prolificStudySubmissionStatus.APPROVED,
    );
    numberOfSubmissions = res.length;
  }
  return `${
    study.status.charAt(0).toUpperCase() + study.status.slice(1).toLowerCase()
  }. ${numberOfSubmissions}/${study.total_available_places} in progress`;
};

export const downloadDemographicData = async (
  token,
  prolificStudyId,
  filename,
  zip,
) => {
  // const downloadDataUrl = `https://api.prolific.com/api/v1/studies/${prolificStudyId}/export/`;
  const downloadDataUrl = `/.netlify/functions/prolific/studies/${prolificStudyId}/export/`;
  const downloadName = filename ?? "experiment";

  await fetch(downloadDataUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      authorization: `Token ${token}`,
    },
  })
    .then((response) => response.text())
    .then((responseData) => {
      let cleanedData = responseData.trim().replace(/^"(.*)"$/, "$1");
      cleanedData = cleanedData.replace(/\\n/g, "\n");
      cleanedData = cleanedData.replace(/\\r/g, "\r");
      cleanedData = cleanedData.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      cleanedData = cleanedData.replace(/\r\n$/, "");
      const rows = cleanedData.split("\n");
      const csvArray = rows.map((row) => row.split(","));
      let formattedCSV = csvArray.map((row) => row.join(",")).join("\r\n");
      formattedCSV = formattedCSV.replace(/\r\n$/, "");
      zip.file(`${downloadName}.prolific.csv`, formattedCSV);
    })
    .catch((error) => {
      console.log(error, "error");
    });
};
