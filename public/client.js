// Define the name of your Power-Up
var POWER_UP_NAME = 'Custom Button Power-Up';

// Trello Power-Up Button
var onBtnClick = function(t, opts) {
  console.log('Button clicked on card:', opts);

  return t.card('all')
    .then(function(card) {
      console.log('Card data:', card);

      // Get the card title and user name
      return t.member('fullName').then(function(member) {
        const hubspotId = card.customFieldItems.find(field => field.idCustomField === '66d715a7584d0c33d06ab06f')?.value.text || '';
        const orgNo = card.customFieldItems.find(field => field.idCustomField === '66deaa1c355f14009a688b5d')?.value.text || '';
        
        console.log('HubSpot ID:', hubspotId);
        console.log('Org Number:', orgNo);

        // Fetch Younium data before opening the popup
        return fetch(`/get-younium-data?orgNo=${encodeURIComponent(orgNo)}&hubspotId=${encodeURIComponent(hubspotId)}`)
          .then(response => response.json())
          .then(youniumData => {
            console.log('Younium data:', youniumData);
          
            // Build URL for popup with all Younium data
            const externalUrl = `https://activateitems-d22e28f2e719.herokuapp.com/?youniumData=${encodeURIComponent(JSON.stringify(youniumData))}&hubspotId=${encodeURIComponent(hubspotId)}&orgNo=${encodeURIComponent(orgNo)}`;
          
            return t.popup({
              title: 'Klarmarkering',
              url: externalUrl,
              height: 800,
              width: 1000
            });
          })
          .catch(err => {
            console.error('Error fetching Younium data or displaying popup:', err);
          });
      });
    });
};

// Initialize Trello Power-Up
TrelloPowerUp.initialize({
  'card-buttons': function(t, options) {
    return [{
      icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
      text: 'Klarmarkering',
      callback: onBtnClick
    }];
  }
});
