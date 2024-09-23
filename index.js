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

app.post('/trello-webhook', async (req, res) => {
  const { action } = req.body;

  console.log('Webhook received:', action);  // Log the entire action received

  if (action && action.type === 'createCard') {
    const cardId = action.data.card.id;
    console.log('Processing card creation:', cardId);  // Log the card ID

    try {
      const TRELLO_KEY = process.env.TRELLO_KEY;
      const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
      const cardDetailsUrl = `https://api.trello.com/1/cards/${cardId}`;

      // Fetch the card details from Trello to get the description and title (name)
      console.log('Fetching card details...');
      const cardResponse = await axios.get(cardDetailsUrl, {
        params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
      });

      const card = cardResponse.data;
      const description = card.desc;
      const cardTitle = card.name;

      console.log('Card details fetched:', { cardTitle, description });  // Log the card details

      let updatedDescription = description; // This will be used to update the card description later

      // 1. Check for the PDF URL in the description (unchanged)
      const urlMatch = description.match(/(https:\/\/eu\.jotform\.com\/server\.php\?action=getSubmissionPDF&[^\s]+)/);
      if (urlMatch) {
        const pdfUrl = urlMatch[1];
        console.log('PDF URL found:', pdfUrl);
        // ... (remaining PDF logic)
      }

      // 2. Extract product names from the description (comma-separated values)
      const products = description.split(',').map(product => product.trim());
      console.log('Extracted products:', products);  // Log the extracted product names

      // 3. Get all labels on the board to check against the product names
      const boardId = action.data.board.id;
      const boardLabelsUrl = `https://api.trello.com/1/boards/${boardId}/labels`;

      console.log('Fetching board labels...');
      const boardLabelsResponse = await axios.get(boardLabelsUrl, {
        params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
      });

      const boardLabels = boardLabelsResponse.data;
      console.log('Board labels:', boardLabels);  // Log the labels available on the board

      // 4. Check for matching labels in the board
      const matchingLabels = boardLabels.filter(label => 
        products.includes(label.name)
      );

      console.log('Matching labels found:', matchingLabels);  // Log the matching labels

      if (matchingLabels.length > 0) {
        for (const label of matchingLabels) {
          try {
            console.log(`Adding label: ${label.name} to card`);
            await axios.post(`https://api.trello.com/1/cards/${cardId}/idLabels`, null, {
              params: {
                key: TRELLO_KEY,
                token: TRELLO_TOKEN,
                value: label.id,  // Use the label ID to add the label
              },
            });
            console.log(`Label ${label.name} added successfully`);
          } catch (error) {
            console.error(`Error adding label ${label.name}:`, error.message);
          }
        }

        // Remove product names from the description
        products.forEach(product => {
          updatedDescription = updatedDescription.replace(new RegExp(product, 'gi'), '').trim();
        });
        console.log('Product names removed from description.');
      } else {
        console.log('No matching labels found for products.');
      }

      // Update the card description if changes were made
      if (updatedDescription !== description) {
        console.log('Updating card description...');
        await axios.put(cardDetailsUrl, { desc: updatedDescription }, {
          params: { key: TRELLO_KEY, token: TRELLO_TOKEN },
        });
        console.log('Card description updated successfully');
      } else {
        console.log('No changes made to the description.');
      }

      return res.status(200).send('PDF and product labels processed successfully');
    } catch (error) {
      console.error('Error fetching card details:', error.message);
      return res.status(500).send('Failed to fetch card details');
    }
  } else {
    console.log('No relevant action.');
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
