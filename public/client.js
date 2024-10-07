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

const handleToggleButtonClick = async (chargeId, currentStatus, productName, youniumData, clickedButton) => {
  const action = currentStatus ? 'inactivate' : 'activate';
  const confirmationMessage = `Are you sure you want to ${action} ${productName}?`;

  if (!confirm(confirmationMessage)) {
    console.log(`User cancelled the ${action} action.`);
    return;
  }

  // Disable all buttons except the one clicked
  const allButtons = document.querySelectorAll('button.activate-button, button.inactivate-button');
  allButtons.forEach(button => {
    if (button !== clickedButton) {
      button.disabled = true;
      button.classList.add('disabled');
    }
  });

  // Update the clicked button's text to "Wait..." and add a spinner
  clickedButton.innerHTML = 'Wait... <span class="spinner"></span>';
  clickedButton.classList.add('processing');

  console.log(`Proceeding to ${action} charge: ${chargeId}`);

  // Retrieve orgNo and hubspotId from the DOM elements
  const orgNo = document.getElementById('org-number')?.textContent.trim();
  const hubspotId = document.getElementById('hubspot-id')?.textContent.trim();

  if (!orgNo || !hubspotId) {
    console.error('Error retrieving orgNo or hubspotId from the DOM.');
    alert('Failed to retrieve necessary data. Please try again.');
    return;
  }

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

  // Find the selected product and charge based on the chargeId
  let selectedProduct = null;
  let selectedCharge = null;

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
    alert(`Error: No product or charge found for Charge ID: ${chargeId}`);
    return;
  }

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

  const maxRetries = 3;
  const initialDelay = 200;
  const retryDelay = 1000;

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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response text:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`Successfully updated Charge ${chargeId} status to ${requestBody.ready4invoicing === "1" ? 'Ready' : 'Not Ready'} for invoicing`);

        // Update button and status immediately after a successful 200 response
        clickedButton.innerHTML = requestBody.ready4invoicing === "1" ? 'Unready' : 'Ready';
        clickedButton.classList.toggle('activate-button');
        clickedButton.classList.toggle('inactivate-button');
        clickedButton.classList.remove('processing');

        // Update the status in the table immediately
        const statusCell = clickedButton.closest('tr').querySelector('td:nth-child(4)');
        if (statusCell) {
          statusCell.textContent = requestBody.ready4invoicing === "1" ? 'Ready for invoicing' : 'Not ready for invoicing';
        }

        // Re-enable all other buttons
        allButtons.forEach(button => {
          if (button !== clickedButton) {
            button.disabled = false;
            button.classList.remove('disabled');
          }
        });

        // Fetch the latest Younium data to ensure consistency
        fetchLatestYouniumData(3, 2000, orgNo, hubspotId);
      } else {
        console.error('Failed to update the charge status:', data.message, data.details);
        alert(`Failed to update status: ${data.message}`);
      }

      return;
    } catch (error) {
      console.error(`Error updating the charge status (Attempt ${attempt}):`, error);
      if (attempt === maxRetries) {
        alert(`Error updating status: ${error.message}`);
      }
    }
  }

  // Re-enable all other buttons if the process fails
  allButtons.forEach(button => {
    button.disabled = false;
    button.classList.remove('disabled');
  });

  // Reset the clicked button if the update fails
  clickedButton.innerHTML = currentStatus ? 'Ready' : 'Unready';
  clickedButton.classList.remove('processing');
  clickedButton.disabled = false;
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

    return t.member('fullName').then(member => {
      const userName = member.fullName;

      // Fetch Younium data and display in the modal
      return fetchYouniumData(orgNo, hubspotId)
        .then(youniumData => {
          if (!youniumData) {
            throw new Error('Failed to fetch Younium data');
          }

          const externalUrl = `https://activateitems-d22e28f2e719.herokuapp.com/?youniumData=${encodeURIComponent(JSON.stringify(youniumData))}&hubspotId=${encodeURIComponent(hubspotId)}&orgNo=${encodeURIComponent(orgNo)}`;

          return t.modal({
            title: 'Ready for Invoicing Details',
            url: externalUrl,
            height: 1000,  // Adjust the height as needed
            width: 1000,   // Adjust the width as needed
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