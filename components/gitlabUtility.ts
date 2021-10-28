import { acceptableExtensions, EasyEyesResources, user } from "./CONSTANTS";

type UserRepos = Object[];
const validateRepoName = async (newRepoName: string) => {
  if (newRepoName == "") return false;
  var userRepos = await fetch(
    `https://gitlab.pavlovia.org/api/v4/users/${user.userData.id}/projects?access_token=` +
      user.accessToken
  );
  userRepos = await userRepos.json();
  if (Array.isArray(userRepos)) {
    return (
      userRepos.map((i: any) => i.name).find((i: any) => i == newRepoName) ==
      undefined
    );
  }
};

const createRepo = async (repoName: string) => {
  var newRepo = await fetch(
    "https://gitlab.pavlovia.org/api/v4/projects?name=" +
      repoName +
      "&access_token=" +
      user.accessToken,
    {
      method: "POST",
    }
  );
  newRepo = await newRepo.json();
  return newRepo;
};

/*const populateFontsAndConsentFilesIntoResourcesAndGetAllForExperiment = async (
    files: any
) => {
    // get EasyEyesResources repository from gitlab
    var easyEyesResourcesRepo = user.userData.projects.find(
        (i: any) => i.name == "EasyEyesResources"
    );
    user.easyEyesResourcesRepo = easyEyesResourcesRepo;

    // get pre-existing resources list
    const resourcesList = await getResourcesListFromRepository(
        easyEyesResourcesRepo.id,
        user.accessToken
    );
    const prevFormList = resourcesList.forms;
    const prevFontList = resourcesList.fonts;

    var jsonFiles = [];

    // filter and get all font files
    var fonts = files.filter((i: any) => {
        var extension = i.name.split(".");
        extension = extension[extension.length - 1];
        return acceptableExtensions.fonts.includes(extension);
    });

    // filter and get all form files
    var consentForms = files.filter((i: any) => {
        var extension = i.name.split(".");
        extension = extension[extension.length - 1];
        return acceptableExtensions.forms.includes(extension);
    });

    // generate Gitlab API body to commit form files
    for (var i = 0; i < consentForms.length; i++) {
        var consentFormm = consentForms[i];
        var content = await consentFormm.text();
        let actionValue = prevFormList.includes(consentFormm.name)
            ? "update"
            : "create";
        jsonFiles.push({
            action: actionValue,
            file_path: "forms/" + consentFormm.name,
            content: content,
        });
    }

    // generate Gitlab API body to commit font files
    for (var i = 0; i < fonts.length; i++) {
        var userFont = fonts[i];
        var content = await userFont.text();
        let actionValue = prevFontList.includes(userFont.name)
            ? "update"
            : "create";
        jsonFiles.push({
            action: actionValue,
            file_path: "fonts/" + userFont.name,
            content: content,
        });
    }

    console.log("resources: ", jsonFiles);
    // commit files to EasyEyesResources repository
    var commitBody = {
        branch: "master",
        commit_message: "Update EasyEyes Resources",
        actions: [...jsonFiles],
    };
    var commitFile = await fetch(
        "https://gitlab.pavlovia.org/api/v4/projects/" +
        easyEyesResourcesRepo.id +
        "/repository/commits?access_token=" +
        user.accessToken,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(commitBody),
        }
    );
    await commitFile.json();
};

const populateResourcesOnExperiment = async (gitlabRepo: any) => {
    // get EasyEyesResources repository from gitlab
    var easyEyesResourcesRepo = user.userData.projects.find(
        (i: any) => i.name == "EasyEyesResources"
    );

    // get shared resources list
    const resourcesList = await getResourcesListFromRepository(
        easyEyesResourcesRepo.id,
        user.accessToken
    );
    const formList = resourcesList.forms;
    const fontList = resourcesList.fonts;

    var jsonFiles = [];

    // update global inventory
    EasyEyesResources.fonts = fontList;
    EasyEyesResources.forms = formList;

    // generate Gitlab API body to commit form files
    for (var i = 0; i < formList.length; i++) {
        var consentFormm = formList[i];
        const resourcesRepoFilePath = encodeGitlabFilePath(`forms/${consentFormm}`);
        var consentFormContent = await getFileRawFromGitlab(
            easyEyesResourcesRepo.id,
            resourcesRepoFilePath,
            user.accessToken
        );

        // ignore 404s
        if (
            consentFormContent.trim().indexOf(`{"message":"404 File Not Found"}`) !=
            -1
        )
            continue;

        // update gitlab commit
        jsonFiles.push({
            action: "create",
            file_path: "forms/" + consentFormm,
            content: consentFormContent,
        });
    }

    // generate Gitlab API body to commit font files
    for (var i = 0; i < fontList.length; i++) {
        var userFont = fontList[i];
        var content = "";
        const resourcesRepoFilePath = encodeGitlabFilePath(`fonts/${userFont}`);
        var content = await getFileRawFromGitlab(
            easyEyesResourcesRepo.id,
            resourcesRepoFilePath,
            user.accessToken
        );

        // ignore 404s
        if (content.trim().indexOf(`{"message":"404 File Not Found"}`) != -1)
            continue;

        // update gitlab commit
        jsonFiles.push({
            action: "create",
            file_path: "fonts/" + userFont,
            content: content,
        });
    }

    // commit files to EasyEyesResources repository
    var commitBody = {
        branch: "master",
        commit_message: "Add EasyEyes Resources",
        actions: [...jsonFiles],
    };
    var commitFile = await fetch(
        "https://gitlab.pavlovia.org/api/v4/projects/" +
        gitlabRepo.id +
        "/repository/commits?access_token=" +
        user.accessToken,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(commitBody),
        }
    );
    await commitFile.json();
};*/
