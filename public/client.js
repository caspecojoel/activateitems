// Define the name of your Power-Up
var POWER_UP_NAME = 'Custom Button Power-Up';

var onBtnClick = function(t, opts) {
  console.log('Button clicked on card:', opts);

  return t.card('all')
    .then(function(card) {
      console.log('Card data:', card);

      // Get the card title
      const cardTitle = card.name;

      // Get the user information
      return t.member('fullName').then(function(member) {
        const userName = member.fullName;

        // Find the custom field with the specific ID for HubSpot Deal ID
        const hubspotCustomField = card.customFieldItems.find(field => field.idCustomField === '66d715a7584d0c33d06ab06f');
        console.log('Found HubSpot custom field:', hubspotCustomField);

        let hubspotId = '';
        if (hubspotCustomField && hubspotCustomField.value) {
          if (hubspotCustomField.value.text) {
            hubspotId = hubspotCustomField.value.text;
          } else if (hubspotCustomField.value.number) {
            hubspotId = hubspotCustomField.value.number;
          }
        }
        console.log('HubSpot ID:', hubspotId);

        // Find the custom field with the specific ID for Org Number
        const orgNumCustomField = card.customFieldItems.find(field => field.idCustomField === '66deaa1c355f14009a688b5d');
        console.log('Found Org Number custom field:', orgNumCustomField);

        let orgNo = '';
        if (orgNumCustomField && orgNumCustomField.value) {
          if (orgNumCustomField.value.text) {
            orgNo = orgNumCustomField.value.text;
          } else if (orgNumCustomField.value.number) {
            orgNo = orgNumCustomField.value.number;
          }
        }
        console.log('Org Number:', orgNo);

        // Get labels from the card
        const labels = card.labels.map(label => label.name).join(',');

        // Fetch Younium data before opening the popup
        return fetch(`/get-younium-data?orgNo=${encodeURIComponent(orgNo)}&hubspotId=${encodeURIComponent(hubspotId)}`)
          .then(response => response.json())
          .then(youniumData => {
            console.log('Younium data:', youniumData);
          
            // Build URL for popup with all Younium data + HubSpot ID and Org Number
            const externalUrl = `https://activateitems-d22e28f2e719.herokuapp.com/?youniumData=${encodeURIComponent(JSON.stringify(youniumData))}&hubspotId=${encodeURIComponent(hubspotId)}&orgNo=${encodeURIComponent(orgNo)}`;
          
            return t.popup({
              title: 'Klarmarkering',
              url: externalUrl,
              height: 800,
              width: 1000
            });
          })
          .then(() => {
            console.log('Popup displayed successfully with all data');
          })
          .catch(err => {
            console.error('Error fetching Younium data or displaying popup:', err);
          });
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
