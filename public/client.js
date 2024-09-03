var POWER_UP_NAME = 'Custom Button Power-Up';

// Function to handle button click and open the modal
var onBtnClick = function(t, opts) {
  return t.modal({
    url: 'https://activateitems-d22e28f2e719.herokuapp.com/iframe',
    height: 500, // Adjust the height as needed
    title: 'Product Details'
  });
};

TrelloPowerUp.initialize({
  'card-buttons': function(t, options) {
    return [{
      icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico', // Replace with your icon URL
      text: 'Show on Card', // Text for the button
      callback: onBtnClick
    }];
  },
  'card-detail-badges': function(t, options) {
    return [{
      title: 'Custom Badge',
      text: 'Product Form',
      callback: onBtnClick
    }];
  }
});

