const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 8080;
const jwt = require("jsonwebtoken");
const app = express();
const cors = require("cors");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);


// MIDDLEWARE:
app.use(cors());
app.use(express.json());

// JWT:
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

// DATABASE:
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cyco.ehplf2h.mongodb.net/?retryWrites=true&w=majority`;

// CREATE MONGO-CLIENT:
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const moviesCollection = client.db("cyco").collection("movies");
    const usersCollection = client.db("cyco").collection("users");
    const seriesCollection = client.db("cyco").collection("series");
    const paymentsCollection = client.db("cyco").collection("payments");
    const queryCollection = client.db('cyco').collection('forumQueries');

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "24h",
      });
      res.send({ token });
    });

    // MOVIES:
    app.get("/movies", async (req, res) => {
      try {
        const result = await moviesCollection.find().toArray();
        res.status(200).json(result);
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });

      }
    });

    // upload new movies
    app.post("/movies", async (req, res) => {

      try {
        const movieData = req.body;
        const result = await moviesCollection.insertOne(movieData);
        res.send(result);

        if (result.insertedCount === 1) {
          res.status(201).json({ message: "Movie saved successfully" });
        } else {
          res.status(500).json({ error: "Failed to save the movie" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });


    // SERIES:
    app.get('/series', verifyJWT, async (req, res) => {
      try {
        const result = await seriesCollection.find().toArray();
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // USERS:
    app.get('/user/:email', async (req, res) => {
      try {
        const { email } = req.params;
        const userData = await usersCollection.findOne({ email });
        if (userData) {
          res.status(200).json(userData);
        } else {
          res.status(404).json({ error: "User not found" });
        }
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.post("/register", async (req, res) => {
      try {
        const { username, email, password, role, photoUrl } = req.body;

        // Check if the email is already registered
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(409).json({ error: "Email already registered" });
        }

        // Create a new user document
        await usersCollection.insertOne({
          username,
          role,
          email,
          password,
          photoUrl,
          wishlist: [],
        });

        res.status(201).json({ message: "User registered successfully" });
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // check admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // WISHLIST:
    app.post("/wishlist", async (req, res) => {
      try {
        const { user, movie } = req.body;
        console.log(user?.email);

        const wishlist = await usersCollection.updateOne(
          { email: user?.email },
          { $addToSet: { wishlist: movie } }
        );
        console.log(wishlist);

        if (wishlist.modifiedCount === 1) {
          res.status(200).json({ message: "Movie added to wishlist" });
        } else if (wishlist.matchedCount === 1) {
          res.status(403).json({ message: "Already added to wishlist" });
        } else {
          res.status(404).json({ error: "User not found" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Payment intent Method:
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;

      // console.log(price, amount)

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment related API
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      res.send(result);
      
    // FORUM QUERIES:
    app.post('/query', async (req, res) => {
      try {
        const { user, query } = req.body;
        // console.log(user, query);

        const querySlot = await usersCollection.updateOne(
          { email: user?.email },
          { $addToSet: { querySlot: query } }
        );
        // console.log(querySlot);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/forumQueries', async (req, res) => {
      try {
        const newQuery = req.body;
        // console.log(req.body);

        const forumQueries = await queryCollection.insertOne(newQuery);
        res.send(forumQueries);
        // console.log(forumQueries);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/forumQueries', async (req, res) => {
      try {
        const fetchedQueries = await queryCollection.find().toArray();
        // console.log(fetchedQueries);
        res.status(200).json(fetchedQueries);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    });

    // CHECK SERVER CONNECTION:
    await client.db("admin").command({ ping: 1 });
    console.log("Hey Dev! No pain No gain.. Successfully Connected MongoDb");
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("cyco-engine");
});

app.listen(port, () => {
  console.log(`CYCO engine running on port ${port}`);
});
