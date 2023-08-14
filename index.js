const express = require('express');
const app = express();
const port = process.env.PORT || 8080;
const jwt = require('jsonwebtoken');

// Database Functionalities -
async function run() {}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('cyco-engine');
});

app.listen(port, () => {
  console.log(`CYCO engine running on port ${port}`);
});
