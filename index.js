const express = require('express');
var cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.02ql6.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthorized access!' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access!' });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    const servicesCollection = client
      .db('doctors_portal')
      .collection('services');

    const bookingCollection = client
      .db('doctors_portal')
      .collection('bookings');

    const userCollection = client.db('doctors_portal').collection('users');

    app.get('/service', async (req, res) => {
      const query = {};
      const cursor = servicesCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });

    app.get('/user', verifyJWT, async (req, res) => {
      const users = await userCollection.find({}).toArray();
      res.send(users);
    });

    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin });
    });

    app.put('/user/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });

      if (requesterAccount.role === 'admin') {
        const filter = { email };
        const updateDoc = { $set: { role: 'admin' } };
        const result = await userCollection.updateOne(filter, updateDoc);
        return res.send(result);
      }
      return res.status(403).send({ message: 'Forbidden access!' });
    });

    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email };
      const updateDoc = { $set: user };
      const options = { upsert: true };

      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h',
      });
      res.send({ result, token });
    });

    app.get('/booking', verifyJWT, async (req, res) => {
      const patientEmail = req.query.patientEmail;
      const decodedEmail = req.decoded.email;
      if (patientEmail === decodedEmail) {
        const query = { patientEmail };
        const bookings = await bookingCollection.find(query).toArray();
        return res.send(bookings);
      }
      return res.status(403).send({ message: 'Forbidden access!' });
    });

    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patientEmail: booking.patientEmail,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      res.send({ success: true, result });
    });

    app.get('/available', async (req, res) => {
      const date = req.query.date;
      // get all the services
      const services = await servicesCollection.find().toArray();
      // get the booking of that day
      const query = { date };
      const bookings = await bookingCollection.find(query).toArray();
      // For each service find booking for the service
      services.forEach((service) => {
        const serviceBookings = bookings.filter(
          (book) => book.treatment === service.name
        );
        const booked = serviceBookings.map((book) => book.slot);
        const available = service.slots.filter(
          (slot) => !booked.includes(slot)
        );

        service.slots = available;
      });
      res.send(services);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
