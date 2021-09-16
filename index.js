// install express with `npm install express` 
const express = require('express');
const app = express();
const path = require('path');

app.use('/static', express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// export 'app'
module.exports = app;