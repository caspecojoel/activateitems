const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const app = express();

// Use morgan to log HTTP requests
app.use(morgan('combined'));

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Set up CORS to allow requests from Trello
app.use(cors({ origin: 'https://trello.com' }));

// Add custom logging middleware
app.use((req, res, next) => {
  console.log(`Received request for ${req.url} from ${req.ip}`);
  next();
});

// Serve the manifest.json file
app.get('/manifest.json', (req, res) => {
  console.log('Serving manifest.json');
  res.sendFile(path.join(__dirname, 'manifest.json'), (err) => {
    if (err) {
      console.error('Error serving manifest.json:', err);
    } else {
      console.log('manifest.json served successfully');
    }
  });
});

// Route to serve the iframe content
app.get('/iframe', (req, res) => {
  console.log('Serving iframe content');
  res.sendFile(__dirname + '/public/iframe.html', (err) => {
    if (err) {
      console.error('Error serving iframe.html:', err);
    } else {
      console.log('iframe.html served successfully');
    }
  });
});

// Handle non-existent routes
app.use((req, res, next) => {
  console.warn(`404 error: ${req.originalUrl} not found`);
  res.status(404).send('404 Not Found');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error occurred:', err.stack);
  res.status(500).send('Internal Server Error');
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
