const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const nodemailer = require('nodemailer');
const app = express();

app.use(morgan('combined'));
app.use(express.static('public'));
app.use(express.json()); // För att kunna parsa JSON-begäran
app.use(cors({ origin: 'https://trello.com' }));

app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/client.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.js'));
});

// Funktion för att generera HTML-lista av valda produkter
function generateProductListHtml(selectedLabels) {
  return selectedLabels.map(label => `<li>${label}</li>`).join('');
}

// Endpoint för att hantera formulärinlämning
app.post('/submit-form', (req, res) => {
  const { hubspotId, selectedLabels, userName } = req.body;

  // Skapa en transporter-objekt med standard SMTP-transport
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'caspeco.oncall@gmail.com',  // din email
      pass: 'ddpqsicrbtrlmpap'  // din genererade app-lösenord utan mellanslag
    }
  });

  // Skapa innehållet för e-postmeddelandet
  let mailOptions = {
    from: '"Trello Power-Up" <caspeco.oncall@gmail.com>',  // avsändaradress
    to: 'joel.ekberg@caspeco.se',  // mottagarens email
    subject: 'Aktivering av Produkter',  // Ämne för mailet
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; background-color: #f4f4f4; padding: 20px;">
        <div style="background-color: #ffffff; padding: 20px; border-radius: 10px; max-width: 600px; margin: 0 auto; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
          <h1 style="color: #1a73e8;">Aktivering av Produkter</h1>
          <p>Hej!</p>
          <p>Vi på operations har nu aktiverat följande produkt(er):</p>
          <ul style="margin: 20px 0; padding: 0; list-style-type: none;">
            ${generateProductListHtml(selectedLabels)}
          </ul>
          <p>Formuläret skickades av: <strong>${userName}</strong>.</p>
          <p>Tveka inte att kontakta oss om du har några frågor eller behöver ytterligare hjälp.</p>
          <div style="margin-top: 30px; font-size: 14px; color: #777;">
            <p>Med vänliga hälsningar,<br>Operations Teamet</p>
          </div>
        </div>
      </div>
    `
  };

  // Skicka e-post med definierat transportobjekt
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      return res.json({ success: false, message: 'Error sending email' });
    }
    console.log('Message sent: %s', info.messageId);
    res.json({ success: true, message: 'Email sent successfully' });
  });
});

// Hantera icke-existerande routes
app.use((req, res, next) => {
  res.status(404).send('404 Not Found');
});

// Middleware för felhantering
app.use((err, req, res, next) => {
  res.status(500).send('Internal Server Error');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
