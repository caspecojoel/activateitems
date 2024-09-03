// Define the name of your Power-Up
var POWER_UP_NAME = 'Custom Button Power-Up';

var onBtnClick = function(t, opts) {
  console.log('Button clicked on card:', opts);

  // Fetch the custom field value from Trello
  return t.card('all')
    .then(function(card) {
      // Find the custom field with the specific ID
      const customField = card.customFieldItems.find(field => field.idCustomField === '66d715a7584d0c33d06ab06f');
      const hubspotId = customField ? customField.value.text : '';

      // URL of the page you want to display in the popup
      var externalUrl = `https://activateitems-d22e28f2e719.herokuapp.com/?hubspotId=${hubspotId}`;

      return t.popup({
        title: 'Klarmarkera',
        url: externalUrl,
        height: 800,  // Set height here
        width: 1000   // Set width here
      }).then(() => {
        console.log('Popup displayed successfully with HubSpot ID:', hubspotId);
      }).catch(err => {
        console.error('Error displaying popup:', err);
      });
    });
};

TrelloPowerUp.initialize({
  'card-buttons': function(t, options) {
    console.log('Initializing card-buttons capability');
    return [{
      icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
      text: 'Klarmarkering',
      callback: onBtnClick
    }];
  }
});
