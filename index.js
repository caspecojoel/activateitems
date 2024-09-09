const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const nodemailer = require('nodemailer');
const axios = require('axios');
const app = express();

app.use(morgan('combined'));
app.use(express.static('public'));
app.use(express.json());
app.use(cors({ origin: 'https://trello.com' }));

app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/client.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.js'));
});

async function getYouniumOrderData(orgNo, hubspotDealId) {
  try {
    const response = await axios.get(`https://cas-test.loveyourq.se/dev/GetYouniumOrders`, {
      params: { OrgNo: orgNo, HubspotDealId: hubspotDealId },
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
        effectiveStartDate: youniumOrder.effectiveStartDate,
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

app.get('/get-younium-data', async (req, res) => {
  const { orgNo, hubspotId } = req.query;
  try {
    const youniumData = await getYouniumOrderData(orgNo, hubspotId);
    res.json(youniumData || { name: null, accountNumber: null });
  } catch (error) {
    console.error('Error in /get-younium-data:', error);
    res.status(500).json({ error: 'Failed to fetch Younium data' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
