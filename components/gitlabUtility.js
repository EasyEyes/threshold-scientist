const gitlabRoutine = async (files) => {
  if (files == null || files == undefined || files.length == 0) {
    window.alert("Please upload required files.");
    return;
  }
  document.getElementById("waiting-div").style.visibility = "";
  const newRepoName = document.getElementById("new-gitlab-repo-name").value;
  var isRepoValid = await validateRepoName(newRepoName);

  if (isRepoValid) {
    const gitlabRepo = await createRepo(newRepoName);
    user.newRepo = newRepoName;
    await populateFontsAndConsentFilesIntoResourcesAndGetAllForExperiment(
      files
    );
    await commitFilesToGitlabFromGithubAndEasyEyes(gitlabRepo, files);
    window.alert(
      "New Repo " + newRepoName + " has been successfully initiated"
    );
    document.getElementById("waiting-div").style.visibility = "hidden";

    document.getElementById("palvolia-experiment-link").href =
      "https://run.pavlovia.org/" +
      user.userData.username +
      "/" +
      newRepoName +
      "/";
    document.getElementById("palvolia-experiment-link").text =
      "https://run.pavlovia.org/" +
      user.userData.username +
      "/" +
      newRepoName +
      "/";

    document.getElementById("activate-experiment-btn");

    document.getElementById("pavlovia-div").style.visibility = "";
  } else {
    window.alert(
      "Repo name is either invalid or already taken. Please enter a new repo name."
    );
    document.getElementById("waiting-div").style.visibility = "hidden";
  }
};

const validateRepoName = async (newRepoName) => {
  if (newRepoName == "") return false;
  var userRepos = await fetch(
    "https://gitlab.pavlovia.org/api/v4/users/22058/projects?access_token=" +
      user.accessToken
  );
  userRepos = await userRepos.json();
  return (
    userRepos.map((i) => i.name).find((i) => i == newRepoName) == undefined
  );
};

const createRepo = async (repoName) => {
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

const populateFontsAndConsentFilesIntoResourcesAndGetAllForExperiment = async (
  files
) => {
  var easyEyesResourcesRepo = user.userData.projects.find(
    (i) => i.name == "EasyEyesResources"
  );
  var jsonFiles = [];
  var fonts = droppedFiles.filter((i) => {
    var extension = i.name.split(".");
    extension = extension[extension.length - 1];
    return (
      extension.includes("otf") ||
      extension.includes("ttf") ||
      extension.includes("woff")
    );
  });

  var consentForms = droppedFiles.filter((i) => {
    var extension = i.name.split(".");
    extension = extension[extension.length - 1];
    return extension.includes("pdf") || extension.includes("md");
  });
  for (var i = 0; i < consentForms.length; i++) {
    var consentFormm = consentForms[i];
    var content = await consentFormm.text();
    jsonFiles.push({
      action: "create",
      file_path: "forms/" + consentFormm.name,
      content: content,
    });
  }
  for (var i = 0; i < fonts.length; i++) {
    var userFont = fonts[i];
    var content = await userFont.text();
    jsonFiles.push({
      action: "create",
      file_path: "fonts/" + userFont.name,
      content: content,
    });
  }

  var commitBody = {
    branch: "master",
    commit_message: "Easy Eyes to Gitlab INIT",
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

const commitFilesToGitlabFromGithubAndEasyEyes = async (gitlabRepo, files) => {
  var rootContent = await fetch(
    "https://api.github.com/repos/EasyEyes/threshold/contents",
    {
      headers: {
        Authorization: "token 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",
      },
    }
  );
  rootContent = await rootContent.json();
  var jsonBody = await populateCommitBody(rootContent, files);
  // create single commit payload for multiple files
  var commitBody = {
    branch: "master",
    commit_message: "Easy Eyes to Gitlab INIT",
    actions: [...jsonBody],
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
  //alert('Repo has been successfully initiated. Please add your easy eyes table to add your experiment');
};

const populateCommitBody = async (rootContent, externalFiles) => {
  var jsonFiles = [];
  var files = [...rootContent];
  while (files.length > 0) {
    // get dirs and files in dir
    // if file, get data and populate fileList
    var currentFile = files.pop();
    if (currentFile.type == "dir") {
      var innerFiles = await fetch(
        currentFile.git_url.split("/git")[0] + "/contents/" + currentFile.path,
        {
          headers: {
            Authorization: "token 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",
          },
        }
      );
      innerFiles = await innerFiles.json();
      files.push(...innerFiles);
    } else if (currentFile.type == "file") {
      // possibility of inner folders being linked to other github projects
      // fetch them again in that case and continue
      if (currentFile.name == "psychojs" && currentFile.size == 0) {
        var innerFiles = await fetch(
          currentFile.git_url.split("/git")[0] + "/contents/",
          {
            headers: {
              Authorization: "token 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",
            },
          }
        );
        innerFiles = await innerFiles.json();
        files.push(...innerFiles);
      } else if (currentFile.name == "control-panel") {
        // we don't need control-panel code in gitlab
        continue;
      } else {
        var fileData = await fetch(
          currentFile.git_url.split("/git")[0] +
            "/contents/" +
            currentFile.path,
          {
            headers: {
              Authorization: "token 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",
            },
          }
        );
        fileData = await fileData.json();
        jsonFiles.push({
          action: "create",
          file_path: fileData.git_url.split("/git")[0].includes("psychojs")
            ? "psychojs/" + fileData.path
            : fileData.path,
          content:
            fileData.encoding == "base64"
              ? atob(fileData.content)
              : fileData.content,
        });
      }
    }
  }

  for (var i = 0; i < externalFiles.length; i++) {
    var externalFile = externalFiles[i];
    if (externalFile.type == "text/csv") {
      var fileData = await externalFile.text();
      jsonFiles.push({
        action: "create",
        file_path: "blocks/" + externalFile.name,
        content: fileData,
      });
    }
    if (externalFile.type == "application/pdf") {
      var fileData = await externalFile.text();
      jsonFiles.push({
        action: "create",
        file_path: "form/" + externalFile.name,
        content: fileData,
      });
    } else {
      var fileData = await externalFile.text();
      jsonFiles.push({
        action: "create",
        file_path: "fonts/" + externalFile.name,
        content: fileData,
      });
    }
  }
  return jsonFiles;
};
