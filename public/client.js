// Define the name of your Power-Up
var POWER_UP_NAME = 'Custom Button Power-Up';

var onBtnClick = function(t, opts) {
  console.log('Button clicked on card:', opts);

  // URL of the page you want to display in the popup
  var externalUrl = 'https://activateitems-d22e28f2e719.herokuapp.com/';

  return t.popup({
    title: 'Open External Page',
    url: externalUrl,
    height: 600, // Height of the popup in pixels
    width: 800   // Width of the popup in pixels
  }).then(() => {
    console.log('Popup displayed successfully');
  }).catch(err => {
    console.error('Error displaying popup:', err);
  });
};

TrelloPowerUp.initialize({
  'card-buttons': function(t, options) {
    console.log('Initializing card-buttons capability');
    return [{
      icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
      text: 'Open External Page',
      callback: onBtnClick
    }];
  }
});
