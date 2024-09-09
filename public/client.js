// Function to get activation status
const getActivationStatus = (youniumData) => {
  console.log('getActivationStatus received:', youniumData);
  if (!youniumData) {
    console.log('youniumData is null or undefined');
    return { status: 'error', text: 'No data available' };
  }
  if (!youniumData.products || !Array.isArray(youniumData.products)) {
    console.log('youniumData.products is undefined or not an array');
    return { status: 'error', text: 'No products data available' };
  }

  let totalCharges = 0;
  let activatedCharges = 0;

  youniumData.products.forEach(product => {
    if (product.charges && Array.isArray(product.charges)) {
      totalCharges += product.charges.length;
      activatedCharges += product.charges.filter(charge => charge.isready4invoicing).length;
    }
  });

  console.log('Total charges:', totalCharges);
  console.log('Activated charges:', activatedCharges);

  if (totalCharges === 0) {
    return { status: 'none', text: 'No charges found', color: 'yellow' };
  } else if (activatedCharges === totalCharges) {
    return { status: 'all', text: 'All products activated', color: 'green' };
  } else if (activatedCharges > 0) {
    return { status: 'partial', text: `${activatedCharges}/${totalCharges} products activated`, color: 'lime' };
  } else {
    return { status: 'none', text: 'No products activated', color: 'red' };
  }
};

// The rest of the code remains the same...

// Initialize Trello Power-Up with dynamic card-detail-badge
TrelloPowerUp.initialize({
  'card-detail-badges': (t, options) => {
    return t.card('all')
      .then(card => {
        const orgNo = getCustomFieldValue(card.customFieldItems, '66deaa1c355f14009a688b5d');
        const hubspotId = getCustomFieldValue(card.customFieldItems, '66d715a7584d0c33d06ab06f');

        console.log('Card data:', { orgNo, hubspotId });

        return fetchYouniumData(orgNo, hubspotId)
          .then(youniumData => {
            console.log('Younium data before getActivationStatus:', youniumData);
            const status = getActivationStatus(youniumData);
            console.log('Activation status:', status);
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