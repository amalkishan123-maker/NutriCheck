const express = require("express");
const cors = require("cors");
const path = require("path");

// node-fetch fix for CommonJS
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* API ROUTE */
app.get("/api/check/:barcode", async (req, res) => {
  try {
    const code = req.params.barcode;

    const r = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${code}.json`
    );

    const d = await r.json();

    // 🔥 FIXED PRODUCT CHECK
    if (!d || d.status === 0) {
      return res.json({ error: "Product not found" });
    }

    console.log("STATUS:", d.status);
    console.log("NAME:", d.product?.product_name);

    const p = d.product || {};
    const n = p.nutriments || {};

    const sugar = n.sugars_100g ?? 0;
    const fat = n.saturated_fat_100g ?? 0;
    const fiber = n.fiber_100g ?? 0;
    const energy = n.energy_kcal_100g ?? 0;

    // 🔥 FIXED INGREDIENT SOURCE
    const ingredientsText = (
      p.ingredients_text ||
      p.ingredients ||
      ""
    ).toLowerCase();

    const ingredientsList =
      p.ingredients_text || p.ingredients || "Ingredients not available";

    /* SCORE */
    let score = 100;
    if (sugar > 8) score -= 40;
    if (fat > 5) score -= 30;
    if (fiber < 2) score -= 20;
    score = Math.max(0, score);

    /* INGREDIENT ANALYSIS */
    const harmfulList = [
      "aspartame",
      "e951",
      "msg",
      "e621",
      "hfcs",
      "high fructose",
      "e150d",
      "caramel color",
      "e250"
    ];

    const cautionList = [
      "preservative",
      "emulsifier",
      "stabilizer",
      "artificial",
      "sweetener"
    ];

    let harmful = harmfulList.filter(i => ingredientsText.includes(i));
    let caution = cautionList.filter(i => ingredientsText.includes(i));
    let safe = [];

    if (harmful.length === 0 && caution.length === 0) {
      safe.push("Mostly natural ingredients");
    }

    /* NOVA DETECTION */
    const ingredientCount = ingredientsText
      ? ingredientsText.split(",").length
      : 0;

    let novaGroup = "NOVA 1";

    if (ingredientCount <= 3) novaGroup = "NOVA 1";
    else if (ingredientCount <= 6) novaGroup = "NOVA 2";
    else if (ingredientCount <= 12) novaGroup = "NOVA 3";
    else novaGroup = "NOVA 4";

    if (harmful.length > 0) novaGroup = "NOVA 4";

    /* NATURAL VS ARTIFICIAL */
    let artificialPercent = 0;

// base processing from NOVA
if (novaGroup === "NOVA 4") artificialPercent += 50;
else if (novaGroup === "NOVA 3") artificialPercent += 30;
else if (novaGroup === "NOVA 2") artificialPercent += 15;

// additives impact
artificialPercent += harmful.length * 15;
artificialPercent += caution.length * 8;

// limit range
artificialPercent = Math.min(90, artificialPercent);

const naturalPercent = 100 - artificialPercent;

    /* AI HEALTH RISKS */
    let healthRisks = [];

    if (sugar > 20)
      healthRisks.push("Very high sugar — diabetes risk");
    else if (sugar > 10)
      healthRisks.push("Moderate sugar — limit intake");

    if (fat > 15)
      healthRisks.push("High fat — heart risk");

    if (novaGroup === "NOVA 4")
      healthRisks.push("Ultra processed — obesity risk");

    if (harmful.length > 0)
      healthRisks.push("Contains harmful additives");

    /* RESPONSE */
    res.json({
      productName: p.product_name || "Food Item",
      sugar,
      fat,
      fiber,
      energy,
      score,
      novaGroup,
      naturalPercent,
      artificialPercent,
      healthRisks,
      ingredientsList,
      ingredientAnalysis: {
        harmful,
        caution,
        safe
      }
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ROOT */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* SERVER START */
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("Backend running on port " + PORT);
});