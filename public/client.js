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

// Function to handle retry logic for fetching updated Younium data
const fetchLatestYouniumData = (retries, delay, orgNo, hubspotId) => {
  fetchYouniumData(orgNo, hubspotId)
    .then(updatedYouniumData => {
      console.log('Updated Younium data received:', updatedYouniumData);

      if (!updatedYouniumData || updatedYouniumData.name === 'Invalid hubspot or orgnummer') {
        console.error('Failed to fetch valid updated Younium data:', updatedYouniumData);
        alert('Failed to fetch valid updated data. Please verify Hubspot ID and Organization Number.');
        return;
      }

      if (!updatedYouniumData.isLastVersion) {
        if (retries > 0) {
          console.warn(`Fetched data is not the latest version. Retrying in ${delay} ms...`);
          setTimeout(() => fetchLatestYouniumData(retries - 1, delay, orgNo, hubspotId), delay);
        } else {
          console.error('Failed to fetch the latest version after multiple retries.');
          alert('Failed to fetch the latest version. Please try again later.');
        }
      } else {
        updateModalWithYouniumData(updatedYouniumData);
      }
    })
    .catch(fetchError => {
      console.error('Error fetching updated Younium data:', fetchError);
      if (retries > 0) {
        setTimeout(() => fetchLatestYouniumData(retries - 1, delay, orgNo, hubspotId), delay);
      } else {
        alert('Error fetching updated data. Please try again later.');
      }
    });
};

const handleToggleButtonClick = (chargeNumber, currentStatus, productName, youniumData) => {
  const action = currentStatus ? 'inactivate' : 'activate';
  const confirmationMessage = `Are you sure you want to ${action} ${productName}?`;

  console.log(`Button clicked to ${action} product: ${productName}, Charge Number: ${chargeNumber}, Current status: ${currentStatus}`);

  if (!confirm(confirmationMessage)) {
    console.log(`User cancelled the ${action} action.`);
    return;
  }

  console.log(`Proceeding to ${action} charge: ${chargeNumber}`);

  // Extracting required data from youniumData
  const orderId = youniumData.id;  // Ensure this is the latest version
  const accountId = youniumData.account.accountNumber;
  const invoiceAccountId = youniumData.invoiceAccount.accountNumber;
  const product = youniumData.products.find(p => p.charges.some(c => c.chargeNumber === chargeNumber));

  // Validation checks
  if (!product) {
    console.error(`Error: No product found for Charge Number: ${chargeNumber}`);
    alert(`Error: No product found for Charge Number: ${chargeNumber}`);
    return;
  }

  const productId = product.productNumber;
  const chargePlanId = product.chargePlanNumber;
  const ready4invoicing = currentStatus ? "0" : "1";

  // Retrieve orgNo and hubspotId from the DOM elements
  const orgNo = document.getElementById('org-number').textContent.trim();
  const hubspotId = document.getElementById('hubspot-id').textContent.trim();

  // Further validation checks before making the request
  if (!orderId || !accountId || !invoiceAccountId || !productId || !chargePlanId || !orgNo || !hubspotId) {
    console.error('Validation failed: Missing required information to proceed with the invoicing status update.');
    alert('Validation failed: Missing required information to proceed with the invoicing status update.');
    return;
  }

  // Prepare the request body
  const requestBody = {
    chargeNumber,
    orderId,
    accountId,
    invoiceAccountId,
    productId,
    chargePlanId,
    ready4invoicing
  };

  // Log the full request body for verification
  console.log('Request body being sent to /toggle-invoicing-status:', requestBody);

  // Send the request to the backend API
  fetch('/toggle-invoicing-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })
    .then(response => {
      console.log('Raw API Response:', response);
      console.log('Received response status:', response.status);

      if (!response.ok) {
        return response.text().then(errorText => {
          console.error('Error response text:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        });
      }

      return response.json();
    })
    .then(data => {
      console.log('Parsed response data:', data);

      if (data.success) {
        console.log(`Successfully updated Charge ${chargeNumber} status to ${ready4invoicing === "true" || ready4invoicing === "1" ? 'Ready' : 'Not Ready'} for invoicing`);

        // Retry to fetch the latest data after a delay
        fetchLatestYouniumData(3, 2000, orgNo, hubspotId); // Retry 3 times with a 2000ms delay
      } else {
        console.error('Failed to update the charge status:', data.message, data.details);
        alert(`Failed to update status: ${data.message}`);
      }
    })
    .catch(error => {
      console.error('Error updating the charge status:', error);
      alert(`Error updating status: ${error.message}`);
    });
};


const updateModalWithYouniumData = (youniumData) => {
  console.log('Updating modal with updated Younium data:', youniumData);

  // Validate that youniumData and required fields are present
  if (!youniumData || !youniumData.account || !youniumData.products) {
    console.error('Invalid Younium data provided to update modal:', youniumData);
    alert('Failed to update the modal. Missing or invalid Younium data.');
    return;
  }

  // Update the modal elements with the new data
  document.getElementById('account-name').textContent = youniumData.account.name || 'N/A';
  document.getElementById('order-status').textContent = youniumData.status || 'N/A';
  document.getElementById('order-description').textContent = youniumData.description || 'N/A';
  document.getElementById('products-container').innerHTML = '';

  // Iterate over the products to populate the table
  youniumData.products.forEach(product => {
    if (product.charges && Array.isArray(product.charges)) {
      product.charges.forEach(charge => {
        // Check if the charge is ready for invoicing based on the new ready4invoicing values
        const isActivated = charge.ready4invoicing === true || charge.ready4invoicing === "1" || charge.ready4invoicing === "true";

        const buttonClass = isActivated ? 'inactivate-button' : 'activate-button';
        const buttonText = isActivated ? 'Mark as not ready' : 'Mark as ready';

        // Format the effective start date (if available)
        const effectiveStartDate = charge.effectiveStartDate ? new Date(charge.effectiveStartDate).toLocaleDateString() : 'N/A';

        // Populate the table row
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${product.name || 'N/A'}</td>
          <td>${charge.name || 'N/A'}</td>
          <td>${effectiveStartDate}</td>
          <td>${isActivated ? 'Ready for invoicing' : 'Not ready for invoicing'}</td>
          <td class="button-container">
            <button class="${buttonClass}" data-charge-number="${charge.chargeNumber}" data-product-name="${product.name || ''}">
              ${buttonText}
            </button>
          </td>
        `;
        document.getElementById('products-container').appendChild(row);
      });
    } else {
      console.error('Invalid charges data for product:', product);
    }
  });
};



// Add event listener for toggle buttons
document.addEventListener('click', function (event) {
  if (event.target && event.target.tagName === 'BUTTON') {
    const chargeNumber = event.target.getAttribute('data-charge-number');
    const productName = event.target.getAttribute('data-product-name');
    const currentStatus = event.target.textContent.trim() === "Mark as not ready"; // Determine current status based on the button text

    console.log(`Button clicked for product: ${productName}, Charge Number: ${chargeNumber}, Current Status: ${currentStatus}`);

    handleToggleButtonClick(chargeNumber, currentStatus, productName, youniumData);
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
