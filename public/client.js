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

// Initialize the Trello Power-Up
TrelloPowerUp.initialize({
  // Implement the 'card-buttons' capability
  'card-buttons': function(t, options) {
    console.log('Initializing card-buttons capability');
    return [{
      icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico', // Replace with your icon URL
      text: 'Open Product Form', // Text for the button
      callback: onBtnClick // Function to execute when the button is clicked
    }];
  },

  // Implement the 'card-detail-badges' capability
  'card-detail-badges': function(t, options) {
    console.log('Initializing card-detail-badges capability');
    return [{
      title: 'Product Form Badge',
      text: 'Open Product Form',
      callback: onBtnClick // Function to execute when the badge is clicked
    }];
  },

  // Implement the 'show-authorization' capability
  'show-authorization': function(t, options) {
    console.log('Initializing show-authorization capability');
    return {
      url: 'https://activateitems-d22e28f2e719.herokuapp.com/authorize' // URL for authorization
    };
  }
});
