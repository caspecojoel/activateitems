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
  return new Promise((resolve, reject) => {
    let lastData = null;

    // Show spinner
    const loadingSpinner = document.getElementById('loading-spinner');
    loadingSpinner.style.display = 'block';

    // Disable all buttons while fetching
    const allButtons = document.querySelectorAll('.activate-button, .inactivate-button');
    allButtons.forEach(btn => {
      btn.disabled = true;
      btn.classList.add('greyed-out');
    });

    const tryFetch = (attemptNumber) => {
      fetchYouniumData(orgNo, hubspotId)
        .then(updatedYouniumData => {
          console.log(`Attempt ${attemptNumber}: Updated Younium data received:`, updatedYouniumData);

          if (!updatedYouniumData || updatedYouniumData.name === 'Invalid hubspot or orgnummer') {
            console.error('Failed to fetch valid updated Younium data:', updatedYouniumData);
            alert('Failed to fetch valid updated data. Please verify Hubspot ID and Organization Number.');
            hideLoadingSpinner(); // Hide spinner on error
            allButtons.forEach(btn => {
              btn.disabled = false;
              btn.classList.remove('greyed-out');
            });
            reject(new Error('Failed to fetch valid updated Younium data'));
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
              hideLoadingSpinner(); // Hide spinner after final data fetch
              allButtons.forEach(btn => {
                btn.disabled = false;
                btn.classList.remove('greyed-out');
              });
              resolve();
            }
          } else {
            console.log('Latest data version confirmed or no changes detected.');
            updateModalWithYouniumData(updatedYouniumData);
            hideLoadingSpinner(); // Hide spinner after data is updated
            allButtons.forEach(btn => {
              btn.disabled = false;
              btn.classList.remove('greyed-out');
            });
            resolve();
          }
        })
        .catch(fetchError => {
          console.error('Error fetching updated Younium data:', fetchError);
          hideLoadingSpinner(); // Hide spinner on error
          alert('An error occurred while fetching data.');
          allButtons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('greyed-out');
          });
          reject(fetchError);
        });
    };

    tryFetch(1); // Start the first attempt
  });
};

// Helper to hide the loading spinner
const hideLoadingSpinner = () => {
  const loadingSpinner = document.getElementById('loading-spinner');
  loadingSpinner.style.display = 'none';
};

// Helper function to compare two Younium data objects
const isDataEqual = (data1, data2) => {
  // Implement a deep comparison of relevant fields
  // Return true if the data is effectively the same, false otherwise
  // This is a simplified example, you'll need to adjust based on your data structure
  return JSON.stringify(data1) === JSON.stringify(data2);
};

// Function to handle the toggle button click
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
    button.disabled = true; // Disable the clicked button
    button.innerHTML = '<span class="spinner"></span>  Wait...';
  }

  // Disable all other buttons while processing
  const allButtons = document.querySelectorAll('.activate-button, .inactivate-button');
  allButtons.forEach(btn => {
    btn.disabled = true;
    btn.classList.add('greyed-out');
  });

  try {
    // Fetch the latest Younium data before proceeding
    youniumData = await fetchYouniumData(orgNo, hubspotId);
    if (!youniumData || youniumData.name === 'Invalid hubspot or orgnummer') {
      throw new Error('Failed to fetch updated Younium data');
    }
    console.log('Fetched updated Younium data:', youniumData);

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
      throw new Error(`No product or charge found for Charge ID: ${chargeId}`);
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

    // Retry logic with exponential backoff
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    let attempt = 1;

    while (attempt <= maxRetries) {
      try {
        console.log(`Attempt ${attempt} of ${maxRetries}: Updating charge status...`);
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

          if (response.status === 400 && errorText.includes('No latest version of subscription')) {
            if (attempt < maxRetries) {
              console.log(`Retrying in ${retryDelay}ms... (Attempt ${attempt + 1})`);
              await new Promise(resolve => setTimeout(resolve, retryDelay * attempt)); // Exponential backoff
              attempt++;
              continue;
            }
          }

          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const data = await response.json();

        if (data.success) {
          console.log(`Successfully updated Charge ${chargeId} status to ${requestBody.ready4invoicing === "1" ? 'Ready' : 'Not Ready'} for invoicing`);

          // Update button text and status column immediately
          if (button) {
            button.disabled = true; // Keep it disabled until fetchLatestYouniumData completes
            button.innerHTML = requestBody.ready4invoicing === "1" ? 'Unready' : 'Ready';
            button.classList.toggle('inactivate-button', requestBody.ready4invoicing === "1");
            button.classList.toggle('activate-button', requestBody.ready4invoicing !== "1");

            // Update the status column text
            const statusCell = button.closest('tr').querySelector('td:nth-child(4)'); // Adjust the index if necessary
            if (statusCell) {
              statusCell.textContent = requestBody.ready4invoicing === "1" ? 'Ready for invoicing' : 'Not ready for invoicing';
            }
          }

          // Fetch latest data and wait until it's done before re-enabling buttons
          await fetchLatestYouniumData(3, 1000, orgNo, hubspotId);

          // Now, re-enable all buttons after everything is done
          allButtons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('greyed-out');
          });

          break; // Exit loop after success
        } else {
          console.error('Failed to update the charge status:', data.message, data.details);
          alert(`Failed to update status: ${data.message}`);

          // Re-enable buttons even in case of error
          allButtons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('greyed-out');
          });

          break; // Exit loop on failure
        }
      } catch (error) {
        console.error(`Error updating the charge status on attempt ${attempt}:`, error);
        if (attempt === maxRetries) {
          alert(`Error updating status: ${error.message}`);
          // Re-enable buttons in case of final failure
          allButtons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('greyed-out');
          });
        }
        attempt++;
      }
    }
  } catch (error) {
    console.error('Error during charge status update process:', error);
    alert('An error occurred. Please try again.');

    // Re-enable buttons in case of failure
    allButtons.forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('greyed-out');
    });
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


// Function to fetch Younium data with improved error handling
const fetchYouniumData = (orgNo, hubspotId) => {
  console.log('Fetching Younium data for:', { orgNo, hubspotId });

  if (!orgNo || !hubspotId) {
    console.warn('Invalid HubSpot ID or Organization Number');
    return Promise.resolve({
      name: 'Invalid HubSpot or Organization Number',
      accountNumber: null,
    });
  }

  const controller = new AbortController(); // Create a new controller
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25-second timeout

  return fetch(`/get-younium-data?orgNo=${encodeURIComponent(orgNo)}&hubspotId=${encodeURIComponent(hubspotId)}`, {
    signal: controller.signal // Pass the signal to the fetch request
  })
    .then(response => {
      clearTimeout(timeoutId); // Clear the timeout when the request completes
      if (!response.ok) {
        console.error(`Younium API Error: HTTP ${response.status}, ${response.statusText}`);
        return response.text().then(errorText => {
          throw new Error(`Younium API error: ${errorText}`);
        });
      }
      return response.json();
    })
    .then(data => {
      console.log('Younium API response data:', data);
      return data;
    })
    .catch(err => {
      if (err.name === 'AbortError') {
        console.error('Request timed out after 25 seconds');
        alert('Request timed out. Please try again.');
      } else {
        console.error('Error fetching Younium data:', err);
        alert(`An error occurred while fetching Younium data: ${err.message}`);
      }
      return null;
    });
};

// Function to handle button click with enhanced error alerts and modal display
const onBtnClick = (t, opts) => {
  console.log('Button clicked on card:', opts);

  // Show a loading message using t.alert
  const loadingAlert = t.alert({
    message: 'Loading... Please wait while the invoicing status is being fetched.',
    duration: 30 // Set a long duration, but we'll hide it manually when done
  });

  return t.card('all').then(card => {
    console.log('Card data:', card);

    const hubspotId = getCustomFieldValue(card.customFieldItems, '66e2a183ccc0da772098ab1e');
    const orgNo = getCustomFieldValue(card.customFieldItems, '66deaa1c355f14009a688b5d');
    console.log('HubSpot ID:', hubspotId);
    console.log('Organization Number:', orgNo);

    return t.member('fullName').then(member => {
      const userName = member.fullName;

      // Fetch Younium data and display in the modal
      return fetchYouniumData(orgNo, hubspotId)
        .then(youniumData => {
          if (!youniumData) {
            throw new Error('Failed to fetch Younium data');
          }

          // Construct the Get Orders and UpdateReady4Invoicing URLs as per your logic
          const apiKey = 'YOUR-API-KEY'; 
          const getOrdersUrl = `https://cas-test.loveyourq.se/dev/GetYouniumOrders?OrgNo=${orgNo}&HubspotDealId=${hubspotId}&apikey=${apiKey}`;
          const product = youniumData.products[0]; 
          const charge = product.charges[0]; 

          const activationUrl = `https://cas-test.loveyourq.se/dev/UpdateReady4Invoicing` +
            `?OrderId=${youniumData.id}` +
            `&AccountId=${youniumData.account.accountNumber}` +
            `&InvoiceAccountId=${youniumData.invoiceAccount.accountNumber}` +
            `&ProductId=${product.productNumber}` +
            `&ChargePlanId=${product.chargePlanId}` +
            `&ChargeId=${charge.id}` +
            `&LegalEntity=${encodeURIComponent('Caspeco AB')}` +
            `&IsReady4Invoicing=1` +
            `&apikey=${apiKey}`;

          // Log the URLs for debugging
          console.log('Constructed Get Orders URL:', getOrdersUrl);
          console.log('Constructed Activation URL:', activationUrl);

          // Now we display the URLs in the modal
          const externalUrl = `https://activateitems-d22e28f2e719.herokuapp.com/?youniumData=${encodeURIComponent(JSON.stringify(youniumData))}` +
            `&hubspotId=${hubspotId}&orgNo=${orgNo}&getOrdersUrl=${encodeURIComponent(getOrdersUrl)}&activationUrl=${encodeURIComponent(activationUrl)}`;

          // Close the alert when the modal is ready to open
          t.hideAlert();

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

          // Close the loading alert if there was an error
          t.hideAlert();

          let errorMessage = 'Failed to load Younium data. Please try again later.';

          // Customize the error message based on the error type
          if (err.name === 'AbortError') {
            errorMessage = 'Request timed out. Please check your connection and try again.';
          } else if (err.message.includes('Invalid HubSpot or Organization Number')) {
            errorMessage = 'Invalid HubSpot ID or Organization Number. Please verify the data and try again.';
          } else if (err.message === 'Failed to fetch Younium data') {
            errorMessage = 'Unable to retrieve data. Please ensure Younium is available and try again.';
          }

          return t.alert({
            message: errorMessage,
            duration: 10 // Duration in seconds
          });
        });
    });
  });
};




TrelloPowerUp.initialize({
  'card-detail-badges': (t, options) => {
    return t.card('all').then(card => {
      const labels = card.labels;
      
      // Check if any of the labels is "Offboarding"
      const hasOffboardingLabel = labels.some(label => label.name === "Offboarding");
      
      if (!hasOffboardingLabel) {
        return [{
          text: 'View invoicing status',
          color: 'blue',
          icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
          callback: onBtnClick
        }];
      } else {
        // Do not show the "View invoicing status" button if "Offboarding" is present
        return [];
      }
    });
  }
});