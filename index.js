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
  const BOARD_ID = '66cef36d9acf9961edb72775';
  const CALLBACK_URL = 'https://activateitems-d22e28f2e719.herokuapp.com/trello-webhook';

  try {
    const { data: webhooks } = await axios.get(`https://api.trello.com/1/tokens/${TRELLO_TOKEN}/webhooks`, {
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
      // Find the order with isLastVersion true
      const youniumOrder = response.data.find(order => order.isLastVersion === true);
      
      if (!youniumOrder) {
        console.log('No latest version found for the provided OrgNo and HubspotDealId.');
        return null;
      }

      console.log(`Processing Younium order with ID: ${youniumOrder.id}, Version: ${youniumOrder.version}`);

      // Processing the order
      return {
        id: youniumOrder.id, // OrderId
        status: youniumOrder.status,
        description: youniumOrder.description,
        account: {
          accountNumber: youniumOrder.account.accountNumber, // AccountId
          name: youniumOrder.account.name,
        },
        invoiceAccount: {
          accountNumber: youniumOrder.invoiceAccount.accountNumber, // InvoiceAccountId
          name: youniumOrder.invoiceAccount.name,
        },
        products: youniumOrder.products.map(product => ({
          productNumber: product.productNumber, // ProductId
          chargePlanNumber: product.chargePlanNumber, // ChargePlanId
          name: product.name,
          charges: product.charges.map(charge => ({
            id: charge.id, // ChargeId
            name: charge.name,
            effectiveStartDate: charge.effectiveStartDate,
            ready4invoicing: charge.customFields.ready4invoicing === "true" || charge.customFields.ready4invoicing === "1"
          }))
        }))
      };
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

// Function to link duplicate cards based on Submission ID
async function linkDuplicateCards(cardId, boardId, submissionId) {
  try {
    const TRELLO_KEY = process.env.TRELLO_KEY;
    const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

    // Get all cards on the board
    const cardsResponse = await axios.get(`https://api.trello.com/1/boards/${boardId}/cards`, {
      params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
    });

    const cards = cardsResponse.data;

    // Find duplicate cards with the same submission ID in their description
    const duplicateCards = cards.filter(card => card.id !== cardId && card.desc.includes(submissionId));

    for (const duplicateCard of duplicateCards) {
      // Attach each card to the other, if not already attached
      const existingAttachments = await axios.get(`https://api.trello.com/1/cards/${cardId}/attachments`, {
        params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
      });

      const isAlreadyAttached = existingAttachments.data.some(
        attachment => attachment.url === `https://trello.com/c/${duplicateCard.shortLink}`
      );

      if (!isAlreadyAttached) {
        // Attach duplicate card to the current card
        await axios.post(`https://api.trello.com/1/cards/${cardId}/attachments`, null, {
          params: { key: TRELLO_KEY, token: TRELLO_TOKEN, url: `https://trello.com/c/${duplicateCard.shortLink}` },
        });
      }

      // Also attach the current card to the duplicate card, if not already attached
      const existingAttachmentsDuplicate = await axios.get(`https://api.trello.com/1/cards/${duplicateCard.id}/attachments`, {
        params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
      });

      const isAlreadyAttachedDuplicate = existingAttachmentsDuplicate.data.some(
        attachment => attachment.url === `https://trello.com/c/${cardId}`
      );

      if (!isAlreadyAttachedDuplicate) {
        await axios.post(`https://api.trello.com/1/cards/${duplicateCard.id}/attachments`, null, {
          params: { key: TRELLO_KEY, token: TRELLO_TOKEN, url: `https://trello.com/c/${cardId}` },
        });
      }
    }
  } catch (error) {
    console.error('Error linking duplicate cards:', error.message);
  }
}

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

          // Check if the attachment already exists on the card
          const attachmentsResponse = await axios.get(`${cardDetailsUrl}/attachments`, {
            params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
          });

          const attachments = attachmentsResponse.data;
          const fileName = `${cardTitle.replace(/[^a-zA-Z0-9]/g, '_')}_submission.pdf`;

          // If an attachment with the same filename already exists, skip attaching
          const alreadyAttached = attachments.some(attachment => attachment.name === fileName);
          if (!alreadyAttached) {
            // Download and attach the PDF to the card
            const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
            const form = new FormData();
            form.append('file', pdfResponse.data, fileName);

            await axios.post(`https://api.trello.com/1/cards/${cardId}/attachments`, form, {
              params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
              headers: form.getHeaders(),
            });

            console.log(`PDF attached successfully as ${fileName}`);
          }

          // Remove the URL from the card description
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
                    color: 'blue',
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
        }

        // Check if there's a submission ID in the description and link duplicate cards
        const submissionIdMatch = description.match(/sid=(\d+)/);
        if (submissionIdMatch) {
          const submissionId = submissionIdMatch[1];
          await linkDuplicateCards(cardId, action.data.board.id, submissionId);
        }
      }

      return res.status(200).send('Card processed');
    } catch (error) {
      console.error('Error processing card:', error.message);
      return res.status(500).send('Failed to process card');
    }
  } else {
    return res.status(200).send('No relevant action');
  }
});


// Register Trello Webhook on startup
registerTrelloWebhook();

app.post('/toggle-invoicing-status', async (req, res) => {
  console.log('Received request to toggle invoicing status:', req.body);
  const { chargeId, orderId, accountId, invoiceAccountId, productId, chargePlanId, ready4invoicing  } = req.body;

  const activationUrl = `https://cas-test.loveyourq.se/dev/UpdateReady4Invoicing?OrderId=${orderId}&AccountId=${accountId}&InvoiceAccountId=${ready4invoicing}&ProductId=${productId}&ChargePlanId=${chargePlanId}&ChargeId=${chargeId}&LegalEntity=Caspeco%20AB&IsReady4Invoicing=${ready4invoicing}`;

  console.log('Constructed activation URL:', activationUrl);

  try {
    console.log('Sending request to Younium API...');
    const response = await axios.post(activationUrl, null, {
      auth: {
        username: process.env.AUTH_USERNAME,
        password: process.env.AUTH_PASSWORD
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Received response from Younium API:', response.status, response.data);

    if (response.status === 200) {
      res.json({ success: true, message: 'Status updated successfully' });
    } else {
      console.error('Unexpected response status:', response.status);
      res.status(response.status).json({ success: false, message: 'Failed to update status', details: response.data });
    }
  } catch (error) {
    console.error('Error updating the charge status:', error);
    if (error.response) {
      console.error('Error response from Younium API:', error.response.status, error.response.data);
      res.status(error.response.status).json({ 
        success: false, 
        message: 'Error from Younium API', 
        details: error.response.data 
      });
    } else if (error.request) {
      console.error('No response received from Younium API');
      res.status(500).json({ 
        success: false, 
        message: 'No response from Younium API', 
        details: 'The request was made but no response was received' 
      });
    } else {
      console.error('Error setting up the request:', error.message);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error', 
        details: error.message 
      });
    }
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