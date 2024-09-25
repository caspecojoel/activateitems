// Function to get custom field value
const getCustomFieldValue = (fields, fieldId) => {
  const field = fields.find(f => f.idCustomField === fieldId);
  return field?.value?.text || field?.value?.number || '';
};

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
    return { status: 'all', text: 'All products ready', color: 'green' };
  } else if (activatedCharges > 0) {
    return { status: 'partial', text: `${activatedCharges}/${totalCharges} products ready`, color: 'lime' };
  } else {
    return { status: 'none', text: 'No products ready', color: 'red' };
  }
};

// Function to handle button click and toggle invoicing status with confirmation
const handleToggleButtonClick = (chargeId, currentStatus, productName, youniumData) => {
  const action = currentStatus ? 'inactivate' : 'activate';
  const confirmationMessage = `Are you sure you want to ${action} ${productName}?`;
  
  console.log(`Button clicked to ${action} product: ${productName}, Charge ID: ${chargeId}, Current status: ${currentStatus}`);
  
  if (!confirm(confirmationMessage)) {
    console.log(`User cancelled the ${action} action.`);
    return; // Exit if the user cancels the action
  }

  console.log(`Proceeding to ${action} charge: ${chargeId}`);

  // Construct the activation URL with necessary parameters
  const orderId = youniumData.id;
  const accountId = youniumData.account.id;
  const invoiceAccountId = youniumData.invoiceAccount.id;
  const product = youniumData.products.find(p => p.charges.some(c => c.id === chargeId));
  const productId = product.productId;
  const chargePlanId = product.chargePlanId;
  const isReadyForInvoicing = currentStatus ? 0 : 1; // Toggle status

  const activationUrl = `https://cas-test.loveyourq.se/dev/UpdateReady4Invoicing?OrderId=${orderId}&AccountId=${accountId}&InvoiceAccountId=${invoiceAccountId}&ProductId=${productId}&ChargePlanId=${chargePlanId}&ChargeId=${chargeId}&LegalEntity=Caspeco%20AB&IsReady4Invoicing=${isReadyForInvoicing}`;

  console.log(`Generated activation URL: ${activationUrl}`);

  // Fetch credentials injected from the backend
  const authUsername = AUTH_USERNAME; // This should come from the backend
  const authPassword = AUTH_PASSWORD; // This should come from the backend

  // Send the activation request with Basic Authentication
  fetch(activationUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(authUsername + ':' + authPassword), // Basic auth with username and password
      'Content-Type': 'application/json'
    },
  })
    .then(response => {
      if (response.ok) {
        console.log(`Successfully updated Charge ${chargeId} status to ${isReadyForInvoicing ? 'Ready' : 'Not Ready'} for invoicing`);

        // Get the button element
        const button = document.querySelector(`[data-charge-id="${chargeId}"]`);

        // Toggle the button class and text based on the new status
        if (isReadyForInvoicing) {
          button.textContent = "Mark as not ready";
          button.className = "inactivate-button";
        } else {
          button.textContent = "Mark as ready";
          button.className = "activate-button";
        }
      } else {
        console.error('Failed to update the charge status');
      }
    })
    .catch(error => console.error('Error updating the charge status:', error));
};

// Add event listener for toggle buttons
document.addEventListener('click', function (event) {
  if (event.target && event.target.tagName === 'BUTTON') {
    const chargeId = event.target.getAttribute('data-charge-id');
    const productName = event.target.getAttribute('data-product-name');
    const currentStatus = event.target.textContent.trim() === "Mark as not ready"; // Determine current status based on the button text

    console.log(`Button clicked for product: ${productName}, Charge ID: ${chargeId}, Current Status: ${currentStatus}`);

    handleToggleButtonClick(chargeId, currentStatus, productName, youniumData);
  }
});

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

  return fetch(`/get-younium-data?orgNo=${encodeURIComponent(orgNo)}&hubspotId=${encodeURIComponent(hubspotId)}`)
    .then(response => response.json())
    .then(data => {
      console.log('Younium API response data:', data);
      return data;
    })
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

    const hubspotId = getCustomFieldValue(card.customFieldItems, '66e2a183ccc0da772098ab1e');
    const orgNo = getCustomFieldValue(card.customFieldItems, '66deaa1c355f14009a688b5d');
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
            height: 1000,  // Set the height (1000px in this case)
            width: 1000,   // You can also set the width as needed
            fullscreen: false, // Set to true if you want the modal to take up the full screen
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

// Initialize Trello Power-Up with dynamic card-detail-badge
TrelloPowerUp.initialize({
  'card-detail-badges': (t, options) => {
    return t.card('all')
      .then(card => {
        const orgNo = getCustomFieldValue(card.customFieldItems, '66deaa1c355f14009a688b5d');
        const hubspotId = getCustomFieldValue(card.customFieldItems, '66e2a183ccc0da772098ab1e');

        return fetchYouniumData(orgNo, hubspotId)
          .then(youniumData => {
            if (!youniumData || youniumData.name === 'Invalid hubspot or orgnummer') {
              return [{
                text: 'Invalid ID',
                color: 'red',
                icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
                callback: onBtnClick
              }];
            }

            const status = getActivationStatus(youniumData);
            return [{
              text: status.text,
              color: status.color,
              icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
              callback: onBtnClick
            }];
          })
          .catch(err => {
            console.error('Error processing Younium data:', err);
            return [{
              text: 'Error loading status',
              color: 'red',
              icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
              callback: onBtnClick
            }];
          });
      });
  }
});
