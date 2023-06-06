import { saveAs } from "file-saver";
import {
  LANGUAGE_INDEX_PROLIFIC_MAPPING,
  LOCATION_INDEX_PROLIFIC_MAPPING,
} from "./prolificConstants";

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
  if (!field) {
    return result;
  }
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

  if (!field) {
    return result;
  }
  const locations = field?.split(",") ?? [];
  locations.forEach((element) => {
    element = element?.trim();
    if (element && element !== "All countries available") {
      const loc = { ...LOCATION_INDEX_PROLIFIC_MAPPING[element] };
      loc["value"] = true;
      result.push(loc);
    }
  });
  return result;
};

const buildEligibilityRequirements = (
  whiteListParticipants,
  user,
  blockListParticipants
) => {
  const req = [
    ...(user.currentExperiment && user.currentExperiment._online5LanguageFirst
      ? [
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
        ]
      : []),
    ...(user.currentExperiment && user.currentExperiment._online5LanguageFluent
      ? [
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
        ]
      : []),
    ...(user.currentExperiment && user.currentExperiment._online4Location
      ? [
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
                "ONLY these participants will be eligible for this study. (i.e. longitudinal design). <a href='https://researcher-help.prolific.co/hc/en-gb/articles/360015365674-How-to-invite-specific-participants-to-your-study'>Read about how to invite specific participants to your study.</a>",
              researcher_help_text:
                "ONLY these participants will be eligible for this study. (i.e. longitudinal design). <a href='https://researcher-help.prolific.co/hc/en-gb/articles/360015365674-How-to-invite-specific-participants-to-your-study'>Read about how to invite specific participants to your study.</a>",
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
                "<a href='https://researcher-help.prolific.co/hc/en-gb/articles/360009094374-How-to-prevent-certain-participants-from-accessing-your-study'>Read about how to prevent certain participants from accessing your study.</a>",
              researcher_help_text:
                "<a href='https://researcher-help.prolific.co/hc/en-gb/articles/360009094374-How-to-prevent-certain-participants-from-accessing-your-study'>Read about how to prevent certain participants from accessing your study.</a>",
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
    if (element in selectedLocation && !(selectedLocation[field] in result)) {
      result.push(selectedLocation[field]);
    } else {
      if (!("more" in result)) {
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
  token
) => {
  // const prolificStudyDraftApiUrl = "https://api.prolific.co/api/v1/studies/";
  const prolificStudyDraftApiUrl = "/.netlify/functions/prolific/studies/";
  const hours =
    parseFloat(
      (user.currentExperiment._participantDurationMinutes / 60).toFixed(2)
    ) || 0;
  const pay = parseFloat(user.currentExperiment?._online2Pay) || 0;
  const payPerHour =
    parseFloat(user.currentExperiment?._online2PayPerHour) || 0;
  const reward = parseInt(parseFloat((pay + payPerHour * hours) * 100));
  let completionCodeAction = "MANUALLY_REVIEW";
  if (
    user.currentExperiment &&
    user.currentExperiment._online2SubmissionApproval == "automatic"
  ) {
    completionCodeAction = "AUTOMATICALLY_APPROVE";
  } else {
    completionCodeAction = "MANUALLY_REVIEW";
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
    name: user.currentExperiment.titleOfStudy ?? "",
    internal_name: user.currentExperiment._online1InternalName || internalName,
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
    eligibility_requirements: buildEligibilityRequirements(
      whiteListParticipants,
      user,
      blockListParticipants
    ),
    project: user.currentExperiment.prolificWorkspaceProjectId ?? undefined,
    selected_location: findProlificLocationAttributes(
      user.currentExperiment._online4Location
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
  // const prolificFetchStudiesUrl = `https://api.prolific.co/api/v1/studies/${prolificStudyId}/`;
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
  // const prolificFetchStudiesUrl = `https://api.prolific.co/api/v1/studies/${prolificStudyId}/submissions/`;
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
    prolificStudyId
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
        submissionResult.status === prolificStudySubmissionStatus.APPROVED
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
  filename
) => {
  // const downloadDataUrl = `https://api.prolific.co/api/v1/studies/${prolificStudyId}/export/`;
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
      const blob = new Blob([formattedCSV], { type: "text/csv" });
      saveAs(blob, `${downloadName}-Prolific.csv`);
    })
    .catch((error) => {
      console.log(error, "error");
    });
};
