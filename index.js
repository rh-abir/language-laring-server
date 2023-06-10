const express = require("express");
const app = express();

const morgan = require("morgan");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jvfq5i3.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const studentsCollection = client.db("languageDB").collection("students");
    const classCollection = client.db("languageDB").collection("class");
    // const buysCollection = client.db('languageDB').collection('students')

    // save user in DB
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      console.log(email, user);
      const option = { upsert: true };
      const query = { email: email };
      const updateDoc = {
        $set: user,
      };

      const result = await studentsCollection.updateOne(
        query,
        updateDoc,
        option
      );
      console.log(result);
      res.send(result);
    });

    // post class
    app.post("/class", async (req, res) => {
      const body = req.body;
      // console.log(body)
      const result = await classCollection.insertOne(body);
      res.send(result);
    });



    // get all class
    app.get("/class", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });



    // get all class by user email
    app.get("/class/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await classCollection.find(query).toArray();
      console.log(result)
      res.send(result);
    });




    
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("language learning  is running..");
});

app.listen(port, () => {
  console.log(`language learning  is running on port ${port}`);
});
