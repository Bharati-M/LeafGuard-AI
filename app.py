import os
import pickle
import numpy as np
from PIL import Image

import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.applications.mobilenet_v2 import (
    MobileNetV2,
    preprocess_input,
    decode_predictions
)

from flask import Flask, request, jsonify, render_template, send_from_directory

# =========================================================
# FLASK CONFIGURATION
# =========================================================

app = Flask(
    __name__,
    static_folder="static",
    template_folder="templates"
)

# =========================================================
# DEEP LEARNING MODEL INITIALIZATION
# =========================================================

# Disable GPU to prevent issues on local Windows setups
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

print("--> Loading main TensorFlow Keras model...")
try:
    model = load_model("model.keras")
    print("--> Main model loaded successfully!")
except Exception as e:
    print(f"Error loading main model: {e}")
    model = None

print("--> Loading features label dictionary...")
try:
    features = pickle.load(open("features.pkl", "rb"))
    print(f"--> Labels loaded successfully: {features}")
except Exception as e:
    print(f"Error loading features pickle: {e}")
    features = []

print("--> Loading leaf validation model (MobileNetV2)...")
try:
    validator_model = MobileNetV2(weights="imagenet")
    print("--> Leaf validator model loaded successfully!")
except Exception as e:
    print(f"Error loading validator model: {e}")
    validator_model = None

# =========================================================
# AGRONOMY DISEASE & WEED KNOWLEDGE DATABASE
# =========================================================

DISEASE_DB = {
    "Tomato___Bacterial_spot": {
        "disease_name": "Tomato Bacterial Spot",
        "common_name": "Bacterial Spot of Tomato",
        "crop": "Tomato",
        "type": "Bacterial Disease",
        "pathogen": "Xanthomonas perforans / Xanthomonas vesicatoria",
        "severity": "High",
        "symptoms": [
            "Small, greasy, water-soaked spots on leaves that rapidly turn dark brown or black.",
            "Yellow halo (chlorosis) forming around mature leaf spots.",
            "Severe infections cause leaves to yellow, dry out, and drop, exposing tomatoes to sunscald.",
            "Dark, raised, scab-like spots may also develop on the tomato fruits."
        ],
        "causes": [
            "Warm (24°C - 30°C / 75°F - 86°F), extremely wet, and highly humid environmental conditions.",
            "Splashing water from rain, heavy dew, or overhead sprinklers that transfers bacteria.",
            "Use of infected seeds or diseased transplants in the nursery stage.",
            "Working in wet tomato fields, which physically spreads the pathogen on hands and tools."
        ],
        "prevention": [
            "Purchase and plant only certified disease-free seeds and healthy transplants.",
            "Avoid overhead watering; implement drip irrigation or soaker hoses to keep foliage dry.",
            "Practice strict crop rotation: do not plant tomatoes, peppers, or eggplants in the same spot for at least 3 years.",
            "Regularly sanitize garden shears, tools, stakes, and hands, especially after working on infected plants.",
            "Remove and destroy (do not compost) crop residue immediately after harvest to prevent overwintering."
        ],
        "treatment": [
            "Apply copper-based bactericides or copper fungicides at the first sign of symptoms or during prolonged wet periods.",
            "Conduct weekly sprays of copper mixed with Mancozeb to increase effectiveness in warm, wet weather.",
            "Prune lower foliage (up to 12 inches from the ground) to increase airflow and accelerate drying.",
            "Apply organic options like Bacillus subtilis (biological control) to suppress bacterial colonization."
        ],
        "dosage_calculator": {
            "chemical_name": "Copper Fungicide + Mancozeb Mix",
            "dilution_rate": "2.5 grams per Liter of water",
            "water_per_acre": 400,
            "chemical_per_acre": 1.0,
            "spray_interval": "7 to 10 days in wet conditions"
        },
        "professional_tip": "Prune your tomato plants to have a single or double main stem and stake them off the ground. Air movement is the single greatest natural defense against bacterial spot!"
    },
    "Apple___Apple_scab": {
        "disease_name": "Apple Scab",
        "common_name": "Apple Scab",
        "crop": "Apple",
        "type": "Fungal Disease",
        "pathogen": "Venturia inaequalis",
        "severity": "Moderate to High",
        "symptoms": [
            "Olive-green to dark brown, velvety, circular spots on the upper surface of leaves.",
            "Spots become raised, puckered, and turn dark brown or black as they age.",
            "Severely infected leaves turn completely yellow and drop prematurely, weakening the tree.",
            "Rough, brown, corky, scab-like lesions form on the apple fruits, causing cracking."
        ],
        "causes": [
            "Fungal spores overwintering on fallen leaves on the orchard floor.",
            "Cool, wet spring weather (15°C - 24°C) with prolonged moisture on leaf surfaces.",
            "Poor air circulation inside dense tree canopies, delaying leaf drying after rain.",
            "High humidity promoting secondary spore release throughout the summer."
        ],
        "prevention": [
            "Thoroughly clean and destroy (burn or deeply bury) fallen leaves in autumn to disrupt the fungus lifecycle.",
            "Prune apple trees annually during winter to maintain an open canopy that allows sunlight and wind to dry leaves fast.",
            "Choose scab-resistant apple cultivars (such as Liberty, Enterprise, or Prima) when planting new orchards.",
            "Apply a thick layer of organic compost mulch under the canopy to cover any remaining leaf debris."
        ],
        "treatment": [
            "Apply preventative sulfur or copper sprays in early spring during green tip and petal fall stages.",
            "Use systematic fungicides (like Myclobutanil or Captan) to arrest active fungal infections.",
            "Spray liquid copper or lime-sulfur during the dormant season to kill overwintering spores on the wood."
        ],
        "dosage_calculator": {
            "chemical_name": "Captan 80 WDG Fungicide",
            "dilution_rate": "1.5 grams per Liter of water",
            "water_per_acre": 500,
            "chemical_per_acre": 0.75,
            "spray_interval": "10 to 14 days from pink bud to harvest"
        },
        "professional_tip": "Spraying a 5% urea solution onto the orchard leaves just before leaf fall in autumn accelerates leaf decomposition, depriving the scab fungus of its overwintering shelter."
    },
    "weed_broadleaf": {
        "disease_name": "Broadleaf Weed Invasion",
        "common_name": "Broadleaf Weeds (Dandelion, Clover, Chickweed, etc.)",
        "crop": "All Crops",
        "type": "Weed Infestation",
        "pathogen": "Various dicotyledonous weed species",
        "severity": "Moderate",
        "symptoms": [
            "Presence of non-crop plants with wide, flat leaves and netted veins growing in rows.",
            "Stunted crop growth due to aggressive competition for water, soil nutrients, and sunlight.",
            "Decline in crop yield, quality, and difficulty in mechanical harvesting."
        ],
        "causes": [
            "Weed seeds dispersed by wind, water, birds, animals, or contaminated organic compost.",
            "Bare, exposed soil beds and lack of ground cover or crop canopy.",
            "Over-tilling, which brings dormant, buried weed seeds to the surface where they germinate.",
            "Nutrient-deficient soils where weeds outcompete weak crops."
        ],
        "prevention": [
            "Maintain a thick, healthy crop canopy to block sunlight from reaching the soil and weed seeds.",
            "Apply a 2-3 inch layer of organic mulch (straw, woodchips, or leaves) or use black landscape fabric.",
            "Plant dense cover crops (like clover or winter rye) during fallow periods to suppress weed growth.",
            "Practice no-till or low-till farming methods to leave weed seeds buried and inactive."
        ],
        "treatment": [
            "Hand-pull or shallow-hoe weeds when they are small before they go to seed.",
            "Apply organic pre-emergent corn gluten meal to prevent weed seed germination in early spring.",
            "Use selective post-emergent organic herbicides (such as vinegar/acetic acid sprays or soap-based sprays).",
            "For large agricultural areas, use selective broadleaf herbicides safely under strict application guidelines."
        ],
        "dosage_calculator": {
            "chemical_name": "Organic Acetic Acid (Horticultural Vinegar)",
            "dilution_rate": "20% concentration (dilute 1:1 with water for young weeds)",
            "water_per_acre": 300,
            "chemical_per_acre": 150.0,
            "spray_interval": "Apply on sunny days; repeat in 7 days if necessary"
        },
        "professional_tip": "Always weed on a sunny, dry afternoon. Uprooted weeds will dehydrate and die in hours, whereas weeding on a damp morning allows them to re-root easily."
    },
    "Blueberry___healthy": {
        "disease_name": "Healthy Blueberry Leaf",
        "common_name": "Healthy Blueberry",
        "crop": "Blueberry",
        "type": "Healthy Plant",
        "pathogen": "None",
        "severity": "Low",
        "symptoms": [
            "Vibrant, deep green leaf color with no spots, lesions, or powdery patches.",
            "Uniform leaf texture, smooth margins, and solid, healthy stem connection.",
            "Vigorous growth with no signs of wilting or pest chewing."
        ],
        "causes": [
            "Ideal soil conditions with acidic pH maintained between 4.5 and 5.2.",
            "Balanced nutrient supply (especially iron and nitrogen in ammonium form).",
            "Consistent moisture supply without waterlogging the roots.",
            "Excellent air circulation and sunlight exposure (at least 6-8 hours daily)."
        ],
        "prevention": [
            "Test soil pH annually and apply elemental sulfur if pH rises above 5.3.",
            "Add a 3-inch layer of pine bark or peat moss mulch to retain moisture and keep soil acidic.",
            "Prune out old, non-productive canes (older than 6 years) to stimulate new healthy wood.",
            "Irrigate with rainwater or acidified water if local tap water is highly alkaline."
        ],
        "treatment": [
            "No treatment required! Excellent job maintaining plant health.",
            "Apply organic compost tea once in spring to boost beneficial soil micro-organisms.",
            "Keep monitoring for early indicators of aphids, scale insects, or birds during fruiting."
        ],
        "dosage_calculator": {
            "chemical_name": "Organic Fish Hydrolysate Fertilizer",
            "dilution_rate": "10 mL per Liter of water",
            "water_per_acre": 300,
            "chemical_per_acre": 3.0,
            "spray_interval": "Apply as soil drench every 3-4 weeks during the growing season"
        },
        "professional_tip": "Blueberry plants have shallow, fibrous roots. Applying a thick pine needle or wood chip mulch is essential to protect these roots from heat and conserve the acid environment they crave!"
    },
    "Grape___healthy": {
        "disease_name": "Healthy Grape Leaf",
        "common_name": "Healthy Grapevine",
        "crop": "Grape",
        "type": "Healthy Plant",
        "pathogen": "None",
        "severity": "Low",
        "symptoms": [
            "Clear, deep green leaves with characteristic distinct lobed shapes.",
            "Clean, smooth upper and lower leaf surfaces, devoid of any mildew, spots, or rot.",
            "Firm, upright leaves and healthy growing vine tendrils."
        ],
        "causes": [
            "Excellent canopy management (leaf pulling and shoot thinning) which maximizes sun penetration.",
            "Proper seasonal pruning (cane or spur pruning) during the dormant winter period.",
            "Deep, well-draining sandy loam soil and controlled deep watering.",
            "Regular scouting and clean orchard floor hygiene."
        ],
        "prevention": [
            "Prune vines annually to ensure only fruit-bearing wood remains and the canopy is highly ventilated.",
            "Apply a preventative organic copper or sulfur spray early in the season before blooms open.",
            "Maintain grass or cover crops between grape rows to reduce dust and soil-borne spore splashing.",
            "Harvest grape bunches promptly and clean up fallen fruit to prevent drawing pests."
        ],
        "treatment": [
            "No disease treatment needed. The grapevine is in pristine health!",
            "Apply organic kelp extract spray as a foliar mist to build natural heat and drought resilience.",
            "Regularly tuck shoots into trellis wires to maintain organized vine structures."
        ],
        "dosage_calculator": {
            "chemical_name": "Cold-Pressed Liquid Kelp Foliar Spray",
            "dilution_rate": "5 mL per Liter of water",
            "water_per_acre": 400,
            "chemical_per_acre": 2.0,
            "spray_interval": "Foliar mist every 14 days from early shoot growth to fruit set"
        },
        "professional_tip": "Grapes love sun and wind. Leaf pulling (removing leaves around grape clusters in early summer) allows the morning sun to dry dew instantly, making it impossible for mildews to take hold."
    },
    "weed_grass": {
        "disease_name": "Grassy Weed Invasion",
        "common_name": "Grassy Weeds (Crabgrass, Foxtail, Bluegrass, etc.)",
        "crop": "All Crops",
        "type": "Weed Infestation",
        "pathogen": "Various monocotyledonous grass species",
        "severity": "Moderate",
        "symptoms": [
            "Narrow, long, blade-like leaves with parallel veins emerging around crops.",
            "Dense grassy mats that crowd out seedlings and suffocate young root systems.",
            "Yellowing or nitrogen deficiency in crops as weeds aggressively consume nitrogen."
        ],
        "causes": [
            "Dispersal of thousands of tiny, wind-blown grass seeds.",
            "Bare patches in fields, thin planting density, or over-mowing crop borders.",
            "Warm temperatures and wet soil conditions promoting rapid grassy seed germination.",
            "Over-fertilization of nitrogen, which stimulates grass growth."
        ],
        "prevention": [
            "Use dense, narrow row spacing for crops to encourage fast canopy shading.",
            "Apply high-quality mulch (straw, wood chips, or cover crop residue) to starve grass seedlings of light.",
            "Mow adjacent pathways and field borders regularly to prevent grass weeds from heading and seeding.",
            "Implement drip irrigation directly to crop roots, keeping the surrounding soil dry to starve weed seeds."
        ],
        "treatment": [
            "Perform mechanical shallow cultivation (tilling/hoeing) when grass weeds are in the seedling stage.",
            "Apply pre-emergent grass herbicides in early spring before soil temperatures reach 12°C (55°F).",
            "Use selective post-emergent grass-killers (graminicides) which kill grasses but do not harm broadleaf crops."
        ],
        "dosage_calculator": {
            "chemical_name": "Clethodim (Selective Grass Herbicide)",
            "dilution_rate": "1.5 mL per Liter of water",
            "water_per_acre": 250,
            "chemical_per_acre": 0.375,
            "spray_interval": "Single application; repeat in 14 days if stubborn regrowth occurs"
        },
        "professional_tip": "Grass weeds are extremely difficult to pull once mature due to fibrous roots. Attack them when they are under 2 inches tall for simple, organic, hand-tool removal."
    },
    "weed_soil": {
        "disease_name": "Unmanaged Bare Soil & Weeds",
        "common_name": "Bare Soil Weed Emergence",
        "crop": "Fallow / Bed Preparation",
        "type": "Soil & Weed Management",
        "pathogen": "Erosion risk and wild weed sprouts",
        "severity": "Low to Moderate",
        "symptoms": [
            "Large areas of dry, exposed soil with erratic weed sprouts.",
            "Loss of topsoil organic matter, soil moisture evaporation, and surface cracking.",
            "Erosion from wind or water carrying away key agricultural nutrients."
        ],
        "causes": [
            "Leaving fields fallow without planting cover crops or applying mulch.",
            "Excessive tilling which destroys soil structure, depletes organic matter, and exposes seeds.",
            "Lack of proper cover management after harvesting the previous crop."
        ],
        "prevention": [
            "Plant cover crops (such as Crimson Clover, Daikon Radish, or Hairy Vetch) to protect and feed the soil.",
            "Cover empty beds with silage tarps (black plastic sheeting) to smother weeds naturally (occlusion).",
            "Apply a generous 3-inch organic mulch layer (leaves, wood chips, straw) to suppress weeds and retain soil moisture.",
            "Implement no-dig/no-till beds using rich compost layers on top."
        ],
        "treatment": [
            "Mow down emerging weeds before they flower, and leave the cuttings as protective green mulch.",
            "Use a flame weeder to run over tiny emerging weed seedlings for rapid chemical-free removal.",
            "Incorporate a light green manure cover crop into the top layer of soil to boost organic matter."
        ],
        "dosage_calculator": {
            "chemical_name": "Winter Rye Cover Crop Seed",
            "dilution_rate": "N/A (Direct soil seeding)",
            "water_per_acre": 0,
            "chemical_per_acre": 50.0,
            "spray_interval": "Once in early autumn or late summer"
        },
        "professional_tip": "Never leave agricultural soil naked. Bare soil loses microbial life, dries out, and naturally spawns weeds to cover itself. Always cover soil with mulch or living roots."
    },
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": {
        "disease_name": "Corn Gray Leaf Spot",
        "common_name": "Gray Leaf Spot of Corn",
        "crop": "Corn (Maize)",
        "type": "Fungal Disease",
        "pathogen": "Cercospora zeae-maydis / Cercospora zeina",
        "severity": "High",
        "symptoms": [
            "Tiny, tan, circular spots with yellow halos appearing on the lower leaves first.",
            "Spots expand into long, distinct, rectangular gray-to-tan lesions, running parallel to leaf veins.",
            "Fungal lesions take on a gray, velvety appearance under humid conditions due to spore production.",
            "Blighting of entire leaves, leading to premature crop death, stalk lodging, and reduced ear size."
        ],
        "causes": [
            "Fungal spores overwintering in infected corn crop debris left on the soil surface.",
            "Warm temperatures (24°C - 32°C / 75°F - 90°F) combined with high relative humidity (>90%).",
            "Prolonged periods of leaf wetness from rain, heavy dew, or overhead pivot irrigation.",
            "Continuous corn cropping without rotation, allowing fungal inoculum to build up in the soil."
        ],
        "prevention": [
            "Select and plant corn hybrids with high genetic resistance to Gray Leaf Spot.",
            "Practice a 1-to-2 year crop rotation with non-host crops (such as soybeans, alfalfa, or clover).",
            "Implement conservation tillage or crop residue management to bury corn debris, helping it decay faster.",
            "Improve field drainage and avoid planting in dense, low-lying fields prone to morning mists."
        ],
        "treatment": [
            "Scout corn leaves regularly from the whorl stage to silking; if lesions reach the ear leaf, treat immediately.",
            "Apply foliar fungicides (such as Strobilurin or Triazole compounds) at the tasseling (VT) or silking (R1) stage.",
            "Ensure thorough spray coverage using high-pressure equipment to reach the lower canopy."
        ],
        "dosage_calculator": {
            "chemical_name": "Trivapro Fungicide (Triazole + Strobilurin Mix)",
            "dilution_rate": "1.0 mL per Liter of water",
            "water_per_acre": 150,
            "chemical_per_acre": 0.15,
            "spray_interval": "Single application at tasseling to silking stage"
        },
        "professional_tip": "If Gray Leaf Spot is detected on the leaves *below* the corn ear leaf before tasseling, a fungicide spray is highly cost-effective. If detected after dent stage (R5), spraying is no longer economically beneficial."
    },
    "weed_soybean": {
        "disease_name": "Soybean Weed Competition",
        "common_name": "Weeds in Soybean Crops",
        "crop": "Soybean",
        "type": "Weed Infestation",
        "pathogen": "Palmer amaranth, waterhemp, ragweed, etc.",
        "severity": "Moderate to High",
        "symptoms": [
            "Invasive broadleaf or grass weeds intermingled with soybean rows.",
            "Yellowing, thinning, and lodging (bending over) of soybean stalks due to competition for nutrients.",
            "Difficulty during harvest, clogging combine harvesters, and lowering grain quality."
        ],
        "causes": [
            "Weeds developing herbicide resistance (especially to Glyphosate).",
            "Poor seedbed preparation and early weed emergence preceding soybean germination.",
            "Excessive spacing between rows, leading to delayed canopy shade formation.",
            "Persistent wet weather that delays mechanical cultivation."
        ],
        "prevention": [
            "Adopt narrow row spacing (15 inches instead of 30 inches) to achieve rapid canopy closure and block weeds.",
            "Use high-residue cover crops (like winter cereal rye) which chemically suppress weeds through allelopathy.",
            "Clean agricultural equipment before transferring to other fields to prevent spreading weed seeds.",
            "Rotate crops annually with corn, wheat, or cover crops to break weed reproduction cycles."
        ],
        "treatment": [
            "Apply pre-emergence residual herbicides immediately after planting soybeans to control early-season weeds.",
            "Perform mechanical inter-row cultivation using a rotary hoe when soybeans are young.",
            "Use targeted post-emergence herbicides (like Glufosinate or Dicamba) strictly on matching herbicide-tolerant soybean varieties."
        ],
        "dosage_calculator": {
            "chemical_name": "Glufosinate-ammonium (Liberty Herbicide)",
            "dilution_rate": "3.0 mL per Liter of water",
            "water_per_acre": 200,
            "chemical_per_acre": 0.6,
            "spray_interval": "Apply when weeds are under 3 inches; avoid spraying during soybean bloom"
        },
        "professional_tip": "Cereal rye is the best friend of a soybean farmer. Planting soybeans directly into standing rye, then rolling it flat, creates a beautiful natural weed-barrier carpet that lasts all season."
    }
}

# =========================================================
# FLASK ROUTING AND LOGIC
# =========================================================

@app.route("/")
def home():
    """Serves the main single-page application dashboard."""
    return render_template("index.html")

@app.route("/classes", methods=["GET"])
def get_classes():
    """Exposes our comprehensive agronomy database to the frontend."""
    return jsonify(DISEASE_DB)

@app.route("/predict", methods=["POST"])
def predict():
    """
    Accepts an uploaded image.
    1. Validates whether the image is actually a plant leaf (using MobileNetV2).
    2. Runs custom leaf disease / weed classification (using model.keras).
    3. Merges predicted class with rich agronomic tips and returns JSON.
    """
    if "image" not in request.files:
        return jsonify({"error": "No image file uploaded."}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No selected file."}), 400

    try:
        # Load and convert image to standard RGB format
        img = Image.open(file).convert("RGB")

        # =====================================================
        # 1. IMAGE VALIDATION (MobileNetV2 check)
        # =====================================================
        if validator_model is not None:
            # MobileNetV2 expects 224x224 input
            val_img = img.resize((224, 224))
            val_arr = np.array(val_img)
            val_arr = preprocess_input(val_arr)
            val_arr = np.expand_dims(val_arr, axis=0)

            val_prediction = validator_model.predict(val_arr, verbose=0)
            decoded = decode_predictions(val_prediction, top=1)[0][0]
            predicted_label = decoded[1].lower()

            # Define valid keywords that identify plant-related materials
            leaf_keywords = [
                "leaf", "plant", "tree", "flower", "vegetable", "fruit",
                "buckeye", "acorn", "sprout", "wood", "moss", "forest"
            ]
            is_leaf = any(kw in predicted_label for kw in leaf_keywords)

            # Additional override: if MobileNet V2 guesses something clearly agricultural
            # e.g., 'corn', 'zucchini', 'cabbage', 'head_cabbage', 'potpot', 'fig'
            agri_keywords = [
                "corn", "maize", "tomato", "apple", "grape", "blueberry",
                "soybean", "weed", "cabbage", "zucchini", "cucumber", "pot"
            ]
            if not is_leaf:
                is_leaf = any(kw in predicted_label for kw in agri_keywords)

            if not is_leaf:
                # Format label for user readability
                user_friendly_label = predicted_label.replace("_", " ").title()
                return jsonify({
                    "isValid": False,
                    "label": user_friendly_label,
                    "error_message": f"Add leaf image: it's not valid. Detected object: {user_friendly_label}."
                })
        else:
            predicted_label = "unknown"

        # =====================================================
        # 2. CROP DISEASE / WEED PREDICTION (model.keras)
        # =====================================================
        if model is None or len(features) == 0:
            return jsonify({"error": "Main prediction model or labels are not loaded."}), 500

        # Resize image to the verified 256x256 shape required by model.keras
        target_size = (256, 256)
        resized_img = img.resize(target_size)
        img_arr = np.array(resized_img)

        # Normalize pixel values
        img_arr = img_arr / 255.0
        img_arr = np.expand_dims(img_arr, axis=0)

        # Execute prediction
        prediction = model.predict(img_arr, verbose=0)[0]
        predicted_idx = int(np.argmax(prediction))

        # Safely clip to label count to prevent indexing crashes
        if predicted_idx >= len(features):
            predicted_idx = 0

        predicted_class = features[predicted_idx]
        confidence = float(prediction[predicted_idx] * 100)

        # =====================================================
        # 3. CONSTRUCT DETAILED RESPONSE
        # =====================================================
        disease_info = DISEASE_DB.get(predicted_class, {
            "disease_name": predicted_class.replace("___", " ").replace("_", " "),
            "common_name": predicted_class.replace("___", " ").replace("_", " "),
            "crop": predicted_class.split("___")[0].replace("_", " ") if "___" in predicted_class else "Unknown",
            "type": "Unknown Condition",
            "pathogen": "N/A",
            "severity": "Medium",
            "symptoms": ["Irregular symptoms noticed", "Abnormal leaf changes"],
            "causes": ["Unfavorable local microclimate", "Environmental influences"],
            "prevention": ["Scout fields regularly", "Observe crop rotations"],
            "treatment": ["Prune out unhealthy leaves", "Maintain general field hygiene"],
            "dosage_calculator": {
                "chemical_name": "Organic Neem Oil Spray",
                "dilution_rate": "5 mL per Liter of water",
                "water_per_acre": 200,
                "chemical_per_acre": 1.0,
                "spray_interval": "7 to 10 days"
            },
            "professional_tip": "Keep a close eye on soil moisture levels and ensure proper field sanitization."
        })

        return jsonify({
            "isValid": True,
            "label": predicted_label.replace("_", " ").title(),
            "prediction": predicted_class,
            "confidence": round(confidence, 2),
            "disease_info": disease_info
        })

    except Exception as e:
        return jsonify({"error": f"Failed to process image: {str(e)}"}), 500

# =========================================================
# APPLICATION INITIALIZER
# =========================================================

if __name__ == "__main__":
    print("--> Launching Flask server on http://127.0.0.1:5000...")
    app.run(debug=False, host="0.0.0.0", port=5000)