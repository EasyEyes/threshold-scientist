const getEnvironment = async () => {
  let response = await fetch(`/threshold/environment.json`)
    .then(response =>  {return response.text()})
    .then(result => {return result})
    .catch(error => {return console.log('error', error)});
  
  return JSON.parse(response)
}