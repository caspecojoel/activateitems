const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const nodemailer = require('nodemailer');
const app = express();

app.use(morgan('combined'));
app.use(express.static('public'));
app.use(express.json()); // To parse JSON request bodies
app.use(cors({ origin: 'https://trello.com' }));

app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/client.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.js'));
});

// Endpoint to handle form submission
app.post('/submit-form', (req, res) => {
  const { hubspotId, selectedLabels } = req.body;

  // Create a transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'caspeco.oncall@gmail.com', // your email
      pass: 'ddpqsicrbtrlmpap'  // your generated app password
    }
  });

  // Setup email data
  let mailOptions = {
    from: '"Trello Power-Up" <caspeco.oncall@gmail.com>', // sender address
    to: 'joel.ekberg@caspeco.se', // recipient's email
    subject: 'Form Submission from Trello Power-Up', // Subject line
    text: `HubSpot ID: ${hubspotId}\nSelected Labels: ${selectedLabels.join(', ')}`, // plain text body
  };

  // Send mail with defined transport object
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      return res.json({ success: false, message: 'Error sending email' });
    }
    console.log('Message sent: %s', info.messageId);
    res.json({ success: true, message: 'Email sent successfully' });
  });
});

// Handle non-existent routes
app.use((req, res, next) => {
  res.status(404).send('404 Not Found');
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).send('Internal Server Error');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
