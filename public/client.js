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
            width: 1000,
            mouseEvent: opts.mouseEvent // Pass mouseEvent for proper popup placement
          });
        })
        .then(() => console.log('Popup displayed successfully with all data'))
        .catch(err => console.error('Error fetching Younium data or displaying popup:', err));
    });
  });
};

// Initialize Trello Power-Up with badge color based on activation status
TrelloPowerUp.initialize({
  'card-detail-badges': async (t, options) => {
    try {
      // Fetch the Younium data
      const card = await t.card('all');
      const hubspotId = card.customFieldItems?.find(field => field.idCustomField === '66d715a7584d0c33d06ab06f')?.value?.text;
      const orgNo = card.customFieldItems?.find(field => field.idCustomField === '66deaa1c355f14009a688b5d')?.value?.text;

      // Return if we can't find the HubSpot ID or Org Number
      if (!hubspotId || !orgNo) {
        throw new Error('Missing HubSpot ID or Org Number.');
      }

      // Get data from API
      const youniumData = await fetch(`/get-younium-data?orgNo=${encodeURIComponent(orgNo)}&hubspotId=${encodeURIComponent(hubspotId)}`)
        .then(response => response.json());

      if (!youniumData || !youniumData.products) {
        throw new Error('No products found in Younium data.');
      }

      // Count total charges and activated charges
      let totalCharges = 0;
      let activatedCharges = 0;

      youniumData.products.forEach(product => {
        if (product.charges) {
          product.charges.forEach(charge => {
            totalCharges++;
            if (charge.isReady4Invoicing === true || charge.isReady4Invoicing === "True") {
              activatedCharges++;
            }
          });
        }
      });

      let badgeText = '';
      let badgeColor = '';

      // Set the badge text and color based on the number of activated charges
      if (activatedCharges === 0) {
        badgeText = 'No products activated';
        badgeColor = 'red';
      } else if (activatedCharges === totalCharges) {
        badgeText = 'All products activated';
        badgeColor = 'green';
      } else {
        badgeText = `${activatedCharges}/${totalCharges} products activated`;
        badgeColor = 'lightgreen';
      }

      // Return the badge
      return [{
        text: badgeText,
        color: badgeColor,  // Set the badge color dynamically
        icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
        callback: onBtnClick
      }];
    } catch (error) {
      console.error('Error in card-detail-badges:', error);
      return [];  // Return an empty badge in case of error
    }
  }
});
