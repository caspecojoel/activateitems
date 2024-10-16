const getCustomFieldValue = (fields, fieldId) => {
  const field = fields.find(f => f.idCustomField === fieldId);
  if (!field) {
    console.log(`Custom field with ID ${fieldId} not found in fields:`, fields);
    return ''; // Return an empty string instead of undefined for consistency
  }
  return field?.value?.text || field?.value?.number || '';
};

// Function to get operation status
const getOperationStatus = (youniumData) => {
  console.log('getOperationStatus received:', youniumData);
  if (!youniumData) {
    console.log('youniumData is null or undefined');
    return { status: 'error', text: 'No data available' };
  }
  if (!youniumData.products || !Array.isArray(youniumData.products)) {
    console.log('youniumData.products is undefined or not an array');
    return { status: 'error', text: 'No products data available' };
  }

  let totalCharges = 0;
  let chargesWithStatus = 0;

  youniumData.products.forEach(product => {
    if (product.charges && Array.isArray(product.charges)) {
      totalCharges += product.charges.length;
      chargesWithStatus += product.charges.filter(charge => 
        charge.customFields.operationStatus && charge.customFields.operationStatus !== 'Not set'
      ).length;
    }
  });

  console.log('Total charges:', totalCharges);
  console.log('Charges with operation status:', chargesWithStatus);

  if (totalCharges === 0) {
    return { status: 'none', text: 'No charges found', color: 'yellow' };
  } else if (chargesWithStatus === totalCharges) {
    return { status: 'all', text: 'All products have status', color: 'green' };
  } else if (chargesWithStatus > 0) {
    return { status: 'partial', text: `${chargesWithStatus}/${totalCharges} products have status`, color: 'lime' };
  } else {
    return { status: 'none', text: 'No products have status', color: 'red' };
  }
};

// Fetch updated Younium data with retries and delay
const fetchLatestYouniumData = (retries, delay, orgNo, hubspotId) => {
  return new Promise((resolve, reject) => {
    let lastData = null;

    // Show spinner
    const loadingSpinner = document.getElementById('loading-spinner');
    loadingSpinner.style.display = 'block';

    const tryFetch = (attemptNumber) => {
      fetchYouniumData(orgNo, hubspotId)
        .then(updatedYouniumData => {
          console.log(`Attempt ${attemptNumber}: Updated Younium data received:`, updatedYouniumData);

          if (!updatedYouniumData || updatedYouniumData.name === 'Invalid hubspot or orgnummer') {
            console.error('Failed to fetch valid updated Younium data:', updatedYouniumData);
            alert('Failed to fetch valid updated data. Please verify Hubspot ID and Organization Number.');
            hideLoadingSpinner();
            reject(new Error('Failed to fetch valid updated Younium data'));
            return;
          }

          // Update modal and resolve
          updateModalWithYouniumData(updatedYouniumData);
          hideLoadingSpinner();
          resolve();
        })
        .catch(fetchError => {
          console.error('Error fetching updated Younium data:', fetchError);
          hideLoadingSpinner();
          alert('An error occurred while fetching data.');
          reject(fetchError);
        });
    };

    tryFetch(1);
  });
};

const handleOperationStatusChange = async (chargeId, newStatus) => {
  const orgNo = document.getElementById('org-number').textContent.trim();
  const hubspotId = document.getElementById('hubspot-id').textContent.trim();

  // Fetch selected product and charge details from the UI or stored youniumData
  const selectedCharge = youniumData.products.flatMap(product => product.charges).find(charge => charge.id === chargeId);
  const selectedProduct = youniumData.products.find(product => product.charges.some(charge => charge.id === chargeId));

  if (!selectedCharge || !selectedProduct) {
    console.error('Selected charge or product not found');
    alert('Error: Unable to find the selected product or charge.');
    return;
  }

  // Convert the date to UTC and format it as YYYY-MM-DDTHH:mm:ss
  const effectiveChangeDate = selectedCharge.effectiveStartDate
    ? new Date(selectedCharge.effectiveStartDate).toISOString().split('.')[0]
    : 'undefined';

  console.log(`Effective Change Date to be sent: ${effectiveChangeDate}`);

  // Prepare the request body with internal IDs (GUIDs)
  const requestBody = {
    chargeId: selectedCharge.id,
    orderId: youniumData.id,
    accountId: youniumData.account.accountNumber,
    invoiceAccountId: youniumData.invoiceAccount.accountNumber,
    productId: selectedProduct.productNumber,
    chargePlanId: selectedProduct.chargePlanId,
    operationStatus: newStatus,
    legalEntity: youniumData.legalEntity,
    effectiveChangeDate: effectiveChangeDate,
    productLineNumber: selectedProduct.productLineNumber
  };

  console.log('Request body for operation status change:', requestBody);

  try {
    const response = await fetch('/toggle-operation-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.success) {
      console.log(`Successfully updated operation status for charge ${chargeId} to "${newStatus}"`);
    } else {
      console.error('Failed to update the operation status:', data.message);
      alert(`Failed to update operation status: ${data.message}`);
    }
  } catch (error) {
    console.error('Error during operation status update:', error);
    alert('An error occurred. Please try again.');
  }
};

const updateModalWithYouniumData = (youniumData) => {
  console.log('Updating modal with updated Younium data:', youniumData);

  if (!youniumData || !youniumData.account || !youniumData.products) {
    console.error('Invalid Younium data provided to update modal:', youniumData);
    alert('Failed to update the modal. Missing or invalid Younium data.');
    return;
  }

  // Log effectiveStartDate to check if it exists
  youniumData.products.forEach(product => {
    product.charges.forEach(charge => {
      console.log(`Charge ID: ${charge.id}, Effective Start Date: ${charge.effectiveStartDate}`);
    });
  });

  document.getElementById('account-name').textContent = youniumData.account.name || 'N/A';

  const orderStatusElement = document.getElementById('order-status');
  const orderStatus = youniumData.status || 'N/A';
  orderStatusElement.textContent = orderStatus;

  const isDraft = orderStatus.toLowerCase() === 'draft';

  // Apply styling to order status element
  orderStatusElement.classList.toggle('draft', isDraft);

  // Populate the products table
  const productsContainer = document.getElementById('products-container');
  productsContainer.innerHTML = '';

  youniumData.products.forEach(product => {
    if (product.charges && Array.isArray(product.charges)) {
      product.charges.forEach(charge => {
        const operationStatus = charge.customFields.operationStatus || 'Not set';
        const effectiveStartDate = charge.effectiveStartDate ? new Date(charge.effectiveStartDate).toLocaleDateString() : 'N/A';

        // Create a table row for each product and charge
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${product.name || 'N/A'}</td>
          <td>${charge.name || 'N/A'}</td>
          <td>${effectiveStartDate}</td>
          <td class="operation-status-dropdown">
            <select class="operation-status-select" data-charge-id="${charge.id}">
              <option value="Not set" ${operationStatus === 'Not set' ? 'selected' : ''}>Not set</option>
              <option value="Pending implementation" ${operationStatus === 'Pending implementation' ? 'selected' : ''}>Pending implementation</option>
              <option value="Implementation done" ${operationStatus === 'Implementation done' ? 'selected' : ''}>Implementation done</option>
            </select>
          </td>
        `;
        productsContainer.appendChild(row);
      });
    } else {
      console.error('Invalid charges data for product:', product);
    }
  });

  // Disable all buttons if the order is in draft status
  const allDropdowns = document.querySelectorAll('.operation-status-select');
  allDropdowns.forEach(dropdown => {
    if (isDraft) {
      dropdown.disabled = true;
      dropdown.classList.add('greyed-out');
    } else {
      dropdown.disabled = false;
      dropdown.classList.remove('greyed-out');

      // Add event listener for dropdown changes
      dropdown.addEventListener('change', (event) => {
        const chargeId = event.target.getAttribute('data-charge-id');
        const newStatus = event.target.value;
        handleOperationStatusChange(chargeId, newStatus);
      });
    }
  });
};

// Function to fetch Younium data with detailed error handling and clear explanations
const fetchYouniumData = (orgNo, hubspotId, t) => {
  console.log('Fetching Younium data for:', { orgNo, hubspotId });

  // Validate OrgNo and HubspotId
  if (!orgNo || !hubspotId) {
    const msg = 'Invalid HubSpot ID or Organization Number. Please verify your input.';
    console.warn(msg);
    return t.alert({
      message: msg,
      duration: 10
    });
  }

  // Construct API URL
  const url = `/get-younium-data?orgNo=${encodeURIComponent(orgNo)}&hubspotId=${encodeURIComponent(hubspotId)}`;
  console.log('Constructed URL:', url);

  // Set up abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60-second timeout

  return fetch(url, { signal: controller.signal })
    .then(response => {
      clearTimeout(timeoutId); // Clear the timeout once the response is received
      console.log(`Response Status: ${response.status}, ${response.statusText}`);
      
      if (!response.ok) {
        return response.text().then(errorText => {
          const errorMsg = `Younium API Error: ${response.statusText}`;
          console.error(errorMsg, errorText);

          if (response.status === 404) {
            throw new Error(`No data found for OrgNo: ${orgNo}, HubSpot ID: ${hubspotId}.`);
          }
          if (response.status === 503) {
            throw new Error('The Younium service is currently unavailable. Please try again later.');
          }
          throw new Error(errorText || 'An unknown error occurred.');
        });
      }
      return response.json();
    })
    .then(data => {
      console.log('Younium API response data:', JSON.stringify(data, null, 2));
      return data; // Return data for further processing
    })
    .catch(err => {
      console.error('Error fetching Younium data:', err.message);
      return t.alert({
        message: err.message.length > 140 ? `${err.message.slice(0, 137)}...` : err.message,
        duration: 10
      });
    });
};

// Function to handle button click with t.alert for error handling and detailed logging
const onBtnClick = (t, opts) => {
  console.log('Button clicked on card:', JSON.stringify(opts, null, 2)); // Log structured opts data

  // Show a loading message using t.alert
  const loadingAlert = t.alert({
    message: 'Loading... Please wait while the operation status is being fetched.',
    duration: 30 // Set a long duration, but we'll hide it manually when done
  });

  return t.card('all').then(card => {
    const hubspotId = getCustomFieldValue(card.customFieldItems, '66e2a183ccc0da772098ab1e');
    const orgNo = getCustomFieldValue(card.customFieldItems, '66deaa1c355f14009a688b5d');

    // Check if HubSpot ID and Org Number are valid before proceeding
    if (!hubspotId || !orgNo) {
      console.error('Missing HubSpot ID or Organization Number.');
      return t.alert({
        message: 'HubSpot ID or Organization Number is missing.',
        duration: 10
      });
    }

    console.log('HubSpot ID:', hubspotId);
    console.log('Organization Number:', orgNo);

    return t.member('fullName').then(member => {
      const userName = member.fullName;

      // Fetch Younium data and display in the modal
      return fetchYouniumData(orgNo, hubspotId, t)
        .then(youniumData => {
          if (!youniumData) {
            throw new Error('Failed to fetch Younium data');
          }

          // Fetch the selected operation status from the dropdown in the modal
          const selectedOperationStatuses = Array.from(document.querySelectorAll('.operation-status-select')).map(select => ({
            chargeId: select.getAttribute('data-charge-id'),
            operationStatus: select.value
          }));

          console.log('Selected Operation Statuses:', selectedOperationStatuses);

          // Construct the Get Orders and UpdateReady4Invoicing URLs
          const apiKey = 'YOUR-API-KEY';
          const getOrdersUrl = `https://cas-test.loveyourq.se/dev/GetYouniumOrders?OrgNo=${orgNo}&HubspotDealId=${hubspotId}&apikey=${apiKey}`;
          const product = youniumData.products[0];
          const charge = product.charges[0];

          // Find the operation status for the current charge
          const selectedStatus = selectedOperationStatuses.find(status => status.chargeId === charge.id)?.operationStatus || 'Not set';

          const activationUrl = `https://cas-test.loveyourq.se/dev/UpdateReady4Invoicing` +
            `?OrderId=${youniumData.id}` +
            `&AccountId=${youniumData.account.accountNumber}` +
            `&InvoiceAccountId=${youniumData.invoiceAccount.accountNumber}` +
            `&ProductId=${product.productNumber}` +
            `&ChargePlanId=${product.chargePlanId}` +
            `&ChargeId=${charge.id}` +
            `&ProductLineNumber=${product.productLineNumber || 'N/A'}` +
            `&EffectiveChangeDate=${encodeURIComponent(charge.effectiveStartDate || 'N/A')}` +
            `&LegalEntity=${encodeURIComponent('Caspeco AB')}` +
            `&operationStatus=${encodeURIComponent(selectedStatus)}` +
            `&apikey=${apiKey}`;

          // Log the constructed URLs for debugging
          console.log('Constructed Get Orders URL:', getOrdersUrl);
          console.log('Constructed Activation URL:', activationUrl);

          // Now we display the URLs in the modal
          const externalUrl = `https://activateitems-d22e28f2e719.herokuapp.com/?youniumData=${encodeURIComponent(JSON.stringify(youniumData))}` +
            `&hubspotId=${hubspotId}&orgNo=${orgNo}&getOrdersUrl=${encodeURIComponent(getOrdersUrl)}&activationUrl=${encodeURIComponent(activationUrl)}`;

          // Log the external URL for debugging
          console.log('Constructed External URL for Modal:', externalUrl);

          // Close the alert when the modal is ready to open
          t.hideAlert();

          return t.modal({
            title: 'Operation Status Details',
            url: externalUrl,
            height: 1000,  // Adjust the height as needed
            width: 1000,   // Adjust the width as needed
            fullscreen: false,
            mouseEvent: opts.mouseEvent
          });

        })
        .catch(err => {
          console.error('Error fetching Younium data or displaying popup:', err.message);

          // Display actual error
          return t.alert({
            message: err.message.length > 140 ? `${err.message.slice(0, 137)}...` : err.message,
            duration: 10
          });
        });
    });
  });
};

TrelloPowerUp.initialize({
  'card-detail-badges': async (t, options) => {
    // Fetch labels on the current card
    const card = await t.card('labels');

    // Check if the card has the labels "Organization group system" or "Brand group system"
    const hasRestrictedLabel = card.labels.some(label =>
      label.name === 'Organization group system' || label.name === 'Brand group system'
    );

    // If the card has any of the restricted labels, don't show the badge
    if (hasRestrictedLabel) {
      return []; // No badges returned if restricted label is present
    }

    // Otherwise, return the "View invoicing status" badge
    return [{
      text: 'View invoicing status',
      color: 'blue',
      icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
      callback: onBtnClick
    }];
  }
});