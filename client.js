var POWER_UP_NAME = 'Custom Button Power-Up';

// Function to handle button click and open the modal with the HubSpot ID pre-filled
var onBtnClick = function(t, opts) {
  return t.card('id')
    .then(function(card) {
      // Fetch the custom field value from Trello
      return t.get(card.id, 'shared', '66d715a7584d0c33d06ab06f')
        .then(function(customFieldValue) {
          var hubspotId = customFieldValue ? customFieldValue : '';
          var url = 'https://activateitems-d22e28f2e719.herokuapp.com/iframe?hubspotId=' + encodeURIComponent(hubspotId);
          return t.modal({
            url: url,  // The URL for the iframe content with the HubSpot ID as a query parameter
            height: 500, // The height of the modal
            fullscreen: false, // Whether the modal should be fullscreen
            title: 'Enter Product Details'
          });
        });
    });
};

// Initialize the Trello Power-Up
TrelloPowerUp.initialize({
  'card-buttons': function(t, options) {
    return [{
      icon: '/favicon.ico',
      text: 'Open Product Form', // Button text
      callback: onBtnClick
    }];
  },
  'card-detail-badges': function(t, options) {
    return [{
      title: 'Custom Badge', // Tooltip when hovering over the badge
      text: 'Product Form', // Badge text
      callback: onBtnClick
    }];
  }
});
