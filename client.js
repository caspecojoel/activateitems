var POWER_UP_NAME = 'Custom Button Power-Up';

var onBtnClick = function(t, opts) {
  return t.card('id')
    .then(function(card) {
      return t.get(card.id, 'shared', 'customFieldData');
    })
    .then(function(customFieldData) {
      var baseUrl = 'https://activateitems-d22e28f2e719.herokuapp.com/iframe'; // Your Heroku app's URL
      var params = Object.keys(customFieldData).map(function(key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(customFieldData[key]);
      }).join('&');
      var url = baseUrl + '?' + params;
      return t.modal({
        url: url,  // The URL for the iframe content
        height: 500, // The height of the modal
        fullscreen: false, // Whether the modal should be fullscreen
        title: 'Custom iFrame Page' // Title of the modal
      });
    });
};

TrelloPowerUp.initialize({
  'card-buttons': function(t, options) {
    return [{
      icon: 'https://example.com/icon.png', // Update this to your desired icon URL
      text: 'Open Custom iFrame', // Update the button text
      callback: onBtnClick
    }];
  },
  'card-detail-badges': function(t, options) {
    return [{
      text: 'Custom iFrame Badge', // Update the badge text
      callback: onBtnClick
    }];
  }
});
