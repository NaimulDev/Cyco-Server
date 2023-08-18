const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 8080;
const jwt = require("jsonwebtoken");
const app = express();
const cors = require('cors');

// middileWare
app.use(cors());
app.use(express.json());

// Database Functionalities -

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jvqibpv.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    const MoviesCollection = client.db('Cyco').collection('MoviesCollection');
    const SeriesCollection = client.db('Cyco').collection('SeriesCollection');
    const UserCollection = client.db('Cyco').collection('UserCollection');


    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "24h",
      });
      res.send({ token });
    });



    // Movies Api
    app.get('/movies', verifyJWT, async (req, res) => {
      try {
        const result = await MoviesCollection.find().toArray();
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    // Series APi 
    app.get('/series', verifyJWT, async(req,res)=>{
      try {
        const result = await SeriesCollection.find().toArray();
        res.status(200).json(result);
      }
      catch (error) {
        res.status(500).json( { error: 'Internal Server Error'})
      }
    });

  
   

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('Hey Dev! No pain No gain.. Successfully Connected MongoDb');
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('cyco-engine.. to check MongoDb Database you can search /test');
});

app.listen(port, () => {
  console.log(`CYCO engine running on port ${port}`);
});
