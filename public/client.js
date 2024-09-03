// Define the name of your Power-Up
var POWER_UP_NAME = 'Custom Button Power-Up';

var onBtnClick = function(t, opts) {
  console.log('Button clicked on card:', opts);

  return t.card('all')
    .then(function(card) {
      console.log('Card data:', card);

      // Get the card title
      const cardTitle = card.name;

      // Find the custom field with the specific ID
      const customField = card.customFieldItems.find(field => field.idCustomField === '66d715a7584d0c33d06ab06f');
      console.log('Found custom field:', customField);

      let hubspotId = '';
      if (customField && customField.value) {
        if (customField.value.text) {
          hubspotId = customField.value.text;
        } else if (customField.value.number) {
          hubspotId = customField.value.number;
        }
      }
      console.log('HubSpot ID:', hubspotId);

      // Get labels from the card
      const labels = card.labels.map(label => label.name).join(',');

      // URL of the page you want to display in the popup, including cardTitle
      var externalUrl = `https://activateitems-d22e28f2e719.herokuapp.com/?hubspotId=${hubspotId}&labels=${encodeURIComponent(labels)}&cardTitle=${encodeURIComponent(cardTitle)}`;

      return t.popup({
        title: 'Klarmarkering',
        url: externalUrl,
        height: 800,
        width: 1000
      }).then(() => {
        console.log('Popup displayed successfully with HubSpot ID, labels, and card title:', hubspotId, labels, cardTitle);
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
