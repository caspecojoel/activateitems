const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(cors({ origin: 'https://trello.com' }));

// Serve the manifest.json file
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

// Route to serve the iframe content
app.get('/iframe', (req, res) => {
  res.sendFile(__dirname + '/public/iframe.html');
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
