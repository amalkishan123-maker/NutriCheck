const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const path = require("path");
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/check/:barcode", async (req, res) => {
  try {
    const code = req.params.barcode;

    // Get scanned product
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${code}.json`
    );
    const d = await r.json();

    if (!d.product) {
      return res.json({ error: "Product not found" });
    }

    const p = d.product;
    const n = p.nutriments || {};

    const sugar = n.sugars_100g ?? null;
    const fat = n.saturated_fat_100g ?? null;
    const fiber = n.fiber_100g ?? null;
    const energy = n.energy_kcal_100g ?? null;
    const salt = n.salt_100g ?? null;

    const ingredients = p.ingredients_text || "Ingredients not available";
    const name = p.product_name || "Food Item";
    const categories = (p.categories || "").toLowerCase();

    // Search better brand from OFF
    let alternativeBrand = "No healthier brand found";

    if (categories) {
      const searchUrl =
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=` +
        encodeURIComponent(categories.split(",")[0]) +
        `&search_simple=1&action=process&json=1&page_size=20`;

      const sr = await fetch(searchUrl);
      const sd = await sr.json();

      if (sd.products) {
        for (const prod of sd.products) {
          if (!prod.nutriments) continue;
          if (prod.code === code) continue;

          const ps = prod.nutriments.sugars_100g;
          const pf = prod.nutriments.saturated_fat_100g;
          const pb = prod.brands;

          if (ps == null || pf == null || !pb) continue;

          if (
            sugar != null &&
            ps < sugar &&
            (fat == null || pf < fat)
          ) {
            alternativeBrand =
              `${pb} - ${prod.product_name}`;
            break;
          }
        }
      }
    }

    // Ingredient thinking
    const text = ingredients.toLowerCase();
    let harmful = [];
    let caution = [];
    let safe = [];

    const harmfulList = ["aspartame", "msg", "hfcs", "high fructose", "e150d"];
    const cautionList = ["preservative", "artificial", "emulsifier", "stabilizer", "sweetener"];

    harmfulList.forEach(i => {
      if (text.includes(i)) harmful.push(i);
    });

    cautionList.forEach(i => {
      if (text.includes(i)) caution.push(i);
    });

    if (harmful.length === 0 && caution.length === 0) {
      safe.push("No high-risk additives detected");
    }

    // Send to frontend / Android
    res.json({
      productName: name,
      sugar,
      fat,
      fiber,
      energy,
      salt,
      ingredients,
      alternativeBrand,
      ingredientAnalysis: {
        harmful,
        caution,
        safe
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(4000, () => {
  console.log("Backend running at http://localhost:4000");
});

