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

// Function to fetch and update badge data
function fetchAndUpdateBadge(t) {
  // Fetch data asynchronously
  t.card('all')
    .then(function(card) {
      const orgNo = getCustomFieldValue(card.customFieldItems, '66deaa1c355f14009a688b5d');
      const hubspotId = getCustomFieldValue(card.customFieldItems, '66e2a183ccc0da772098ab1e');

      return fetchYouniumData(orgNo, hubspotId)
        .then(function(youniumData) {
          var badgeData;
          if (!youniumData || youniumData.name === 'Invalid hubspot or orgnummer') {
            badgeData = {
              text: 'Invalid ID',
              color: 'red',
              icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
              callback: onBtnClick
            };
          } else {
            const status = getActivationStatus(youniumData);
            badgeData = {
              text: status.text,
              color: status.color,
              icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
              callback: onBtnClick
            };
          }

          // Store badge data
          return t.set('card', 'private', 'badgeData', badgeData).then(function() {
            // Refresh badges by notifying parent
            t.notifyParent('card-detail-badges');
          });
        })
        .catch(function(err) {
          console.error('Error fetching Younium data:', err);
          var badgeData = {
            text: 'Error loading status',
            color: 'red',
            icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
            callback: onBtnClick
          };
          return t.set('card', 'private', 'badgeData', badgeData).then(function() {
            t.notifyParent('card-detail-badges');
          });
        });
    });
}

const fetchLatestYouniumData = (retries, delay, orgNo, hubspotId) => {
  let lastData = null;
  const tryFetch = (attemptNumber) => {
    fetchYouniumData(orgNo, hubspotId)
      .then(updatedYouniumData => {
        console.log(`Attempt ${attemptNumber}: Updated Younium data received:`, updatedYouniumData);
        console.log('isLastVersion:', updatedYouniumData.isLastVersion);

        if (!updatedYouniumData || updatedYouniumData.name === 'Invalid hubspot or orgnummer') {
          console.error('Failed to fetch valid updated Younium data:', updatedYouniumData);
          alert('Failed to fetch valid updated data. Please verify Hubspot ID and Organization Number.');
          return;
        }

        if (!updatedYouniumData.isLastVersion && !isDataEqual(lastData, updatedYouniumData)) {
          lastData = updatedYouniumData;
          if (attemptNumber < retries) {
            console.warn(`Fetched data might not be the latest version. Retrying in ${delay} ms...`);
            setTimeout(() => tryFetch(attemptNumber + 1), delay);
          } else {
            console.warn('Failed to confirm the latest version after multiple retries. Proceeding with the most recent data.');
            updateModalWithYouniumData(updatedYouniumData);
          }
        } else {
          console.log('Latest data version confirmed or no changes detected.');
          updateModalWithYouniumData(updatedYouniumData);
        }
      })
      .catch(fetchError => {
        console.error('Error fetching updated Younium data:', fetchError);
        if (attemptNumber < retries) {
          setTimeout(() => tryFetch(attemptNumber + 1), delay);
        } else {
          alert('Error fetching updated data. Please try again later.');
        }
      });
  };

  tryFetch(1);
};

// Helper function to compare two Younium data objects
const isDataEqual = (data1, data2) => {
  // Implement a deep comparison of relevant fields
  // Return true if the data is effectively the same, false otherwise
  // This is a simplified example, you'll need to adjust based on your data structure
  return JSON.stringify(data1) === JSON.stringify(data2);
};

const handleToggleButtonClick = async (chargeNumber, currentStatus, productName, youniumData) => {
  const action = currentStatus ? 'inactivate' : 'activate';
  const confirmationMessage = `Are you sure you want to ${action} ${productName}?`;

  console.log(`Button clicked to ${action} product: ${productName}, Charge Number: ${chargeNumber}, Current status: ${currentStatus}`);

  if (!confirm(confirmationMessage)) {
    console.log(`User cancelled the ${action} action.`);
    return;
  }

  console.log(`Proceeding to ${action} charge: ${chargeNumber}`);

  // Retrieve orgNo and hubspotId from the DOM elements
  const orgNo = document.getElementById('org-number').textContent.trim();
  const hubspotId = document.getElementById('hubspot-id').textContent.trim();

  // Attempt to refresh Younium data before proceeding
  try {
    youniumData = await fetchYouniumData(orgNo, hubspotId);
    if (!youniumData || youniumData.name === 'Invalid hubspot or orgnummer') {
      throw new Error('Failed to fetch updated Younium data');
    }
  } catch (error) {
    console.error('Error refreshing Younium data:', error);
    alert('Failed to refresh Younium data. Please try again.');
    return;
  }

  // Re-validate the charge exists in the refreshed data
  const product = youniumData.products.find(p => p.charges.some(c => c.chargeNumber === chargeNumber));
  if (!product) {
    console.error(`Error: No product found for Charge Number: ${chargeNumber} in refreshed data`);
    alert(`Error: No product found for Charge Number: ${chargeNumber} in refreshed data`);
    return;
  }

  // Prepare the request body with refreshed data
  const requestBody = {
    chargeNumber,
    orderId: youniumData.id,
    accountId: youniumData.account.accountNumber,
    invoiceAccountId: youniumData.invoiceAccount.accountNumber,
    productId: product.productNumber,
    chargePlanId: product.chargePlanNumber,
    ready4invoicing: currentStatus ? "0" : "1"
  };

  console.log('Request body being sent to /toggle-invoicing-status:', requestBody);

  // Implement retry logic with initial delay
  const maxRetries = 3;
  const initialDelay = 200; // 3 seconds initial delay
  const retryDelay = 1000; // 2 seconds between retries

  console.log(`Waiting ${initialDelay / 1000} seconds before first attempt...`);
  await new Promise(resolve => setTimeout(resolve, initialDelay));

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to update charge status (Attempt ${attempt} of ${maxRetries})...`);
      const response = await fetch('/toggle-invoicing-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Received response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response text:', errorText);
        
        if (response.status === 400 && errorText.includes('No latest version of subscription')) {
          if (attempt < maxRetries) {
            console.log(`Retrying in ${retryDelay}ms... (Attempt ${attempt + 1} of ${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }
        
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`Successfully updated Charge ${chargeNumber} status to ${requestBody.ready4invoicing === "1" ? 'Ready' : 'Not Ready'} for invoicing`);
        // Refresh the UI with updated data
        fetchLatestYouniumData(3, 2000, orgNo, hubspotId);
      } else {
        console.error('Failed to update the charge status:', data.message, data.details);
        alert(`Failed to update status: ${data.message}`);
      }

      return; // Exit the retry loop if successful
    } catch (error) {
      console.error(`Error updating the charge status (Attempt ${attempt}):`, error);
      if (attempt === maxRetries) {
        alert(`Error updating status: ${error.message}`);
      }
    }
  }
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
        const buttonText = isActivated ? 'Unready' : 'Ready';

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

// Function to fetch and update badge data
function fetchAndUpdateBadge(t) {
  // Fetch data asynchronously
  t.card('all')
    .then(function(card) {
      const orgNo = getCustomFieldValue(card.customFieldItems, '66deaa1c355f14009a688b5d');
      const hubspotId = getCustomFieldValue(card.customFieldItems, '66e2a183ccc0da772098ab1e');

      return fetchYouniumData(orgNo, hubspotId)
        .then(function(youniumData) {
          let badgeData;
          if (!youniumData || youniumData.name === 'Invalid hubspot or orgnummer') {
            badgeData = {
              text: 'Invalid ID',
              color: 'red',
              icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
              callback: onBtnClick
            };
          } else {
            const status = getActivationStatus(youniumData);
            badgeData = {
              text: status.text,
              color: status.color,
              icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
              callback: onBtnClick
            };
          }

          // Update the badge by notifying Trello to re-run the capability handler
          t.set('card', 'private', 'badgeData', badgeData).then(function() {
            t.notifyParent('card-detail-badges');
          });
        })
        .catch(function(err) {
          console.error('Error fetching Younium data:', err);
          const badgeData = {
            text: 'Error loading status',
            color: 'red',
            icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
            callback: onBtnClick
          };
          t.set('card', 'private', 'badgeData', badgeData).then(function() {
            t.notifyParent('card-detail-badges');
          });
        });
    });
}

TrelloPowerUp.initialize({
  'card-detail-badges': function(t, options) {
    return t.get('card', 'private', 'badgeData').then(function(badgeData) {
      if (badgeData && badgeData.text) {
        // Return the updated badge data and remove it to fetch fresh data next time
        return t.remove('card', 'private', 'badgeData').then(function() {
          return [badgeData];
        });
      } else {
        // Start fetching data asynchronously
        fetchAndUpdateBadge(t);
        // Return placeholder badge immediately
        return [{
          text: 'Loading...',
          color: 'blue',
          icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
          refresh: 10 // Optional
        }];
      }
    });
  }
});
