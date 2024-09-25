const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const app = express();

app.use(express.static('public'));
app.use(express.json());
app.use(cors({ origin: 'https://trello.com' }));

app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/client.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.js'));
});

// Handle HEAD requests for webhook verification
app.head('/trello-webhook', (req, res) => {
  res.sendStatus(200);  // Respond with 200 OK to verify the webhook URL
});

// Function to register Trello Webhook if not already registered
async function registerTrelloWebhook() {
  const TRELLO_KEY = process.env.TRELLO_KEY;
  const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
  const BOARD_ID = '66cef36d9acf9961edb72775';  // Replace with your Trello board ID
  const CALLBACK_URL = 'https://activateitems-d22e28f2e719.herokuapp.com/trello-webhook';  // Replace with your Heroku app URL

  try {
    const { data: webhooks } = await axios.get('https://api.trello.com/1/tokens/' + TRELLO_TOKEN + '/webhooks', {
      params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
    });

    const existingWebhook = webhooks.find(
      (webhook) => webhook.callbackURL === CALLBACK_URL && webhook.idModel === BOARD_ID
    );

    if (existingWebhook) {
      console.log('Webhook already exists. No need to register.');
      return;
    }

    console.log('Registering new Trello webhook...');
    await axios.post('https://api.trello.com/1/webhooks', {
      description: 'Webhook for new card creation',
      callbackURL: CALLBACK_URL,
      idModel: BOARD_ID,
    }, {
      params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
    });

    console.log('Webhook registered successfully.');
  } catch (error) {
    console.error('Error registering Trello webhook:', error.message);
  }
}

// Function to get Younium order data
async function getYouniumOrderData(orgNo, hubspotDealId) {
  try {
    console.log(`Fetching Younium order data for OrgNo: ${orgNo}, HubspotDealId: ${hubspotDealId}`);

    const response = await axios.get(`https://cas-test.loveyourq.se/dev/GetYouniumOrders`, {
      params: {
        OrgNo: orgNo,
        HubspotDealId: hubspotDealId
      },
      auth: {
        username: process.env.AUTH_USERNAME,
        password: process.env.AUTH_PASSWORD
      }
    });

    console.log('Received response from Younium API:', response.data);

    if (response.data && response.data.length > 0) {
      const youniumOrder = response.data[0];
      console.log('Processing Younium order:', youniumOrder);

      const processedOrder = {
        id: youniumOrder.id, // OrderId
        status: youniumOrder.status,
        description: youniumOrder.description,
        account: {
          id: youniumOrder.account.id, // AccountId
          name: youniumOrder.account.name,
          accountNumber: youniumOrder.account.accountNumber
        },
        invoiceAccount: {
          id: youniumOrder.invoiceAccount.id, // InvoiceAccountId
          name: youniumOrder.invoiceAccount.name,
          accountNumber: youniumOrder.invoiceAccount.accountNumber
        },
        products: youniumOrder.products.map(product => ({
          productId: product.productId, // ProductId
          chargePlanId: product.chargePlanId, // ChargePlanId
          name: product.name,
          charges: product.charges.map(charge => ({
            id: charge.id, // ChargeId
            name: charge.name,
            effectiveStartDate: charge.effectiveStartDate,
            isReady4Invoicing: charge.customFields.isReady4Invoicing
          }))
        }))
      };

      console.log('Processed Younium order data:', processedOrder);
      return processedOrder;
    }

    console.log('No Younium data found for the provided OrgNo and HubspotDealId.');
    return null;
  } catch (error) {
    console.error('Error fetching Younium data:', error.response ? error.response.data : error.message);
    return null;
  }
}

// New endpoint to get Younium data
app.get('/get-younium-data', async (req, res) => {
  const { orgNo, hubspotId } = req.query;
  console.log(`Received request for Younium data with OrgNo: ${orgNo}, HubspotId: ${hubspotId}`);

  try {
    if (!orgNo || !hubspotId) {
      console.log('Missing required OrgNo or HubspotId.');
      return res.status(400).json({ error: "Missing required orgNo or hubspotId" });
    }

    const youniumData = await getYouniumOrderData(orgNo, hubspotId);
    if (!youniumData) {
      console.log('No Younium data found for the provided parameters.');
      return res.status(404).json({ error: 'No data found for the provided parameters' });
    }

    console.log('Successfully fetched Younium data:', youniumData);
    res.json(youniumData);
  } catch (error) {
    console.error('Error fetching Younium data:', error.message);
    res.status(500).json({ error: 'Failed to fetch Younium data' });
  }
});


app.post('/trello-webhook', async (req, res) => {
  const { action } = req.body;

  if (action && action.type === 'createCard') {
    const cardId = action.data.card.id;

    try {
      const TRELLO_KEY = process.env.TRELLO_KEY;
      const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
      const cardDetailsUrl = `https://api.trello.com/1/cards/${cardId}`;

      // Fetch the card details from Trello to get the description and title (name)
      const cardResponse = await axios.get(cardDetailsUrl, {
        params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
      });

      const card = cardResponse.data;
      const description = card.desc;
      const cardTitle = card.name;

      if (description) {
        // Extract the PDF URL from the description
        const urlMatch = description.match(/(https:\/\/eu\.jotform\.com\/server\.php\?action=getSubmissionPDF&[^\s]+)/);
        if (urlMatch) {
          const pdfUrl = urlMatch[1];

          try {
            // Check if the attachment already exists on the card
            const attachmentsResponse = await axios.get(`${cardDetailsUrl}/attachments`, {
              params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
            });

            const attachments = attachmentsResponse.data;
            const fileName = `${cardTitle.replace(/[^a-zA-Z0-9]/g, '')}.pdf`;

            // If an attachment with the same filename already exists, skip attaching
            const alreadyAttached = attachments.some(attachment => attachment.name === fileName);
            if (alreadyAttached) {
              console.log(`PDF with filename ${fileName} is already attached. Skipping...`);
              return res.status(200).send('PDF already attached');
            }

            // Download the PDF
            const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer' });

            const trelloAttachmentUrl = `https://api.trello.com/1/cards/${cardId}/attachments`;
            const form = new FormData();
            form.append('file', pdfResponse.data, fileName);

            // Attach the PDF to the card
            const attachResponse = await axios.post(trelloAttachmentUrl, form, {
              params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
              headers: form.getHeaders(),
            });

            console.log(`PDF attached successfully as ${fileName}`, attachResponse.data);

            // Now remove the URL from the card description
            let updatedDescription = description.replace(urlMatch[0], '').trim();
            const productList = updatedDescription.split(',').map(item => item.trim());

            // Attach labels for each product found
            for (const product of productList) {
              try {
                // Fetch all labels on the board
                const labelsResponse = await axios.get(`https://api.trello.com/1/boards/${action.data.board.id}/labels`, {
                  params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
                });
                const labels = labelsResponse.data;

                // Check if the label already exists on the board
                let label = labels.find(l => l.name.toLowerCase() === product.toLowerCase());

                // If label doesn't exist, create a new one
                if (!label) {
                  const createLabelResponse = await axios.post(`https://api.trello.com/1/labels`, null, {
                    params: {
                      key: TRELLO_KEY,
                      token: TRELLO_TOKEN,
                      name: product,
                      idBoard: action.data.board.id,
                      color: 'blue', // you can choose the color here
                    },
                  });
                  label = createLabelResponse.data;
                }

                // Check if the label is already attached to the card
                const cardLabelsResponse = await axios.get(`${cardDetailsUrl}/idLabels`, {
                  params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
                });

                const cardLabels = cardLabelsResponse.data;
                const isLabelAttached = cardLabels.includes(label.id);

                // If the label is not already attached, attach it
                if (!isLabelAttached) {
                  await axios.post(`https://api.trello.com/1/cards/${cardId}/idLabels`, null, {
                    params: {
                      key: TRELLO_KEY,
                      token: TRELLO_TOKEN,
                      value: label.id,
                    },
                  });
                } else {
                  console.log(`Label "${product}" is already attached. Skipping...`);
                }
              } catch (error) {
                console.error(`Error handling label for product "${product}":`, error.message, error.response?.data || '');
              }
            }

            // Clear the card description by setting it to an empty string (or a space if empty string fails)
            console.log('Clearing card description...');
            await axios.put(cardDetailsUrl, { desc: '' }, {
              params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
            });

            console.log('Description cleared successfully.');
            return res.status(200).send('PDF attached, labels added, and card description cleared');
          } catch (error) {
            console.error('Error attaching PDF to Trello card:', error.message, error.response?.data || '');
            return res.status(500).send('Failed to attach PDF');
          }
        } else {
          return res.status(400).send('No valid PDF URL found in description');
        }
      } else {
        return res.status(400).send('Description is empty or missing');
      }
    } catch (error) {
      console.error('Error fetching card details:', error.message);
      return res.status(500).send('Failed to fetch card details');
    }
  } else {
    return res.status(200).send('No relevant action');
  }
});

// Register Trello Webhook on startup
registerTrelloWebhook();

app.post('/toggle-invoicing-status', async (req, res) => {
  const { chargeId, orderId, accountId, invoiceAccountId, productId, chargePlanId, isReadyForInvoicing } = req.body;

  const activationUrl = `https://cas-test.loveyourq.se/dev/UpdateReady4Invoicing?OrderId=${orderId}&AccountId=${accountId}&InvoiceAccountId=${invoiceAccountId}&ProductId=${productId}&ChargePlanId=${chargePlanId}&ChargeId=${chargeId}&LegalEntity=Caspeco%20AB&IsReady4Invoicing=${isReadyForInvoicing}`;

  try {
    const response = await axios.post(activationUrl, null, {
      auth: {
        username: process.env.AUTH_USERNAME,
        password: process.env.AUTH_PASSWORD
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 200) {
      res.json({ success: true, message: 'Status updated successfully' });
    } else {
      res.status(response.status).json({ success: false, message: 'Failed to update status' });
    }
  } catch (error) {
    console.error('Error updating the charge status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Error handling
app.use((req, res, next) => {
  res.status(404).send('404 Not Found');
});

app.use((err, req, res, next) => {
  res.status(500).send('Internal Server Error');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
