const getEnvironment = async () => {
  let response = await fetch(`/threshold/environment.json`)
    .then(response =>  {return response.text()})
    .then(result => {return result})
    .catch(error => {return console.log('error', error)});
  
  response = JSON.parse(response);
  response['GITHUB_PAT'] = `${response.GITHUB_PAT1}${response.GITHUB_PAT2}`
  return response
}