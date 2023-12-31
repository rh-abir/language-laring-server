const express = require("express");
const app = express();

const morgan = require("morgan");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const SSLCommerzPayment = require("sslcommerz-lts");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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

const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false; //true for live, false for sandbox

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized Access" });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized Access" });
    }

    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    const usersCollection = client.db("languageDB").collection("users");
    const classCollection = client.db("languageDB").collection("class");
    const selectedCollection = client.db("languageDB").collection("selecteds");
    const orderCollection = client.db("languageDB").collection("order");

    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });

      res.send({ token });
    });

    // get all user
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      // console.log(result)
      res.send(result);
    });

    // get all instructos
    app.get("/instructos", async (req, res) => {
      const query = { role: "instructor" };
      const result = await usersCollection.find(query).toArray();
      // console.log(result)
      res.send(result);
    });

    // save a user in DB
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      // console.log(email, user);
      const option = { upsert: true };
      const query = { email: email };
      const updateDoc = {
        $set: user,
      };

      const result = await usersCollection.updateOne(query, updateDoc, option);
      // console.log(result);
      res.send(result);
    });

    // payments
    app.post("/order", async (req, res) => {
      const order = req.body;
      const tran_id = new ObjectId().toString();

      const productId = order.product._id;
      const enrollSets = order.product.enroll + 1;

      const data = {
        total_amount: order.mony,
        currency: "BDT",
        tran_id: tran_id, // use unique tran_id for each api call
        success_url: `http://localhost:5000/payment/suceess/${tran_id}`,
        fail_url: `http://localhost:5000/payment/fail/${tran_id}`,
        cancel_url: "http://localhost:3030/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: order.product.student.name,
        cus_email: order.product.student.email,
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };

      // console.log(data);

      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });

        const finalOrder = {
          ...order,
          paidStatus: false,
          tranjectionId: tran_id,
        };

        const result = orderCollection.insertOne(finalOrder);

        // console.log("Redirecting to: ", GatewayPageURL);
      });

      app.post("/payment/suceess/:tranId", async (req, res) => {
        // console.log(req.params.tranId);
        // console.log("this is product id", productId, enrollSets);

        const result = await orderCollection.updateOne(
          { tranjectionId: req.params.tranId },
          { $set: { paidStatus: true } }
        );

        if (result.modifiedCount > 0) {
          res.redirect(
            `http://localhost:5173/payment/success/${req.params.tranId}`
          );
        }
      });

      app.post("/payment/fail/:tranId", async (req, res) => {
        const result = await orderCollection.deleteOne({
          tranjectionId: req.params.tranId,
        });
        if (result.deletedCount) {
          res.redirect(
            `http://localhost:5173/payment/fail/${req.params.tranId}`
          );
        }
      });
    });

    // get paymet successfull card
    app.get("/payment/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "product.student.email": email };
      const result = await orderCollection.find(query).toArray();
      // console.log(result)
      res.send(result);
    });

    // update enroll sites
    app.put("/class/enroll/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;

      const newEnroll = body.cardData.enroll + 1;
      // console.log(id, newEnroll);

      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: { enroll: newEnroll },
      };
      const result = await classCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // get a users role
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      // console.log(result);
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

    // get appruve Class
    app.get("/approveclass", async (req, res) => {
      const result = await classCollection
        .find({ status: "approve" })
        .toArray();
      res.send(result);
    });


    // get Popular class 
    app.get('/calss/popular', async(req, res) => {

      const query = { enroll: {$gt: 0} }
      const result = await classCollection.find(query).toArray();
      // console.log(result)
      res.send(result)

    })



    // get all class by user email
    app.get("/class/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await classCollection.find(query).toArray();
      // console.log(result);
      res.send(result);
    });

    app.patch("/class/status/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body.status;

      // console.log("from backed", id, body);

      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: body,
        },
      };

      const result = await classCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // upload a selected class in db
    app.post("/select", async (req, res) => {
      const body = req.body;
      const result = await selectedCollection.insertOne(body);
      res.send(result);
    });

    // get selet class by user email
    app.get("/select/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "student.email": email };
      const result = await selectedCollection.find(query).toArray();
      // console.log(result)
      res.send(result);
    });

    app.delete("/select/:id", async (req, res) => {
      const id = req.params.id;
      //  return console.log("please delete form database", id);
      const query = { _id: id };
      const result = await selectedCollection.deleteOne(query);
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
