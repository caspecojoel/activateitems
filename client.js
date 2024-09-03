var POWER_UP_NAME = 'Custom Button Power-Up';

var onBtnClick = function(t, opts) {
  return t.card('id')
    .then(function(card) {
      return t.get(card.id, 'shared', 'customFieldData');
    })
    .then(function(customFieldData) {
      var baseUrl = 'https://example.com/search?';
      var params = Object.keys(customFieldData).map(function(key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(customFieldData[key]);
      }).join('&');
      var url = baseUrl + params;
      return t.modal({
        url: url,
        height: 500,
        fullscreen: false,
        title: 'External Webpage'
      });
    });
};

TrelloPowerUp.initialize({
  'card-buttons': function(t, options) {
    return [{
      icon: 'https://example.com/icon.png',
      text: 'Open Custom Page',
      callback: onBtnClick
    }];
  },
  'card-detail-badges': function(t, options) {
    return [{
      text: 'Custom Button',
      callback: onBtnClick
    }];
  }
});