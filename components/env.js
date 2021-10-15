const getEnvironment = async () => {
  // PRODUCTION:
  // set GITLAB_REDIRECT_URL to https://gitlab.pavlovia.org//oauth/authorize?client_id=b89e397bb4341bcf747543ce7e3e8f9e7a4352640884c4c97904f2afda2f2bca&redirect_uri=https%3A%2F%2Foauth-branch--easyeyes.netlify.app%2Fthreshold%2F&scope=api&response_type=token&response_mode=query&nonce=7q8xeko7jie
  // fetch(`/threshold/environment.json`)

  // DEV:
  // set GITLAB_REDIRECT_URL to https://gitlab.pavlovia.org//oauth/authorize?client_id=914cc931ddf67ab1b9ad8366e29c3a33a89348e09d80fe9c4bbacaa199fa2ce1&redirect_uri=http%3A%2F%2Flocalhost%3A63342%2Fwebsite%2Fdocs%2Fthreshold%2F&scope=api&response_type=token&response_mode=query&nonce=0wo5oj2oubc
  // fetch('/website/docs/threshold/environment.json)
  let response = await fetch(`/threshold/environment.json`)
    .then(response =>  {return response.text()})
    .then(result => {return result})
    .catch(error => {return console.log('error', error)});
  
  return JSON.parse(response)
}