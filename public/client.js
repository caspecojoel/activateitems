// Define the Power-Up
const onBtnClick = (t, opts) => {
  console.log('Button clicked on card:', opts);

  return t.card('all').then(card => {
    console.log('Card data:', card);

    const cardTitle = card.name;

    // Get HubSpot ID and Org Number from custom fields
    const getCustomFieldValue = (fields, fieldId) => {
      const field = fields.find(f => f.idCustomField === fieldId);
      return field?.value?.text || field?.value?.number || '';
    };

    const hubspotId = getCustomFieldValue(card.customFieldItems, '66d715a7584d0c33d06ab06f');
    const orgNo = getCustomFieldValue(card.customFieldItems, '66deaa1c355f14009a688b5d');
    console.log('HubSpot ID:', hubspotId);
    console.log('Org Number:', orgNo);

    return t.member('fullName').then(member => {
      const userName = member.fullName;
      const labels = card.labels.map(label => label.name).join(',');

      // Fetch Younium data and display in popup
      return fetch(`/get-younium-data?orgNo=${encodeURIComponent(orgNo)}&hubspotId=${encodeURIComponent(hubspotId)}`)
        .then(response => response.json())
        .then(youniumData => {
          console.log('Younium data:', youniumData);

          const externalUrl = `https://activateitems-d22e28f2e719.herokuapp.com/?youniumData=${encodeURIComponent(JSON.stringify(youniumData))}&hubspotId=${encodeURIComponent(hubspotId)}&orgNo=${encodeURIComponent(orgNo)}`;

          return t.popup({
            title: 'Klarmarkering',
            url: externalUrl,
            height: 800,
            width: 1000
          });
        })
        .then(() => console.log('Popup displayed successfully with all data'))
        .catch(err => console.error('Error fetching Younium data or displaying popup:', err));
    });
  });
};

// Initialize Trello Power-Up with only the card-detail-badge
TrelloPowerUp.initialize({
  'card-detail-badges': (t, options) => [{
    text: 'Power-Up Badge',
    icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
    color: 'green',  // Can set color based on status
    callback: onBtnClick
  }]
});
