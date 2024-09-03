var POWER_UP_NAME = 'Custom Button Power-Up';

// Function to handle button click and navigate to an external page
var onBtnClick = function(t, opts) {
  console.log('Button clicked on card:', opts);

  // Example URL, replace with the actual external URL you want to open
  var externalUrl = 'https://activateitems-d22e28f2e719.herokuapp.com/external-page';

  return t.navigate({
    url: externalUrl, // The external URL you want to open
    newTab: true // This will open the URL in a new browser tab
  }).then(() => {
    console.log('Navigation to external page successful');
  }).catch(err => {
    console.error('Error navigating to external page:', err);
  });
};

TrelloPowerUp.initialize({
  'card-buttons': function(t, options) {
    console.log('Initializing card-buttons capability');
    return [{
      icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico', // Replace with your icon URL
      text: 'Open External Page', // Text for the button
      callback: onBtnClick
    }];
  },
  'card-detail-badges': function(t, options) {
    console.log('Initializing card-detail-badges capability');
    return [{
      title: 'External Page Badge',
      text: 'Open External Page',
      callback: onBtnClick
    }];
  }
});
