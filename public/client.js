// Function to get custom field value
const getCustomFieldValue = (fields, fieldId) => {
  const field = fields.find(f => f.idCustomField === fieldId);
  return field?.value?.text || field?.value?.number || '';
};

// Function to get activation status
const getActivationStatus = (youniumData) => {
  if (!youniumData || !youniumData.charges) {
    return { status: 'error', text: 'No data available' };
  }

  const totalCharges = youniumData.charges.length;
  const activatedCharges = youniumData.charges.filter(charge => charge.isready4invoicing).length;

  if (activatedCharges === totalCharges && totalCharges > 0) {
    return { status: 'all', text: 'All products activated', color: 'green' };
  } else if (activatedCharges > 0) {
    return { status: 'partial', text: `${activatedCharges}/${totalCharges} products activated`, color: 'lime' };
  } else {
    return { status: 'none', text: 'No products activated', color: 'red' };
  }
};

// Function to fetch Younium data
const fetchYouniumData = (orgNo, hubspotId) => {
  return fetch(`/get-younium-data?orgNo=${encodeURIComponent(orgNo)}&hubspotId=${encodeURIComponent(hubspotId)}`)
    .then(response => response.json())
    .catch(err => {
      console.error('Error fetching Younium data:', err);
      return null;
    });
};

// Define the Power-Up
const onBtnClick = (t, opts) => {
  console.log('Button clicked on card:', opts);

  return t.card('all').then(card => {
    console.log('Card data:', card);

    const cardTitle = card.name;

    const hubspotId = getCustomFieldValue(card.customFieldItems, '66d715a7584d0c33d06ab06f');
    const orgNo = getCustomFieldValue(card.customFieldItems, '66deaa1c355f14009a688b5d');
    console.log('HubSpot ID:', hubspotId);
    console.log('Org Number:', orgNo);

    return t.member('fullName').then(member => {
      const userName = member.fullName;
      const labels = card.labels.map(label => label.name).join(',');

      // Fetch Younium data and display in popup
      return fetchYouniumData(orgNo, hubspotId)
        .then(youniumData => {
          console.log('Younium data:', youniumData);

          if (!youniumData) {
            throw new Error('Failed to fetch Younium data');
          }

          const externalUrl = `https://activateitems-d22e28f2e719.herokuapp.com/?youniumData=${encodeURIComponent(JSON.stringify(youniumData))}&hubspotId=${encodeURIComponent(hubspotId)}&orgNo=${encodeURIComponent(orgNo)}`;

          return t.popup({
            title: 'Klarmarkering',
            url: externalUrl,
            height: 800,
            width: 1000,
            mouseEvent: opts.mouseEvent // Pass mouseEvent for proper popup placement
          });
        })
        .then(() => console.log('Popup displayed successfully with all data'))
        .catch(err => {
          console.error('Error fetching Younium data or displaying popup:', err);
          return t.alert({
            message: 'Failed to load Younium data. Please try again later.',
            duration: 5
          });
        });
    });
  });
};

// Initialize Trello Power-Up with dynamic card-detail-badge
TrelloPowerUp.initialize({
  'card-detail-badges': (t, options) => {
    return t.card('all')
      .then(card => {
        const orgNo = getCustomFieldValue(card.customFieldItems, '66deaa1c355f14009a688b5d');
        const hubspotId = getCustomFieldValue(card.customFieldItems, '66d715a7584d0c33d06ab06f');

        return fetchYouniumData(orgNo, hubspotId)
          .then(youniumData => {
            const status = getActivationStatus(youniumData);
            return [{
              text: status.text,
              icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
              color: status.color,
              callback: onBtnClick
            }];
          })
          .catch(err => {
            console.error('Error processing Younium data:', err);
            return [{
              text: 'Error loading status',
              icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
              color: 'red',
              callback: onBtnClick
            }];
          });
      });
  }
});