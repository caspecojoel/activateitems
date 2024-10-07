const getCustomFieldValue = (fields, fieldId) => {
  const field = fields.find(f => f.idCustomField === fieldId);
  if (!field) {
    console.log(`Custom field with ID ${fieldId} not found in fields:`, fields);
  }
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

const handleToggleButtonClick = async (chargeId, currentStatus, productName, youniumData) => {
  const action = currentStatus ? 'inactivate' : 'activate';
  const confirmationMessage = `Are you sure you want to ${action} ${productName}?`;

  console.log(`Button clicked to ${action} product: ${productName}, Charge ID: ${chargeId}, Current status: ${currentStatus}`);

  if (!confirm(confirmationMessage)) {
    console.log(`User cancelled the ${action} action.`);
    return;
  }

  console.log(`Proceeding to ${action} charge: ${chargeId}`);

  // Retrieve orgNo and hubspotId from the DOM elements
  const orgNo = document.getElementById('org-number').textContent.trim();
  const hubspotId = document.getElementById('hubspot-id').textContent.trim();
  console.log('Retrieved OrgNo:', orgNo);
  console.log('Retrieved HubspotId:', hubspotId);

  // Find the button element and update it to show "Wait..." with a spinner
  const button = document.querySelector(`button[data-charge-id="${chargeId}"]`);
  if (button) {
    button.disabled = true; // Disable the button to prevent multiple clicks
    button.innerHTML = '<span class="spinner"></span> Wait...';
  }

  // Disable all other buttons while processing
  const allButtons = document.querySelectorAll('.activate-button, .inactivate-button');
  allButtons.forEach(btn => btn.disabled = true);

  // Attempt to refresh Younium data before proceeding
  try {
    youniumData = await fetchYouniumData(orgNo, hubspotId);
    if (!youniumData || youniumData.name === 'Invalid hubspot or orgnummer') {
      throw new Error('Failed to fetch updated Younium data');
    }
    console.log('Fetched updated Younium data:', youniumData);
  } catch (error) {
    console.error('Error refreshing Younium data:', error);
    alert('Failed to refresh Younium data. Please try again.');

    // Restore the original button text
    if (button) {
      button.disabled = false;
      button.innerHTML = currentStatus ? 'Unready' : 'Ready';
    }

    // Enable all buttons after failure
    allButtons.forEach(btn => btn.disabled = false);
    return;
  }

  // Find the selected product and charge based on the chargeId
  let selectedProduct = null;
  let selectedCharge = null;

  console.log('Searching for product and charge with Charge ID:', chargeId);
  for (const product of youniumData.products) {
    const charge = product.charges.find(c => c.id === chargeId);
    if (charge) {
      selectedProduct = product;
      selectedCharge = charge;
      break;
    }
  }

  if (!selectedProduct || !selectedCharge) {
    console.error(`Error: No product or charge found for Charge ID: ${chargeId} in refreshed data`);
    console.log('Younium data products:', youniumData.products);
    alert(`Error: No product or charge found for Charge ID: ${chargeId}`);

    // Restore the original button text
    if (button) {
      button.disabled = false;
      button.innerHTML = currentStatus ? 'Unready' : 'Ready';
    }

    // Enable all buttons after failure
    allButtons.forEach(btn => btn.disabled = false);
    return;
  }

  console.log('Found selected product:', selectedProduct);
  console.log('Found selected charge:', selectedCharge);

  // Prepare the request body with internal IDs (GUIDs)
  const requestBody = {
    chargeId: selectedCharge.id,
    orderId: youniumData.id,
    accountId: youniumData.account.accountNumber,
    invoiceAccountId: youniumData.invoiceAccount.accountNumber,
    productId: selectedProduct.productNumber,
    chargePlanId: selectedProduct.chargePlanId,
    ready4invoicing: currentStatus ? "0" : "1"
  };

  console.log('Request body being sent to /toggle-invoicing-status:', requestBody);
  
  // Retry logic with detailed logs
  const maxRetries = 3;
  const initialDelay = 200;
  const retryDelay = 1000;

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
        console.log(`Successfully updated Charge ${chargeId} status to ${requestBody.ready4invoicing === "1" ? 'Ready' : 'Not Ready'} for invoicing`);

        // Update button text and color instantly
        if (button) {
          button.disabled = false;
          button.innerHTML = requestBody.ready4invoicing === "1" ? 'Unready' : 'Ready';
          button.classList.toggle('inactivate-button', requestBody.ready4invoicing === "1");
          button.classList.toggle('activate-button', requestBody.ready4invoicing !== "1");
        }

        // Enable all buttons after successful update
        allButtons.forEach(btn => btn.disabled = false);

        // Fetch latest data in the background for consistency
        fetchLatestYouniumData(3, 2000, orgNo, hubspotId);
      } else {
        console.error('Failed to update the charge status:', data.message, data.details);
        alert(`Failed to update status: ${data.message}`);

        // Restore the original button text
        if (button) {
          button.disabled = false;
          button.innerHTML = currentStatus ? 'Unready' : 'Ready';
        }

        // Enable all buttons after failure
        allButtons.forEach(btn => btn.disabled = false);
      }

      return;
    } catch (error) {
      console.error(`Error updating the charge status (Attempt ${attempt}):`, error);
      if (attempt === maxRetries) {
        alert(`Error updating status: ${error.message}`);
      }
    }
  }

  // Restore the original button text if all retries fail
  if (button) {
    button.disabled = false;
    button.innerHTML = currentStatus ? 'Unready' : 'Ready';
  }

  // Enable all buttons after all retries fail
  allButtons.forEach(btn => btn.disabled = false);
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
        const isActivated = charge.ready4invoicing === true || charge.ready4invoicing === "1" || charge.ready4invoicing === "true";

        const buttonClass = isActivated ? 'inactivate-button' : 'activate-button';
        const buttonText = isActivated ? 'Unready' : 'Ready';

        // Format the effective start date (if available)
        const effectiveStartDate = charge.effectiveStartDate ? new Date(charge.effectiveStartDate).toLocaleDateString() : 'N/A';

        // Populate the table row
        const row = document.createElement('tr');
        // Inside the charges.forEach loop in updateModalWithYouniumData
        console.log(`Setting button with Charge ID: ${charge.id} and Product Name: ${product.name}`);

        row.innerHTML = `
          <td>${product.name || 'N/A'}</td>
          <td>${charge.name || 'N/A'}</td>
          <td>${effectiveStartDate}</td>
          <td>${isActivated ? 'Ready for invoicing' : 'Not ready for invoicing'}</td>
          <td class="button-container">
            <button class="${buttonClass}" data-charge-id="${charge.id}" data-product-name="${product.name || ''}">
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
    const chargeId = event.target.getAttribute('data-charge-id');
    console.log('Charge ID:', chargeId); // This should now log the correct ID from the button
    const productName = event.target.getAttribute('data-product-name');
    const currentStatus = event.target.textContent.trim() === "Unready"; // Determine current status based on the button text

    console.log('Click event detected:', event);
    console.log('Button element clicked:', event.target);
    console.log('Charge ID:', chargeId);
    console.log('Product Name:', productName);
    console.log('Current Status:', currentStatus);

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

const onBtnClick = (t, opts) => {
  console.log('Button clicked on card:', opts);

  return t.card('all').then(card => {
    console.log('Card data:', card);

    const hubspotId = getCustomFieldValue(card.customFieldItems, '66e2a183ccc0da772098ab1e');
    const orgNo = getCustomFieldValue(card.customFieldItems, '66deaa1c355f14009a688b5d');
    console.log('HubSpot ID:', hubspotId);
    console.log('Org Number:', orgNo);

    // Open the modal immediately with loading state
    const externalUrl = `https://activateitems-d22e28f2e719.herokuapp.com/?loading=true&hubspotId=${encodeURIComponent(hubspotId)}&orgNo=${encodeURIComponent(orgNo)}`;
    t.modal({
      title: 'Ready for Invoicing Details',
      url: externalUrl,
      height: 1000,
      width: 1000,
      fullscreen: false,
      mouseEvent: opts.mouseEvent
    });

    // Continue fetching Younium data in the background
    return fetchYouniumData(orgNo, hubspotId)
      .then(youniumData => {
        if (!youniumData) {
          throw new Error('Failed to fetch Younium data');
        }

        // Send the fetched data to the modal
        t.send({
          message: 'updateModalContent',
          youniumData: youniumData
        });

        console.log('Younium data sent to modal:', youniumData);
      })
      .catch(err => {
        console.error('Error fetching Younium data or displaying popup:', err);
        t.send({
          message: 'updateModalContent',
          error: 'Failed to load Younium data. Please try again later.'
        });
      });
  });
};

// Initialize Trello Power-Up with a static card-detail-badge
TrelloPowerUp.initialize({
  'card-detail-badges': (t, options) => {
    // Return a static badge
    return [{
      text: 'View invoicing status',
      color: 'blue',
      icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
      callback: onBtnClick
    }];
  }
});