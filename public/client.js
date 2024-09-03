var POWER_UP_NAME = 'Custom Button Power-Up';

// Function to handle button click and open the modal
var onBtnClick = function(t, opts) {
  var url = 'https://activateitems-d22e28f2e719.herokuapp.com/iframe';
  return t.modal({
    url: url,  // Simplified URL without the HubSpot ID parameter for testing
    height: 500, // The height of the modal
    fullscreen: false, // Whether the modal should be fullscreen
    title: 'Test: Simple Content' // Title of the modal
  });
};

// Initialize the Trello Power-Up
TrelloPowerUp.initialize({
  'card-buttons': function(t, options) {
    return [{
      icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico', // Ensure this URL is correct
      text: 'Open Test Content',
      callback: onBtnClick
    }];
  },
  'card-detail-badges': function(t, options) {
    return [{
      title: 'Test Badge', // Tooltip when hovering over the badge
      text: 'Simple Content',
      callback: onBtnClick
    }];
  }
});
