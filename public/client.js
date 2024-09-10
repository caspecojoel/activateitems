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
      activatedCharges += product.charges.filter(charge => charge.isReady4Invoicing === "True").length; // Check if isReady4Invoicing is "True" as a string
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

// Function to handle button click and toggle invoicing status with confirmation
const handleToggleButtonClick = (chargeId, currentStatus, productName) => {
  const action = currentStatus ? 'inactivate' : 'activate';
  const confirmationMessage = `Are you sure you want to ${action} ${productName}?`;
  
  if (!confirm(confirmationMessage)) {
    return; // Exit if the user cancels the action
  }

  console.log(`Toggling charge: ${chargeId}`);

  // Simulate an API call (replace with actual API logic)
  const newStatus = !currentStatus;

  fetch(`/toggle-invoicing?chargeId=${chargeId}&status=${newStatus}`, {
    method: 'POST',
  })
  .then(response => {
    if (response.ok) {
      console.log(`Charge ${chargeId} status updated successfully`);

      // Get the button element
      const button = document.querySelector(`[data-charge-id="${chargeId}"]`);

      // Toggle the button class and text based on the new status
      if (newStatus) {
        button.textContent = "Inactivate";
        button.className = "inactivate-button";
      } else {
        button.textContent = "Activate";
        button.className = "activate-button";
      }
    } else {
      // Handle the error
      return response.json().then(errorData => {
        console.error('Failed to update the charge status:', errorData);
        alert(`Error: Failed to update the status for ${productName}. Please try again. \nError Details: ${errorData.message || "Unknown error"}`);
      });
    }
  })
  .catch(error => {
    console.error('Error updating the charge status:', error);
    alert(`An error occurred while updating the status for ${productName}. Please try again. \nError: ${error.message || "Unknown error"}`);
  });
};

// Add event listener for toggle buttons
document.addEventListener('click', function (event) {
  if (event.target && event.target.tagName === 'BUTTON') {
    const chargeId = event.target.getAttribute('data-charge-id');
    const productName = event.target.getAttribute('data-product-name');
    const currentStatus = event.target.textContent.trim() === "Inactivate"; // Determine current status based on the button text
    handleToggleButtonClick(chargeId, currentStatus, productName);
  }
});

// Function to fetch Younium data
const fetchYouniumData = (orgNo, hubspotId) => {
  console.log('Fetching Younium data for:', { orgNo, hubspotId });

  if (!orgNo || !hubspotId) {
    console.warn('Invalid hubspotId or orgNo');
    return Promise.resolve(null);  // Return null if the orgNo or hubspotId is invalid
  }

  return fetch(`/get-younium-data?orgNo=${encodeURIComponent(orgNo)}&hubspotId=${encodeURIComponent(hubspotId)}`)
    .then(response => {
      if (response.ok) {
        return response.json();
      } else if (response.status === 404) {
        // Handle case when no data is found
        console.warn('No data found for the provided orgNo and hubspotId');
        return null;
      }
      throw new Error('Failed to fetch Younium data');
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

    const hubspotId = getCustomFieldValue(card.customFieldItems, '66d715a7584d0c33d06ab06f');
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

          return t.popup({
            title: 'Klarmarkering',
            url: externalUrl,
            height: 800,
            width: 1000,
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

// Function to inject CSS for disabling custom fields
const injectDisableCustomFieldsCSS = () => {
  const style = document.createElement('style');
  style.innerHTML = `
    /* Disable the custom fields for Hubspot ID and Organisationsnummer */
    input[data-custom-field-name="Hubspot ID"],
    input[data-custom-field-name="Organisationsnummer"] {
      pointer-events: none;  /* Disable interaction */
      opacity: 0.5;          /* Make the field look greyed out */
    }
  `;
  document.head.appendChild(style);
};

// Call this function to inject the CSS when the Power-Up is initialized
injectDisableCustomFieldsCSS();

// Initialize Trello Power-Up with dynamic card-detail-badge
TrelloPowerUp.initialize({
  'card-detail-badges': (t, options) => {
    return t.card('all')
      .then(card => {
        const orgNo = getCustomFieldValue(card.customFieldItems, '66deaa1c355f14009a688b5d');
        const hubspotId = getCustomFieldValue(card.customFieldItems, '66d715a7584d0c33d06ab06f');

        return fetchYouniumData(orgNo, hubspotId)
          .then(youniumData => {
            if (!youniumData) {
              // If no data is found, return the "Invalid ID" badge
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

