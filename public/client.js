// Define the name of your Power-Up
var POWER_UP_NAME = 'Custom Button Power-Up';

var onBtnClick = function(t, opts) {
  console.log('Button clicked on card:', opts);

  // Fetch the custom field value from Trello
  return t.card('all')
    .then(function(card) {
      console.log('Card data:', card); // Log the card data to debug

      // Find the custom field with the specific ID
      const customField = card.customFieldItems.find(field => field.idCustomField === '66d715a7584d0c33d06ab06f');
      
      if (customField) {
        console.log('Found custom field:', customField);
      } else {
        console.log('Custom field not found!');
      }

      const hubspotId = customField && customField.value && customField.value.text ? customField.value.text : '';

      console.log('HubSpot ID:', hubspotId); // Log the HubSpot ID to check its value

      // URL of the page you want to display in the popup
      var externalUrl = `https://activateitems-d22e28f2e719.herokuapp.com/?hubspotId=${hubspotId}`;

      return t.popup({
        title: 'Open External Page',
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
