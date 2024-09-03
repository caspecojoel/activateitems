const express = require('express');
const cors = require('cors');
const app = express();

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(cors({ origin: 'https://trello.com' }));

// Simplified route to serve basic iframe content
app.get('/iframe', (req, res) => {
  res.send('<h1>Form will load here</h1><p>This is a simple placeholder message.</p>');
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
