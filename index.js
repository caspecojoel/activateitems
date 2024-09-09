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

function generateProductListHtml(selectedLabels) {
  return selectedLabels.map(label => `<li><strong>${label}</strong></li>`).join('');
}

async function getYouniumOrderData(orgNo, hubspotDealId) {
  try {
    console.log(`Fetching Younium data for OrgNo: ${orgNo}, HubspotDealId: ${hubspotDealId}`);

    // Axios request with Basic Auth
    const response = await axios.get(`https://cas-test.loveyourq.se/dev/GetYouniumOrders`, {
      params: {
        OrgNo: orgNo,
        HubspotDealId: hubspotDealId
      },
      auth: {
        username: process.env.AUTH_USERNAME,  // Use Heroku config var
        password: process.env.AUTH_PASSWORD   // Use Heroku config var
      }
    });

    console.log('Younium API Response:', JSON.stringify(response.data, null, 2));
    if (response.data && response.data.length > 0) {
      const account = response.data[0].account;
      return {
        name: account.name,
        accountNumber: account.accountNumber
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
    const youniumData = await getYouniumOrderData(orgNo, hubspotId);
    res.json(youniumData || { name: null, accountNumber: null });
  } catch (error) {
    console.error('Error in /get-younium-data:', error);
    res.status(500).json({ error: 'Failed to fetch Younium data' });
  }
});

app.post('/submit-form', async (req, res) => {
  const { hubspotId, selectedLabels, userName, cardTitle, orgNo, accountName, accountNumber } = req.body;

  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'caspeco.oncall@gmail.com',
      pass: 'ddpqsicrbtrlmpap'
    }
  });

  let mailOptions = {
    from: '"Operations - Leverans " <caspeco.oncall@gmail.com>',
    to: 'joel.ekberg@caspeco.se',
    subject: `Aktivering av produkter: ${cardTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #f4f4f4; padding: 20px;">
        <div style="background-color: #ffffff; padding: 20px; border-radius: 10px; max-width: 600px; margin: 0 auto; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
          <h1 style="color: #1a73e8;">Aktivering av Produkter</h1>
          <p>Hej!</p>
          <p>Vi på operations har nu aktiverat följande produkt(er) för kortet: <strong>${cardTitle}</strong>.</p>
          <ul style="margin: 20px 0; padding-left: 20px; list-style-type: disc;">
            ${generateProductListHtml(selectedLabels)}
          </ul>
          <p>Formuläret skickades av: <strong>${userName}</strong>.</p>
          <p>Younium Order Information:</p>
          <ul>
            <li>Name: ${accountName}</li>
            <li>Account Number: ${accountNumber}</li>
          </ul>
          <p>Tveka inte att kontakta oss om du har några frågor eller behöver ytterligare hjälp.</p>
          <div style="margin-top: 30px; font-size: 14px; color: #777;">
            <p>Med vänliga hälsningar,<br>Operations Teamet</p>
          </div>
        </div>
      </div>
    `
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      return res.json({ success: false, message: 'Error sending email' });
    }
    console.log('Message sent: %s', info.messageId);
    res.json({ success: true, message: 'Email sent successfully' });
  });
});

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