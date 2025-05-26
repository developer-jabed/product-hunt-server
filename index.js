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
    const couponsCollection = client.db("Product-hunt").collection("coupons");

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

    app.patch("/users/:id/role", async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;

      try {
        const updatedUser = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } }
        );

        if (updatedUser.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "User not found or role not updated" });
        }

        res.json({ message: "User role updated successfully" });
      } catch (err) {
        res.status(500).json({ message: "Error updating user role" });
      }
    });

    // --------------------
    // Products
    // --------------------

    app.patch("/Products/:id", async (req, res) => {
      const id = req.params.id;
      const { action } = req.body;
      let status = "";

      if (action === "accept") status = "accepted";
      else if (action === "reject") status = "rejected";
      else return res.status(400).send({ message: "Invalid action" });

      const result = await productCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );

      if (result.modifiedCount > 0) {
        res.send({ message: `Product has been ${status}.` });
      } else {
        res.status(404).send({ message: "Product not found or not updated." });
      }
    });

    app.patch("/Products/:id/featured", async (req, res) => {
      const id = req.params.id;
      const result = await productCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isFeatured: true } }
      );

      if (result.modifiedCount > 0) {
        res.send({ message: "Product marked as featured." });
      } else {
        res.status(404).send({ message: "Product not found or not updated." });
      }
    });

    app.post("/Products", async (req, res) => {
      try {
        const newProduct = req.body;
        const result = await productCollection.insertOne(newProduct);
        res.send(result);
      } catch (error) {
        console.error("error inserting food", error);
        res.status(500).send({ error: "failed to insert Product" });
      }
    });

    // Accept or Reject Product
    app.patch("/Products/:id", async (req, res) => {
      const { id } = req.params;
      const { action } = req.body; // "accept" or "reject"

      try {
        const product = await product.findById(id);

        if (!product || product.status !== "pending") {
          return res
            .status(404)
            .send({ error: "Product not found or already reviewed" });
        }

        if (action === "accept") {
          product.status = "approved"; // Set to "approved"
          await product.save();
          res.status(200).send({ message: "Product approved" });
        } else if (action === "reject") {
          await product.remove(); // Delete product if rejected
          res.status(200).send({ message: "Product rejected" });
        } else {
          res.status(400).send({ error: "Invalid action" });
        }
      } catch (error) {
        res.status(500).send({ error: "Failed to process review" });
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
    });

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

    app.put("/Products/:id/report", async (req, res) => {
      const { id } = req.params;
      const { reporterEmail } = req.body;

      if (!ObjectId.isValid(id)) return res.status(400).send("Invalid ID");

      const product = await productCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!product) return res.status(404).send("Product not found");

      if (product.reportedUsers?.includes(reporterEmail)) {
        return res
          .status(400)
          .send({ message: "You already reported this product" });
      }

      await productCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $push: { reportedUsers: reporterEmail },
        }
      );

      res.send({ message: "Report recorded successfully" });
    });

    app.get("/reported-products", async (req, res) => {
      try {
        const reportedProducts = await productCollection
          .find({ reportedUsers: { $exists: true, $not: { $size: 0 } } })
          .toArray();

        res.send(reportedProducts);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Failed to fetch reported products", error });
      }
    });

    app.delete("/Products/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    // GET /Products/stats
    app.get("/Products/stats", async (req, res) => {
      try {
        const allProducts = await productCollection.find().toArray();

        const statusCounts = {
          accepted: 0,
          pending: 0,
          rejected: 0,
          notReviewed: 0,
        };

        allProducts.forEach((product) => {
          const status = product.status?.toLowerCase();

          if (status === "accepted") statusCounts.accepted++;
          else if (status === "under review" || status === "pending")
            statusCounts.pending++;
          else if (status === "rejected") statusCounts.rejected++;
          else statusCounts.notReviewed++;
        });

        res.json(statusCounts);
      } catch (error) {
        console.error("Error getting stats:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
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

    // Get all coupons
    app.get("/coupons", async (req, res) => {
      const coupons = await couponsCollection.find().toArray();
      res.send(coupons);
    });

    // Add a coupon
    app.post("/coupons", async (req, res) => {
      const coupon = req.body;
      const result = await couponsCollection.insertOne(coupon);
      res.send(result);
    });

    // Update a coupon
    app.put("/coupons/:id", async (req, res) => {
      const { id } = req.params;
      const updatedCoupon = req.body;

      const result = await couponsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedCoupon }
      );

      res.send(result);
    });

    // Delete a coupon
    app.delete("/coupons/:id", async (req, res) => {
      const { id } = req.params;

      const result = await couponsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    // Update user subscription status
    app.put("/users/:email", async (req, res) => {
      const { email } = req.params;
      const { subscriptionStatus } = req.body; // e.g., "subscribed"

      const result = await userCollection.updateOne(
        { email },
        { $set: { subscriptionStatus } }
      );

      if (result.modifiedCount === 0) {
        return res.status(400).send("User not found or status already updated");
      }

      res.send(result);
    });
  } finally {
    // Optional: don't close the connection if running persistently
  }
}

run().catch(console.error);

app.get("/", (req, res) => {
  res.send("Welcome to the best choice server!");
});
app.listen(port, () => {
  console.log(
    `Explore Your Best Choice Server Running on: http://localhost:${port}`
  );
});
