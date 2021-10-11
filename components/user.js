const user = {};

const populateUserInfo = async () => {
    user.accessToken = window.location.hash.split('&')[0].split('=')[1];
    var userData = await fetch('https://gitlab.pavlovia.org/api/v4/user?access_token=' + window.location.hash.split('&')[0].split('=')[1]);
    userData = await userData.json();
    user.userData = userData;
    var projectData = await fetch('https://gitlab.pavlovia.org/api/v4/users/22058/projects?access_token=' + user.accessToken);
    projectData = await projectData.json();
    user.userData.projects = projectData;
    document.getElementById('gitlab-user-info').textContent = 'Welcome ' + user.userData.name + '(' + user.userData.username + ')';
}

if (window.location.hash == '') {
    /*document.getElementById("threshold-content").style.visibility = 'hidden';
    document.getElementById("gitlab-login-div").style.visibility = '';
    document.getElementById('old-content').style.visibility = 'hidden';
    document.getElementById('gitlab-stuff').style.visibility = 'hidden';*/

    /*location.href = 'https://gitlab.pavlovia.org//oauth/authorize?client_id=f43ec84eac32326bd40b28f79728bfb5ba32cace89d580662cdb46da3b7dcc8d&redirect_uri=https%3A%2F%2Feasyeyes.app%2Fthreshold%2F&scope=api&response_type=token&response_mode=query&nonce=1587kx42hje';*/
} else {
    document.getElementById('gitlab-connect-btn').className = 'btn btn-success disabled';
    document.getElementById('gitlab-connect-btn').innerText = 'Connected to Gitlab Palvolia';
    document.getElementById('gitlab-file-submit').className = document.getElementById('gitlab-file-submit').className.replace('disabled', '');
    /*document.getElementById("threshold-content").style.visibility = '';
    document.getElementById("gitlab-login-div").style.visibility = 'hidden';
    document.getElementById('old-content').style.visibility = 'hidden';
    document.getElementById('gitlab-stuff').style.visibility = '';*/

    populateUserInfo();
}

const redirectToOauth2 = async () => {
    location.href = 'https://gitlab.pavlovia.org//oauth/authorize?client_id=f43ec84eac32326bd40b28f79728bfb5ba32cace89d580662cdb46da3b7dcc8d&redirect_uri=http%3A%2F%2Flocalhost%3A63342%2Fwebsite%2Fdocs%2Fthreshold%2F&scope=api&response_type=token&response_mode=query&nonce=1587kx42hje';
}

const redirectToPalvoliaActivation = async () => {
    window.open('https://pavlovia.org/'+ user.userData.username +'/'+ user.newRepo, '_blank');
}