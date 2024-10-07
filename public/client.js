// client.js

// Define field IDs
const orgNoFieldId = '66deaa1c355f14009a688b5d'; // Replace with your actual OrgNo field ID
const hubspotIdFieldId = '66e2a183ccc0da772098ab1e'; // Replace with your actual HubSpot ID field ID
const iconUrl = 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico'; // Replace with your actual icon URL

// Function to get custom field value
function getCustomFieldValue(fields, fieldId) {
  const field = fields.find(f => f.idCustomField === fieldId);
  return field?.value?.text || field?.value?.number || '';
}

// Function to get activation status
const getActivationStatus = (youniumData) => {
  console.log('getActivationStatus received:', youniumData);
  if (!youniumData) {
    console.log('youniumData is null or undefined');
    return { status: 'error', text: 'No data available', color: 'red' };
  }
  if (!youniumData.products || !Array.isArray(youniumData.products)) {
    console.log('youniumData.products is undefined or not an array');
    return { status: 'error', text: 'No products data available', color: 'red' };
  }

  let totalCharges = 0;
  let activatedCharges = 0;

  youniumData.products.forEach(product => {
    if (product.charges && Array.isArray(product.charges)) {
      totalCharges += product.charges.length;
      activatedCharges += product.charges.filter(charge => 
        charge.ready4invoicing === true || charge.ready4invoicing === "true" || charge.ready4invoicing === "1"
      ).length;      
    }
  });

  console.log('Total charges:', totalCharges);
  console.log('Activated charges:', activatedCharges);

  if (totalCharges === 0) {
    return { status: 'none', text: 'No charges found', color: 'yellow' };
  } else if (activatedCharges === totalCharges) {
    return { status: 'all', text: 'All products ready', color: 'green' };
  } else if (activatedCharges > 0) {
    return { status: 'partial', text: `${activatedCharges}/${totalCharges} products ready`, color: 'lime' };
  } else {
    return { status: 'none', text: 'No products ready', color: 'red' };
  }
};

// Function to fetch Younium data
const fetchYouniumData = (orgNo, hubspotId) => {
  console.log('Fetching Younium data for:', { orgNo, hubspotId });

  if (!orgNo || !hubspotId) {
    console.warn('Invalid hubspotId or orgNo');
    return Promise.resolve({
      name: 'Invalid hubspot or orgnummer',
      accountNumber: null,
    });
  }

  // Use the correct API endpoint
  const apiUrl = `https://activateitems-d22e28f2e719.herokuapp.com/get-younium-data?orgNo=${encodeURIComponent(orgNo)}&hubspotId=${encodeURIComponent(hubspotId)}`;

  return fetch(apiUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Younium API response data:', data);
      return data;
    })
    .catch(err => {
      console.error('Error fetching Younium data:', err);
      return null;
    });
};

// Function to fetch and update badge data
function fetchAndUpdateBadge(t) {
  t.card('all')
    .then(function(card) {
      const orgNo = getCustomFieldValue(card.customFieldItems, orgNoFieldId);
      const hubspotId = getCustomFieldValue(card.customFieldItems, hubspotIdFieldId);

      console.log('orgNo:', orgNo);
      console.log('hubspotId:', hubspotId);

      return fetchYouniumData(orgNo, hubspotId)
        .then(function(youniumData) {
          let badgeData;
          if (!youniumData || youniumData.name === 'Invalid hubspot or orgnummer') {
            badgeData = {
              text: 'Invalid ID',
              color: 'red',
              icon: iconUrl,
              callback: onBtnClick,
              refresh: false
            };
          } else {
            const status = getActivationStatus(youniumData);
            badgeData = {
              text: status.text,
              color: status.color,
              icon: iconUrl,
              callback: onBtnClick,
              refresh: false
            };
          }

          // Store badge data without calling t.forceRerender() or t.notifyParent()
          return t.set('card', 'private', 'badgeData', badgeData);
        })
        .catch(function(err) {
          console.error('Error fetching or processing Younium data:', err);
          const badgeData = {
            text: 'Error loading status',
            color: 'red',
            icon: iconUrl,
            callback: onBtnClick,
            refresh: false
          };
          return t.set('card', 'private', 'badgeData', badgeData);
        });      
    });
}

// Function to handle the button click on the badge
const onBtnClick = (t, opts) => {
  console.log('Button clicked on card:', opts);

  return t.card('all').then(card => {
    console.log('Card data:', card);

    const hubspotId = getCustomFieldValue(card.customFieldItems, hubspotIdFieldId);
    const orgNo = getCustomFieldValue(card.customFieldItems, orgNoFieldId);
    console.log('HubSpot ID:', hubspotId);
    console.log('Org Number:', orgNo);

    return t.member('fullName').then(member => {
      const userName = member.fullName;

      // Fetch Younium data and display in popup
      return fetchYouniumData(orgNo, hubspotId)
        .then(youniumData => {
          if (!youniumData) {
            throw new Error('Failed to fetch Younium data');
          }

          const externalUrl = `https://activateitems-d22e28f2e719.herokuapp.com/?youniumData=${encodeURIComponent(JSON.stringify(youniumData))}&hubspotId=${encodeURIComponent(hubspotId)}&orgNo=${encodeURIComponent(orgNo)}`;

          return t.modal({
            title: 'Ready for invoicing',
            url: externalUrl,
            height: 1000,
            width: 1000,
            fullscreen: false,
            mouseEvent: opts.mouseEvent
          });

        })
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

// Initialize Trello Power-Up
TrelloPowerUp.initialize({
  'card-detail-badges': function(t, options) {
    return t.get('card', 'private', 'badgeData')
      .then(function(badgeData) {
        if (badgeData) {
          // Return badge data without clearing it
          return [badgeData];
        } else {
          // Start fetching data asynchronously
          fetchAndUpdateBadge(t);
          // Return loading badge with refresh
          return [{
            text: 'Loading...',
            color: 'blue',
            icon: iconUrl,
            refresh: 2 // Refresh every 2 seconds until data is ready
          }];
        }
      });
  }
});
