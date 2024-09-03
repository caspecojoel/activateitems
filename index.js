const express = require('express');
const cors = require('cors');
const app = express();

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(cors({ origin: 'https://trello.com' }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});