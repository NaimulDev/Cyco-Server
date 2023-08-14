const express = require('express');
const app = express();
const port = 8080;

app.get('/', (req, res) => {
  res.send('cyco-engine');
});

app.listen(port, () => {
  console.log(`CYCO engine running on port ${port}`);
});
