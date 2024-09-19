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
        const urlMatch = description.match(/(https:\/\/eu\.jotform\.com\/server\.php\?action=getSubmissionPDF&[^\s]+)/);
        if (urlMatch) {
          const pdfUrl = urlMatch[1];

          try {
            const attachmentsResponse = await axios.get(`${cardDetailsUrl}/attachments`, {
              params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
            });

            const attachments = attachmentsResponse.data;
            const fileName = `${cardTitle.replace(/[^a-zA-Z0-9]/g, '')}.pdf`;

            const alreadyAttached = attachments.some(attachment => attachment.name === fileName);
            if (alreadyAttached) {
              return res.status(200).send('PDF already attached');
            }

            const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
            const trelloAttachmentUrl = `https://api.trello.com/1/cards/${cardId}/attachments`;
            const form = new FormData();
            form.append('file', pdfResponse.data, fileName);

            await axios.post(trelloAttachmentUrl, form, {
              params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
              headers: form.getHeaders(),
            });

            console.log(`PDF attached successfully as ${fileName}`);

            const updatedDescription = description.replace(urlMatch[0], '').trim();
            await axios.put(cardDetailsUrl, { desc: updatedDescription }, {
              params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
            });

            return res.status(200).send('PDF attached and card description updated');
          } catch (error) {
            console.error('Error attaching PDF to Trello card:', error.message);
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
