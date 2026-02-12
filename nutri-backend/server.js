const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/api/check/:barcode", async (req, res) => {
  try {
    const code = req.params.barcode;

    const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
    const d = await r.json();

    if (!d.product) {
      return res.json({ error: "Product not found" });
    }

    const p = d.product;
    const n = p.nutriments || {};

    const sugar = n.sugars_100g ?? 0;
    const fat = n.saturated_fat_100g ?? 0;
    const fiber = n.fiber_100g ?? 0;
    const energy = n.energy_kcal_100g ?? 0;

    const ingredientsText = (p.ingredients_text || "").toLowerCase();
    const ingredientsList = p.ingredients_text || "Ingredients not available";

    // ---------------- SCORE ----------------
    let score = 100;
    if (sugar > 8) score -= 40;
    if (fat > 5) score -= 30;
    if (fiber < 2) score -= 20;
    score = Math.max(0, score);

    // ---------------- INGREDIENT THINKING ----------------
    const harmfulList = ["aspartame", "msg", "hfcs", "high fructose", "e150d"];
    const cautionList = ["preservative", "emulsifier", "stabilizer", "artificial", "sweetener"];

    let harmful = [];
    let caution = [];
    let safe = [];

    harmfulList.forEach(i => {
      if (ingredientsText.includes(i)) harmful.push(i);
    });

    cautionList.forEach(i => {
      if (ingredientsText.includes(i)) caution.push(i);
    });

    if (harmful.length === 0 && caution.length === 0) {
      safe.push("Mostly natural ingredients");
    }

    // ---------------- NOVA DETECTION ----------------
    const ingredientCount = ingredientsText.split(",").length;

    let novaGroup = "NOVA 1";
    if (ingredientCount > 5) novaGroup = "NOVA 2";
    if (ingredientCount > 10 || caution.length > 0) novaGroup = "NOVA 3";
    if (ingredientCount > 15 || harmful.length > 0) novaGroup = "NOVA 4";

    // ---------------- NATURAL VS ARTIFICIAL % ----------------
    const totalSignals = harmful.length + caution.length + 1;

    const artificialPercent = Math.min(80, (harmful.length * 20) + (caution.length * 10));
    const naturalPercent = 100 - artificialPercent;

    // ---------------- AI HEALTH RISK ----------------
    let healthRisks = [];

    if (sugar > 15) healthRisks.push("High diabetes risk");
    if (fat > 10) healthRisks.push("Heart disease risk");
    if (novaGroup === "NOVA 4") healthRisks.push("Ultra processed — obesity risk");
    if (harmful.length > 0) healthRisks.push("Contains chemical additives");

    // ---------------- BETTER BRAND SEARCH ----------------
    let alternativeBrand = "Better alternative not found";

    const categories = (p.categories || "").split(",")[0];

    if (categories) {
      const searchUrl =
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=` +
        encodeURIComponent(categories) +
        `&search_simple=1&action=process&json=1&page_size=10`;

      const sr = await fetch(searchUrl);
      const sd = await sr.json();

      if (sd.products) {
        for (const prod of sd.products) {
          if (!prod.nutriments) continue;
          if (prod.code === code) continue;

          const ps = prod.nutriments.sugars_100g;
          if (ps != null && ps < sugar) {
            alternativeBrand =
              `${prod.brands || "Other brand"} - ${prod.product_name}`;
            break;
          }
        }
      }
    }

    // ---------------- FINAL RESPONSE ----------------
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
      alternativeBrand,
      ingredients: ingredientsList,
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

app.listen(4000, () => {
  console.log("Backend running at http://localhost:4000");
});
