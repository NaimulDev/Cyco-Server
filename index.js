const express = require('express');
require('dotenv').config();
const port = process.env.PORT || 8080;

const app = express();
const cors = require('cors')

// middileWare
app.use(cors);
app.use(express.json());

// Database Functionalities -
async function run() {}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('cyco-engine');
});

app.listen(port, () => {
  console.log(`CYCO engine running on port ${port}`);
});
