const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const app = express();

app.use(morgan('combined'));
app.use(express.static('public'));
app.use(cors({ origin: 'https://trello.com' }));

app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/client.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.js'));
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