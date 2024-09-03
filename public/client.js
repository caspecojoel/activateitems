// Define the name of your Power-Up
var POWER_UP_NAME = 'Custom Button Power-Up';

// Function to handle button click and navigate to an external page
var onBtnClick = function(t, opts) {
  console.log('Button clicked on card:', opts);

  // Replace with the actual external URL you want to open
  var externalUrl = 'https://activateitems-d22e28f2e719.herokuapp.com/external-page';

  return t.navigate({
    url: externalUrl, // The external URL to open
    newTab: true // Opens the URL in a new browser tab
  }).then(() => {
    console.log('Navigation to external page successful');
  }).catch(err => {
    console.error('Error navigating to external page:', err);
  });
};

TrelloPowerUp.initialize({
  'card-buttons': function(t, options) {
    return [{
      icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
      text: 'Open Product Form',
      callback: onBtnClick
    }];
  },

  'card-detail-badges': function(t, options) {
    return [{
      title: 'Product Form Badge',
      text: 'Open Product Form',
      callback: onBtnClick
    }];
  },

  'show-authorization': function(t, options) {
    return {
      url: 'https://activateitems-d22e28f2e719.herokuapp.com/authorize'
    };
  }
});

