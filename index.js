require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xo1yp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.db("admin").command({ ping: 1 });

    const productCollection = client.db("Product-hunt").collection("Products");
    const userCollection = client.db("Product-hunt").collection("Users");
    const reviewCollection = client.db("Product-hunt").collection("reviews");

    // --------------------
    // Users
    // --------------------
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    // --------------------
    // Products
    // --------------------

    app.post("/Products", async (req, res) => {
      try {
        const product = req.body;
        const result = await productCollection.insertOne(product);
        res.status(200).send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to add product" });
      }
    });
    app.get("/Products", async (req, res) => {
      const { search = "", page = 1, limit = 6 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const searchRegex = new RegExp(search, "i");

      const filter = {
        $or: [
          { name: { $regex: searchRegex } },
          { tag: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
        ],
      };

      try {
        const totalCount = await productCollection.countDocuments(filter);
        const products = await productCollection
          .find(filter)
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        res.send({ products, totalCount });
      } catch (error) {
        console.error("Search error:", error);
        res.status(500).send({ error: "Failed to fetch products" });
      }
    });


    app.get("/Products/all", async (req, res) => {
        const result = await productCollection.find().toArray();
        res.send(result);
    })

    app.get("/Products/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).send("Invalid ID");
      const product = await productCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!product) return res.status(404).send("Product not found");
      res.send(product);
    });

    app.put("/Products/:id/upvote", async (req, res) => {
      const { id } = req.params;
      const { userEmail } = req.body;

      if (!ObjectId.isValid(id)) return res.status(400).send("Invalid ID");

      const product = await productCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!product) return res.status(404).send("Product not found");

      if (product.votedUsers?.includes(userEmail)) {
        return res.status(400).send("You already voted on this product");
      }

      await productCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $inc: { upvotes: 1 },
          $push: { votedUsers: userEmail },
        }
      );

      res.send({ message: "Vote recorded successfully" });
    });

    // --------------------
    // Reviews
    // --------------------
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.post("/reviews", async (req, res) => {
      try {
        const newReview = req.body;
        const result = await reviewCollection.insertOne(newReview);
        res.send(result);
      } catch (error) {
        console.error("Error ");
        res.status(500).send({ error });
      }
    });
  } finally {
    // Optional: don't close the connection if running persistently
  }
}

run().catch(console.error);

app.get('/', (req, res) => {
  res.send('Welcome to the best choice server!');
});
app.listen(port, () => {
  console.log(
    `Explore Your Best Choice Server Running on: http://localhost:${port}`
  );
});
