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
    // Step 1: List existing webhooks
    const { data: webhooks } = await axios.get('https://api.trello.com/1/tokens/' + TRELLO_TOKEN + '/webhooks', {
      params: {
        key: TRELLO_KEY,
        token: TRELLO_TOKEN,
      },
    });

    // Step 2: Check if the webhook already exists
    const existingWebhook = webhooks.find(
      (webhook) => webhook.callbackURL === CALLBACK_URL && webhook.idModel === BOARD_ID
    );

    if (existingWebhook) {
      console.log('Webhook already exists. No need to register.');
      return;
    }

    // Step 3: Register the webhook if it doesn't exist
    console.log('Registering new Trello webhook...');

    const response = await axios.post('https://api.trello.com/1/webhooks', {
      description: 'Webhook for new card creation',
      callbackURL: CALLBACK_URL,
      idModel: BOARD_ID
    }, {
      params: {
        key: TRELLO_KEY,
        token: TRELLO_TOKEN
      }
    });

    console.log('Webhook registered successfully:', response.data);
  } catch (error) {
    console.error('Error registering Trello webhook:');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Function to get Younium order data
async function getYouniumOrderData(orgNo, hubspotDealId) {
  try {
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

    if (response.data && response.data.length > 0) {
      const youniumOrder = response.data[0];

      return {
        id: youniumOrder.id,
        status: youniumOrder.status,
        description: youniumOrder.description,
        account: {
          name: youniumOrder.account.name,
          accountNumber: youniumOrder.account.accountNumber
        },
        products: youniumOrder.products.map(product => ({
          productNumber: product.productNumber,
          name: product.name,
          charges: product.charges.map(charge => ({
            id: charge.id,
            name: charge.name,
            effectiveStartDate: charge.effectiveStartDate,
            isReady4Invoicing: charge.customFields.isReady4Invoicing
          }))
        }))
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching Younium data:', error.response ? error.response.data : error.message);
    return null;
  }
}

// New endpoint to get Younium data
app.get('/get-younium-data', async (req, res) => {
  const { orgNo, hubspotId } = req.query;
  try {
    if (!orgNo || !hubspotId) {
      return res.status(400).json({ error: "Missing required orgNo or hubspotId" });
    }

    const youniumData = await getYouniumOrderData(orgNo, hubspotId);
    if (!youniumData) {
      return res.status(404).json({ error: 'No data found for the provided parameters' });
    }
    res.json(youniumData);
  } catch (error) {
    console.error('Error fetching Younium data:', error.message);
    res.status(500).json({ error: 'Failed to fetch Younium data' });
  }
});

// Trello Webhook endpoint to handle new card creation
app.post('/trello-webhook', async (req, res) => {
  const { action } = req.body;

  console.log('Received Trello Webhook:', action);

  if (action && action.type === 'createCard') {
    const cardId = action.data.card.id;

    console.log(`New card created with ID: ${cardId}`);

    try {
      // Fetch the card details from Trello to ensure we get the description
      const TRELLO_KEY = process.env.TRELLO_KEY;
      const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
      const cardDetailsUrl = `https://api.trello.com/1/cards/${cardId}`;

      const cardResponse = await axios.get(cardDetailsUrl, {
        params: {
          key: TRELLO_KEY,
          token: TRELLO_TOKEN,
        },
      });

      const card = cardResponse.data;
      const description = card.desc;

      if (description) {
        console.log(`Card description: ${description}`);

        // Extract the full PDF URL from the description
        const urlMatch = description.match(/(https:\/\/eu\.jotform\.com\/server\.php\?action=getSubmissionPDF&[^\s]+)/);
        if (urlMatch) {
          const pdfUrl = urlMatch[1];

          console.log(`PDF URL found: ${pdfUrl}`);

          try {
            console.log('Attempting to download the PDF...');
            // Download the PDF
            const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer' });

            console.log('PDF downloaded successfully. Preparing to attach to Trello card...');

            // Attach the PDF to the Trello card
            const trelloAttachmentUrl = `https://api.trello.com/1/cards/${cardId}/attachments`;
            const form = new FormData();
            form.append('file', pdfResponse.data, 'submission.pdf');

            await axios.post(trelloAttachmentUrl, form, {
              params: {
                key: TRELLO_KEY,
                token: TRELLO_TOKEN,
              },
              headers: form.getHeaders(),
            });

            console.log('PDF attached successfully to the card.');
            res.status(200).send('PDF attached successfully');
          } catch (error) {
            console.error('Error attaching PDF to Trello card:', error.message);
            res.status(500).send('Failed to attach PDF');
          }
        } else {
          console.log('No valid PDF URL found in card description.');
          res.status(400).send('No valid PDF URL found in card description');
        }
      } else {
        console.log('Card description is empty or missing.');
        res.status(400).send('Card description is empty or missing');
      }
    } catch (error) {
      console.error('Error fetching card details:', error.message);
      res.status(500).send('Failed to fetch card details');
    }
  } else {
    console.log('No relevant action found in the webhook payload.');
    res.status(200).send('No relevant action');
  }
});


// Register Trello Webhook on startup
registerTrelloWebhook();

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
