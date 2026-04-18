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
import { captureError } from "../sentry";

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
    .catch((error) =>
      captureError(error, "Prolific Get Account", { endpoint: "users/me" }),
    );

  if (response) return response;
  else return;
};

const fetchProlificParticipantGroups = async (token) => {
  const url = `/.netlify/functions/prolific/participant-groups/`;

  const response = await fetch(url, {
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
      captureError(error, "Prolific Fetch Participant Groups", {
        endpoint: `participant-groups/`,
      });
      return { results: [] };
    });

  return response?.results || [];
};

const findParticipantGroupId = (participantGroups, groupName) => {
  if (!groupName || groupName === "") return null;

  const group = participantGroups.find(
    (g) => g.name?.trim().toLowerCase() === groupName.toLowerCase(),
  );

  return group?.id || null;
};

const getSelectedValues = (field, mapping) => {
  if (!field) return [];
  return field
    .split(",")
    .map((el) => el.trim())
    .filter((el) => el in mapping && "index" in mapping[el])
    .map((el) => String(mapping[el].index));
};

const buildFilters = (whiteListParticipants, user, blockListParticipants) => {
  const filters = [];
  const exp = user.currentExperiment;
  if (!exp) return filters;

  const addFilter = (filterId, field, mapping) => {
    const values = getSelectedValues(field, mapping);
    if (values.length > 0) {
      filters.push({ filter_id: filterId, selected_values: values });
    }
  };

  addFilter(
    "first-language",
    exp._prolific4LanguageFirst,
    LANGUAGE_INDEX_PROLIFIC_MAPPING,
  );
  addFilter(
    "fluent-languages",
    exp._prolific4LanguageFluent,
    FLUENT_LANGUAGE_INDEX_PROLIFIC_MAPPING,
  );
  addFilter(
    "primary-language",
    exp._prolific4LanguagePrimary,
    PRIMARY_LANGUAGE_INDEX_PROLIFIC_MAPPING,
  );
  addFilter(
    "phone-operating-system",
    exp._prolific4PhoneOperatingSystem,
    OPERATING_SYSTEM_PROLIFIC_MAPPING,
  );

  // Location: skip "All countries available"
  if (exp._prolific3Location) {
    const locationValues = exp._prolific3Location
      .split(",")
      .map((el) => el.trim())
      .filter(
        (el) =>
          el &&
          el !== "All countries available" &&
          el in LOCATION_INDEX_PROLIFIC_MAPPING,
      )
      .map((el) => String(LOCATION_INDEX_PROLIFIC_MAPPING[el].index));
    if (locationValues.length > 0) {
      filters.push({
        filter_id: "current-country-of-residence",
        selected_values: locationValues,
      });
    }
  }

  addFilter("vision", exp._prolific4Vision, VISION_QUESTION_PROLIFIC_MAPPING);
  addFilter(
    "dyslexia",
    exp._prolific4Dyslexia,
    DYSLEXIA_QUESTION_PROLIFIC_MAPPING,
  );
  addFilter(
    "hearing-difficulties",
    exp._prolific4HearingDifficulties,
    HEARING_QUESTION_PROLIFIC_MAPPING,
  );
  addFilter(
    "experience-with-musical-instruments",
    exp._prolific4MusicalInstrumentExperience,
    MUSIC_EXPERIENCE_PROLIFIC_MAPPING,
  );
  addFilter(
    "language-related-disorders",
    exp._prolific4LanguageRelatedDisorders,
    LANGUAGE_DISORDER_PROLIFIC_MAPPING,
  );
  addFilter(
    "cochlear-implant",
    exp._prolific4CochlearImplant,
    COCHLEAR_PROLIFIC_MAPPING,
  );
  addFilter(
    "simulated-experiences",
    exp._prolific4VRExperiences,
    SIMULATED_EXPERIENCE_PROLIFIC_MAPPING,
  );
  addFilter(
    "vr-headset-ownership",
    exp._prolific4VRHeadsetOwnership,
    VR_HEADSET_USAGE_PROLIFIC_MAPPING,
  );
  addFilter(
    "vr-headset-frequency",
    exp._prolific4VRHeadsetFrequency,
    VR_HEADSET_FREQUENCY_PROLIFIC_MAPPING,
  );
  addFilter(
    "corrected-vision",
    exp._prolific4VisionCorrection,
    VISION_CORRECTION_PROLIFIC_MAPPING,
  );

  if (whiteListParticipants.length > 0) {
    filters.push({
      filter_id: "custom_allowlist",
      selected_values: whiteListParticipants,
    });
  }
  if (blockListParticipants.length > 0) {
    filters.push({
      filter_id: "custom_blocklist",
      selected_values: blockListParticipants,
    });
  }

  return filters;
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
  const completionPathMapping = {
    manuallyReview: COMPLETION_CODE_ACTION.MANUALLY_REVIEW,
    approveAndPay: COMPLETION_CODE_ACTION.AUTOMATICALLY_APPROVE,
    requestAReturn: COMPLETION_CODE_ACTION.REQUEST_RETURN,
  };
  const completionPath = user.currentExperiment?._prolific2CompletionPath;
  const completionCodeAction =
    completionPathMapping[completionPath] ||
    COMPLETION_CODE_ACTION.AUTOMATICALLY_APPROVE;

  const abortedPathMapping = {
    requestAReturn: COMPLETION_CODE_ACTION.REQUEST_RETURN,
    approveAndPay: COMPLETION_CODE_ACTION.AUTOMATICALLY_APPROVE,
    manuallyReview: COMPLETION_CODE_ACTION.MANUALLY_REVIEW,
  };
  const abortedPath = user.currentExperiment?._prolific2Aborted;
  const abortedCodeAction =
    abortedPathMapping[abortedPath] || COMPLETION_CODE_ACTION.REQUEST_RETURN;
  const allowList = user.currentExperiment._prolific3CustomAllowList;
  const whiteListParticipants = allowList
    ? allowList.split(",").map((item) => item.trim())
    : [];

  const blockList = user.currentExperiment._prolific3CustomBlockList;
  const blockListParticipants = blockList
    ? blockList.split(",").map((item) => item.trim())
    : [];

  // Fetch participant groups from workspace
  const participantGroups = await fetchProlificParticipantGroups(token);

  const participantGroupName =
    user.currentExperiment._prolific2CompletionPathAddToGroup?.trim();
  const participantGroupId = findParticipantGroupId(
    participantGroups,
    participantGroupName,
  );

  const completedActions = [
    {
      action: completionCodeAction,
    },
  ];

  if (participantGroupId) {
    completedActions.push({
      action: COMPLETION_CODE_ACTION.ADD_TO_PARTICIPANT_GROUP,
      participant_group: participantGroupId,
    });
  }

  const abortedParticipantGroupName =
    user.currentExperiment._prolific2AbortedAddToGroup?.trim();
  const abortedParticipantGroupId = findParticipantGroupId(
    participantGroups,
    abortedParticipantGroupName,
  );

  const abortedActions = [
    abortedCodeAction === COMPLETION_CODE_ACTION.REQUEST_RETURN
      ? {
          action: abortedCodeAction,
          return_reason: "Study aborted",
        }
      : {
          action: abortedCodeAction,
        },
  ];

  if (abortedParticipantGroupId) {
    abortedActions.push({
      action: COMPLETION_CODE_ACTION.ADD_TO_PARTICIPANT_GROUP,
      participant_group: abortedParticipantGroupId,
    });
  }

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
        actions: completedActions,
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
        actions: abortedActions,
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
      user.currentExperiment._prolific2DeviceKind
        ?.split(",")
        .map((el) => el.trim())
        .filter((element) => element != "") ?? [],
    peripheral_requirements:
      user.currentExperiment._prolific2RequiredServices
        ?.split(",")
        .map((element) => element.trim())
        .filter((element) => element != "") ?? [],
    filters: buildFilters(whiteListParticipants, user, blockListParticipants),
    project: user.currentExperiment.prolificWorkspaceProjectId ?? undefined,
    selected_location: findProlificLocationAttributes(
      user.currentExperiment._prolific3Location,
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
    .catch((error) =>
      captureError(error, "Prolific Create Draft", { endpoint: "studies" }),
    );

  const result = response;

  if (result?.status !== "UNPUBLISHED") {
    console.error(result);
  }

  return result;
};

const fetchProlificStudy = async (token, prolificStudyId) => {
  // const prolificFetchStudiesUrl = `https://api.prolific.com/api/v1/studies/${prolificStudyId}/`;
  const prolificFetchStudiesUrl = `/.netlify/functions/prolific/studies/${prolificStudyId}/`;
  const response = token
    ? await fetch(prolificFetchStudiesUrl, {
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
          captureError(error, "Prolific Fetch Study", {
            endpoint: `studies/${prolificStudyId}`,
          });
          return "";
        })
    : "";
  return response;
};

const fetchProlificStudySubmissions = async (token, prolificStudyId) => {
  // const prolificFetchStudiesUrl = `https://api.prolific.com/api/v1/studies/${prolificStudyId}/submissions/`;
  const prolificFetchStudiesUrl = `/.netlify/functions/prolific/studies/${prolificStudyId}/submissions/`;
  const response = token
    ? await fetch(prolificFetchStudiesUrl, {
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
          captureError(error, "Prolific Fetch Submissions", {
            endpoint: `studies/${prolificStudyId}/submissions`,
          });
          return "";
        })
    : "";
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
      captureError(error, "Download Demographic Data", {
        endpoint: "demographic-data",
      });
    });
};
