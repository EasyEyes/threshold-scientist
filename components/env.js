const getEnvironment = async () => {
  // TODO change GITLAB_REDIRECT_URL to https://gitlab.pavlovia.org//oauth/authorize?client_id=b89e397bb4341bcf747543ce7e3e8f9e7a4352640884c4c97904f2afda2f2bca&redirect_uri=https%3A%2F%2Foauth-branch--easyeyes.netlify.app%2Fthreshold%2F&scope=api&response_type=token&response_mode=query&nonce=7q8xeko7jie
  let response = await fetch(`/threshold/environment.json`)
    .then(response =>  {return response.text()})
    .then(result => {return result})
    .catch(error => {return console.log('error', error)});
  
  response = JSON.parse(response);
  response['GITHUB_PAT'] = `${response.GITHUB_PAT1}${response.GITHUB_PAT2}`
  return JSON.parse(response)
}