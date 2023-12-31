const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const port = process.env.PORT || 8080;
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

require('dotenv').config();

// ===-===-===-===-===-===-\\
// MIDDLEWARE:--------------||------------------------>>>>
// ===-===-===-===-===-===-//
app.use(cors());
app.use(express.json());

// ===-===-===-===-===-===-\\
// ERR HANDLER MIDDLEWARE:--||------------------------>>>>
// ===-===-===-===-===-===-//
app.use((err, req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173'); // Update this with your client's origin
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  console.error(err.stack);
  res.status(500).send('Something went wrong!');
  next();
});

// ===-===-===-===-===-===-\\
// JWT VERIFICATION:--------||------------------------>>>>
// ===-===-===-===-===-===-//
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: 'unauthorized access' });
  }

  // BEARER TOKEN:
  const token = authorization?.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: 'unauthorized access' });
    }
    req.decoded = decoded;
    next();
  });
};

// const verifyJWT = (req, res, next) => {
//   const authorizationHeader = req.headers.authorization;

//   if (!authorizationHeader) {
//     return res
//       .status(401)
//       .json({ error: true, message: 'Unauthorized access' });
//   }

//   const [bearer, token] = authorizationHeader.split(' ');

//   if (bearer !== 'Bearer' || !token) {
//     return res
//       .status(401)
//       .json({ error: true, message: 'Unauthorized access' });
//   }

//   // Verify the JWT token using your secret or public key
//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
//     if (err) {
//       return res
//         .status(401)
//         .json({ error: true, message: 'Unauthorized access' });
//     }

//     req.decoded = decoded;

//     next();
//   });
// };

// ===-===-===-===-===-===-\\
// SUBSCRIPTION E-MAIL:-----||------------------------>>>>
// ===-===-===-===-===-===-//
const sendMail = (emailDate, emailAddress) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS,
    },
  });
  const mailOptions = {
    from: process.env.EMAIL,
    to: emailAddress,
    subject: emailDate?.subject,
    html: `<p>${emailDate?.message}</p>`,
  };
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
};

// ===-===-===-===-===-\\
// MONGO-URI:-----------||------------------------>>>>
// ===-===-===-===-===-//
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cyco.ehplf2h.mongodb.net/?retryWrites=true&w=majority`;

// const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-15myamh-shard-00-00.ehplf2h.mongodb.net:27017,ac-15myamh-shard-00-01.ehplf2h.mongodb.net:27017,ac-15myamh-shard-00-02.ehplf2h.mongodb.net:27017/?ssl=true&replicaSet=atlas-7hujl1-shard-0&authSource=admin&retryWrites=true&w=majority`;

// ===-===-===-===-===-\\
// CREATE MONGO-CLIENT:-||------------------------>>>>
// ===-===-===-===-===-//
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
});

// ===-===-===-===-===-===-===-===\\
// ===-===-===-===-===-===-===-===-\\
// EXPRESS SERVER API ENDPOINTS:----||------------------------>>>>
// ===-===-===-===-===-===-===-===-//
// ===-===-===-===-===-===-===-===//
async function run() {
  try {
    await client.connect((error) => {
      if (error) {
        console.log(error);
        return;
      }
    });

    // ===-===-===-===-===-\\
    // DATABASE-COLLECTIONS:||------------------------>>>>
    // ===-===-===-===-===-//
    const liveTVCollection = client.db('cyco').collection('liveTV');
    const usersCollection = client.db('cyco').collection('users');
    const seriesCollection = client.db('cyco').collection('series');
    const queryCollection = client.db('cyco').collection('forumQueries');
    const paymentsCollection = client.db('cyco').collection('payments');
    const historyCollection = client.db('cyco').collection('history');
    const feedbacksCollection = client.db('cyco').collection('feedbacks');
    const movieReviewsCollection = client.db('cyco').collection('movieReviews');
    const eventsCollection = client.db('cyco').collection('events');
    const manageSubscriptionsCollection = client
      .db('cyco')
      .collection('manageSubscriptions');
      // const reviewsCollection = client.db('cyco').collection('reviews');
    const moviesCollection = client.db('cyco').collection('movies');
    const queryReportsCollection = client.db('cyco').collection('queryReports');

    // ===-===-===-===-===-\\
    // JWT:-----------------||------------------------>>>>
    // ===-===-===-===-===-//
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '24h',
      });
      res.send({ token });
    });

    // ===-===-===-===-===-\\
    // verifyAdmin:---------||------------------------>>>>
    // ===-===-===-===-===-//
    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.decoded?.email;
        if (!email) {
          return res.status(401).json({ error: true, message: 'Unauthorized' });
        }

        const query = { email: email };
        const user = await usersCollection.findOne(query);

        if (!user || user.role !== 'admin') {
          return res.status(403).json({ error: true, message: 'Forbidden' });
        }

        next();
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: true, message: 'Internal server error' });
      }
    };

    // ===-===-===-===-===-\\
    // USERS:---------------||------------------------>>>>
    // ===-===-===-===-===-//
    app.post('/users', async (req, res) => {
      try {
        const user = req.body;
        console.log(user);
        const query = { email: user.email };
        const existingUser = await usersCollection.findOne(query);

        if (existingUser) {
          return res.status(201).json({ message: 'User already exists' });
        }

        const result = await usersCollection.insertOne(user);
        res.status(201).json({
          message: 'User created successfully',
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // get all users:
    app.get('/users', async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // update an user 
     app.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Create the update object based on the fields provided in the request
    const updateObject = {};
    if (updateData.name) {
      updateObject.name = updateData.name;
    }
    if (updateData.email) {
      updateObject.email = updateData.email;
    }
    if (updateData.photo) {
      updateObject.photo = updateData.photo;
    }

    // Ensure there's at least one field to update
    if (Object.keys(updateObject).length === 0) {
      return res.status(400).send('No fields to update.');
    }

    // Update the user document based on the provided fields
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateObject }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).send('User not found.');
    }

    res.send('User updated successfully.');
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).send('Internal server error.');
  }
});


    // Check admin:
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      console.log(email, req.decoded);

      if (req.decoded?.email !== email) {
        return res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' };
      return res.send(result);
    });

    // set admin role:
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin',
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete('/user/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      if (result.deletedCount > 0) {
        res.json({ success: true, message: 'user deleted successfully' });
      } else {
        res.status(404).json({ success: false, message: 'user not found' });
      }
    });

    // ===-===-===-===-===-\\
    // EVENTS:--------------||------------------------>>>>
    // ===-===-===-===-===-//
    app.post('/newEvent', async (req, res) => {
      try {
        const event = req.body;

        const result = await eventsCollection.insertOne(event);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Events Get:
    app.get('/events', async (req, res) => {
      try {
        const result = await eventsCollection.find().toArray();
        res.status(200).json(result);
        // return result;
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Event Remove:
    app.delete('/events/:id', async (req, res) => {
      try {
        const EvetnId = req.params.id;
        const id = { _id: new ObjectId(EvetnId) };
        const result = await eventsCollection.deleteOne(id);
        res.status(200).json(result);
      } catch (err) {
        res
          .status(500)
          .json({ error: 'Hey Dev Please check some issues here' });
      }
    });

    // ===-===-===-===-===-\\
    // MOVIES:--------------||------------------------>>>>
    // ===-===-===-===-===-//
    app.post('/movies', async (req, res) => {
      try {
        const movieData = req.body;
        console.log('Movie Data:', movieData);
        const result = await moviesCollection.insertOne(movieData);

        if (result.insertedCount === 1) {
          res.status(201).json({ message: 'Movie saved successfully' });
        } else {
          res.status(500).json({ error: 'Failed to save the movie' });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/movies', async (req, res) => {
      try {
        const result = await moviesCollection.find().toArray();
        res.status(200).json(result);
        // return result;
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/movieReviews', async (req, res) => {
      try {
        const newMovieReview = req.body;
        const movieReviews = await movieReviewsCollection.insertOne(
          newMovieReview
        );
        res.send(movieReviews);
      } catch (error) {
        console.log(error);
        res.status(500).join({ error: 'Internal server error' });
      }
    });

    app.get('/movieReviews', async (req, res) => {
      try {
        const fetchedReviews = await movieReviewsCollection.find().toArray();
        res.status(200).json(fetchedReviews);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/reviews', async (req, res) => {
      try {
        const { user, review } = req.body;
        // Update the user document in the users collection to add the review to their reviewSlot
        const result = await usersCollection.updateOne(
          { email: user?.email },
          { $addToSet: { reviewSlot: review } }
        );
        if (result.modifiedCount === 1) {
          // If a document was modified, it means the review was added successfully
          res.status(201).json({ message: 'Review added successfully' });
        } else {
          // If no document was modified, it means the user with the specified email was not found
          res.status(404).json({ message: 'User not found' });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/feedbacks', async (req, res) => {
      try {
        const newFeedback = req.body;

        const result = await feedbacksCollection.insertOne(newFeedback);

        res.status(201).json({
          message: 'Feedback added successfully',
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).json({ message: 'Server error' });
      }
    });

    app.get('/feedbacks', async (req, res) => {
      try {
        const feedbacks = await feedbacksCollection.find({}).toArray();

        res.status(200).json(feedbacks);
      } catch (error) {
        res.status(500).json({ message: 'Server error' });
      }
    });

    // ===-===-===-===-===-\\
    // LIVE TVs:------------||------------------------>>>>
    // ===-===-===-===-===-//
    app.get('/liveTV', async (req, res) => {
      try {
        const result = await liveTVCollection.find().toArray();
        res.status(200).json(result);
        // return result;
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/liveTV', async (req, res) => {
      try {
        const movieData = req.body;
        const result = await liveTVCollection.insertOne(movieData);
        // res.send(result)

        if (result.insertedCount === 1) {
          res
            .status(201)
            .json({ message: 'Live Tv Channel saved successfully' });
        } else {
          res.status(500).json({ error: 'Failed to save the Live TV Channel' });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Define a route for retrieving channel information by ID
    app.get('/liveTV/:id', async (req, res) => {
      const id = req.params.id;

      try {
        const query = { _id: new ObjectId(id) };
        const channel = await liveTVCollection.findOne(query);

        if (channel) {
          // Channel found, send it as a response
          res.json({ success: true, data: channel });
        } else {
          // No matching channel found
          res
            .status(404)
            .json({ success: false, message: 'Channel not found' });
        }
      } catch (error) {
        // Handle any errors that occurred during the retrieval process
        console.error('Error:', error);
        res.status(500).json({
          success: false,
          message: 'An error occurred while retrieving the channel',
        });
      }
    });

    app.delete('/liveTV/:id', async (req, res) => {
      const id = req.params.id;

      try {
        const query = { _id: new ObjectId(id) };
        const result = await liveTVCollection.deleteOne(query);

        if (result.deletedCount > 0) {
          // Successfully deleted the channel
          res.json({ success: true, message: 'Item deleted successfully' });
        } else {
          // No matching channel found
          res.status(404).json({ success: false, message: 'Item not found' });
        }
      } catch (error) {
        // Handle any errors that occurred during the deletion process
        console.error('Error:', error);
        res.status(500).json({
          success: false,
          message: 'An error occurred while deleting the item',
        });
      }
    });

    app.patch('/liveTV/:id', async (req, res) => {
      try {
        const id = req.params.id;

        const filter = { _id: new ObjectId(id) };
        const result = await liveTVCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount === 0) {
          return res.status(404).json({ error: 'Channel not found' });
        }

        res
          .status(200)
          .json({ message: 'Channel updated successfully', result });
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.delete('/tvChannel/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await liveTVCollection.deleteOne(query);
      console.log('delete id', result);
      if (result.deletedCount > 0) {
        res.json({ success: true, message: 'Item deleted successfully' });
      } else {
        res.status(404).json({ success: false, message: 'Item not found' });
      }
    });

    // ===-===-===-===-===-\\
    // SERIES:--------------||------------------------>>>>
    // ===-===-===-===-===-//
    app.get('/series', async (req, res) => {
      try {
        const result = await seriesCollection.find().toArray();
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // ===-===-===-===-===-\\
    // SUBSCRIPTIONS':------||------------------------>>>>
    // ===-===-===-===-===-//
    app.get('/getManageSubscriptions', async (req, res) => {
      try {
        const result = await manageSubscriptionsCollection.find().toArray();
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    app.put('/updateManageSubscriptions/:id', async (req, res) => {
      const data = req.body;
      console.log(data);
      const filter = { _id: new ObjectId(req.params.id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: data,
      };
      const result = await manageSubscriptionsCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // ===-===-===-===-===-\\
    // HISTORY:-------------||------------------------>>>>
    // ===-===-===-===-===-//
    app.post('/history', async (req, res) => {
      const data = req.body;
      const result = await historyCollection.insertOne(data);
      // console.log(result);
      res.send(result);
    });

    //get history in db
    app.get('/getHistoryData', async (req, res) => {
      const result = await historyCollection.find().toArray();
      res.send(result);
    });

    //delete a history data from db
    app.delete('/history/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await historyCollection.deleteOne(query);
      res.send(result);
    });

    // ===-===-===-===-===-\\
    // WISHLIST:------------||------------------------>>>>
    // ===-===-===-===-===-//
    app.post('/wishlist', async (req, res) => {
      try {
        const { user, movie } = req.body;
        // console.log(user?.email);

        if (!user || !user?.email) {
          return res.status(400).json({ error: 'Invalid user data' });
        }

        const userExists = await usersCollection.findOne({
          email: user?.email,
        });

        if (!userExists) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Check if the movie is already in the wishlist
        const alreadyInWishlist = userExists?.wishlist?.some(
          (wishlist) => wishlist?._id === movie?._id
        );

        if (alreadyInWishlist) {
          return res
            .status(200)
            .json({ message: 'Already added to wishlist!' });
        }

        const updateResult = await usersCollection.updateOne(
          { email: user?.email },
          { $addToSet: { wishlist: movie } }
        );

        if (updateResult?.modifiedCount === 1) {
          res.status(200).json({ message: 'Movie added to wishlist!' });
        } else if (updateResult?.matchedCount === 1) {
          res.status(403).json({ message: 'Already added to wishlist!' });
        } else {
          res.status(404).json({ error: 'User not found!' });
        }

        // if (!user || !user?.email) {
        //   return res.status(400).json({ error: 'Invalid user data' });
        // }

        // const userExists = await usersCollection.findOne({
        //   email: user?.email,
        // });

        // if (!userExists) {
        //   return res.status(404).json({ error: 'User not found' });
        // }

        // if (updateResult?.modifiedCount === 1) {
        //   res.status(200).json({ message: 'Movie added to wishlist!' });
        // } else if (updateResult?.matchedCount === 1) {
        //   res.status(403).json({ message: 'Already added to wishlist!' });
        // } else {
        //   res.status(404).json({ error: 'User not found!' });
        // }
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error!' });
      }
    });

    app.delete('/wishlist/:email/:movieId', async (req, res) => {
      try {
        const { email, movieId } = req.params;
        console.log(email, movieId);

        const user = await usersCollection.findOne({ email: email });
        if (!user) {
          return res?.status(404).json({ error: 'User not found!' });
        }

        const movieIndex = user?.wishlist?.findIndex(
          (movie) => movie?._id === movieId
        );

        if (movieIndex === -1) {
          return res?.status(404).json({ error: 'Movie not found!' });
        }

        user?.wishlist?.splice(movieIndex, 1);

        await usersCollection.updateOne(
          { email: email },
          { $set: { wishlist: user?.wishlist } }
        );

        res?.status(200).json({ message: 'Movie removed from wishlist!' });
      } catch (error) {
        console.log('Error removing movie from wishlist:', error);
        res?.status(500).json({ error: 'Internal Server Error!' });
      }
    });

    // ===-===-===-===-===-\\
    // PAYMENT:-------------||------------------------>>>>
    // ===-===-===-===-===-//
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      console.log(payment);
      const result = await paymentsCollection.insertOne(payment);
      // Send confirmation email to guest
      sendMail(
        {
          subject: 'Payment Successful!',
          message: `Payment Id: ${result?.insertedId}, TransactionId: ${payment.transectionId}`,
        },
        payment?.email
      );

      //send confirmation email to host email account
      sendMail(
        {
          subject: 'CYCO SUBSCRIPTION ACTIVATED!',
          message: `Booking Id: ${result?.insertedId}, TransactionId: ${payment.transactionId}. Check dashboard for more info`,
        },
        payment?.admin?.email
      );

      res.send(result);
    });

    app.get('/monthly-revenue', async (req, res) => {
      try {
        const monthlyRevenue = await paymentsCollection
          .aggregate([
            {
              $match: {
                date: { $type: 'date' }, // Filter out documents with invalid date values
              },
            },
            {
              $group: {
                _id: {
                  year: { $year: '$date' },
                  month: { $month: '$date' },
                },
                totalRevenue: { $sum: '$amount' },
              },
            },
          ])
          .toArray();

        res.json(monthlyRevenue);
      } catch (error) {
        console.error('Error fetching monthly revenue:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Fetch payment history data:
    app.get('/getPaymentHistory', async (req, res) => {
      try {
        const data = await paymentsCollection.find().toArray(); // Replace with your query
        res.json(data);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
      }
    });

    // ===-===-===-===-===-\\
    // FORUM:---------------||------------------------>>>>
    // ===-===-===-===-===-//
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

        const forumQueries = await queryCollection.insertOne(newQuery);
        res.send(forumQueries);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/forumQueries', async (req, res) => {
      try {
        const fetchedQueries = await queryCollection.find().toArray();
        res.status(200).json(fetchedQueries);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Query comments:
    app.post('/forumQueries/comments/:id', async (req, res) => {
      try {
        const queryId = req.params.id;
        const newComment = req.body.comment;
        // const userId = req.user?._id;

        console.log(queryId, newComment);

        const updatedQuery = await queryCollection.updateOne(
          { _id: new ObjectId(queryId) },
          { $addToSet: { comments: newComment } }
        );

        console.log(updatedQuery);

        if (updatedQuery.modifiedCount === 1) {
          res.json({ success: true, comment: newComment });
        } else {
          res.json({ success: false });
        }
      } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/forumQueries/comments/:id', async (req, res) => {
      try {
        const queryId = req.params.id;

        const query = await queryCollection.findOne({
          _id: new ObjectId(queryId),
        });

        if (!query) {
          res.status(404).json({ error: 'Query not found' });
          return;
        }

        const comments = query?.comments;
        res.json({ success: true, comments });
      } catch (error) {
        console.log('Error fetching comments:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Update views count:
    app.put('/forumQueries/:id', async (req, res) => {
      try {
        const queryId = req.params.id;
        const updatedViews = req.body.views;

        const updatedQuery = await queryCollection.updateOne(
          { _id: new ObjectId(queryId) },
          { $set: { views: updatedViews } }
        );

        if (updatedQuery.modifiedCount === 1) {
          res.json({ success: true });
        } else {
          res.json({ success: false });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Query report:
    app.post('/report/query', async (req, res) => {
      try {
        const { queryId } = req.body;
        console.log(queryId);

        // Check if the query has already been reported by this user
        const existingReport = await queryReportsCollection.findOne({
          queryId: queryId,
        });

        if (existingReport) {
          // The query has already been reported by this user
          res.json({
            success: false,
            message: 'Query has already been reported by this user.',
          });
        } else {
          // Create a new query report record in the collection
          const report = {
            queryId: queryId,
            reportedAt: new Date(),
          };

          // Insert the report into the collection
          const result = await queryReportsCollection.insertOne(report);

          if (result.acknowledged && result.insertedId) {
            // Report inserted successfully
            res.json({
              success: true,
              message: 'Query reported successfully',
              insertedId: result.insertedId,
            });
          } else {
            // Report insertion failed
            res
              .status(500)
              .json({ success: false, message: 'Failed to report the query.' });
          }
        }
      } catch (error) {
        console.error('Error reporting query:', error);
        // Respond with an error message
        res.status(500).json({
          success: false,
          message: 'An error occurred while reporting the query.',
          error: error.message,
        });
      }
    });

    // Updated query vote count:
    // const updateVoteCount = async (queryId, newVoteCount) => {
    //   try {
    //     const updateQuery = await queryCollection.updateOne(
    //       { _id: new ObjectId(queryId) },
    //       { $set: { voteCount: newVoteCount } },
    //       { returnOriginal: true }
    //     );

    //     if (!updateQuery.value) {
    //       return { success: false, message: 'Query not found!' };
    //     }
    //     return { success: true, message: 'Vote count successfully!' };
    //   } catch (error) {
    //     console.log('Error updating vote count:', error);
    //     return { success: false, message: 'Internal server error' };
    //   }
    // };

    // Creating a vote count:
    app.put('/forumQueries/:queryId', async (req, res) => {
      const queryId = req.params.queryId;
      const { voteCount } = req.body;
      const voteType = req.body;
      const userId = req.decoded;

      console.log('vote handler:', queryId, voteType, userId);

      try {
        const query = await queryCollection.findOne({
          _id: new ObjectId(queryId),
        });

        if (!query) {
          return res.status(404).json({ error: 'Query not found!' });
        }

        if (voteType === 'upvote') {
          if (query?.upvote.includes(userId)) {
            return res.status(400).json({ error: 'Already upvoted!' });
          }

          if (query?.downvotes.includes(userId)) {
            const downvoteIndex = query.downvotes.indexOf(userId);
            query.downvotes.splice(downvoteIndex, 1);
          }

          query.upvotes.push(userId);
        } else if (voteType === 'downvote') {
          if (query.downvotes.includes(userId)) {
            return res
              .status(400)
              .json({ error: 'User already downvoted this query!' });
          }

          if (query.upvotes.includes(userId)) {
            const upvoteIndex = query.upvotes.indexOf(userId);
            query.upvotes.splice(upvoteIndex, 1);
          }

          query.downvotes.push(userId);
        } else {
          return res.status(400).json({ error: 'Invalid vote type!' });
        }

        await queryCollection.updateOne(
          { _id: new ObjectId(queryId) },
          {
            $set: {
              upvotes: query?.upvotes,
              downvotes: query?.downvotes,
            },
          }
        );

        res.json({ success: true });
      } catch (error) {
        console.error('Error updating vote count:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.delete('/forumQueries/votes/:id', async (req, res) => {
      const queryId = req.params.id;

      try {
        const query = await queryCollection.findOne(queryId);

        if (!query) {
          res.status(404).json({ error: 'Query not found' });
          return;
        }

        await queryCollection.deleteOne({ _id: queryId });
        res.json({ message: 'Query deleted successfully' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Delete a query object:
    app.delete('/forumQueries/:id', async (req, res) => {
      try {
        const objectId = req.params.id;
        const deletedObject = await queryCollection.deleteOne(objectId);

        if (!deletedObject) {
          return res.status(404).json({ message: 'Object not found' });
        }
        res.json({ message: 'Object deleted successfully', deletedObject });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    // Update a query object:
    app.put('/forumQueries/:id', async (req, res) => {
      try {
        const queryId = req.params.id;
        const newComment = req.body;

        const existingQuery = await queryCollection.findOne({
          _id: new ObjectId(queryId),
        });

        if (!existingQuery) {
          return res?.status(404).json({ error: 'Query not found!' });
        }

        existingQuery.comments.push(newComment);

        await queryCollection.updateOne(
          { _id: new ObjectId(queryId) },
          { $set: { comments: existingQuery?.comments } }
        );

        res.json({ success: true });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // ===-===-===-===-===-\\
    // SERVER CONNECTION:---||------------------------>>>>
    // ===-===-===-===-===-//
    await client.db('admin').command({ ping: 1 });
    console.log('Hey Dev! No pain No gain.. Successfully Connected MongoDb');
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('cyco-engine');
});

app.listen(port, () => {
  console.log(`SERVER IS RUNNING ON PORT ${port}`);
});
