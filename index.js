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




app.get("/", (req, res) => {
  res.send("language learning  is running..");
});

app.listen(port, () => {
  console.log(`language learning  is running on port ${port}`);
});
