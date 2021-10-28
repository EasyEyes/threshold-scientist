require.config({
  baseUrl: './external',
  paths: {
      jquery: 'jquery',
      bootstrap: 'bootstrap',
      main: '../dist/main'
  },
});


// Main libs - Libraries and modules that will be needed on all pages of the site
require(['jquery', 'bootstrap', 'main'], function() { 
  
});