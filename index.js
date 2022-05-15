const express = require('express');
var cors = require('cors');
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

    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email };
      const updateDoc = { $set: user };
      const options = { upsert: true };

      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    app.get('/booking', async (req, res) => {
      const patientEmail = req.query.patientEmail;
      const query = { patientEmail };
      const bookings = await bookingCollection.find(query).toArray();
      res.send(bookings);
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
