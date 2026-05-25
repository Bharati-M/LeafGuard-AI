/* =========================================================
   CROPGUARD AI - CLIENT-SIDE CONTROLLER LOGIC
   ========================================================= */

// --- Global Application State ---
let appClasses = {};
let currentAnalysisResult = null;
let uploadedFile = null;

// --- DOM Element Registrations ---
document.addEventListener("DOMContentLoaded", () => {
    // Lucide Icons Initialization
    lucide.createIcons();

    // 1. SPA View Router Binding
    const navButtons = document.querySelectorAll(".nav-btn");
    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-target");
            switchView(target);
        });
    });

    // 2. Drag & Drop File Listeners
    setupDragAndDrop();

    // 3. Scan & Diagnostics Trigger
    const scanBtn = document.getElementById("scanBtn");
    scanBtn.addEventListener("click", runDiagnostics);

    // 4. Tab Switches inside Results Card
    setupResultTabs();

    // 5. Drawer Closure Listener
    const drawerOverlay = document.getElementById("encyclopedia-drawer");
    drawerOverlay.addEventListener("click", (e) => {
        if (e.target === drawerOverlay) {
            closeDrawer();
        }
    });

    // 6. Action Reports Binding
    document.getElementById("downloadReportBtn").addEventListener("click", downloadReport);
    document.getElementById("printReportBtn").addEventListener("click", printReport);

    // 7. Load Agronomy Database and Setup Hub
    loadAgronomyDatabase();
});

// =========================================================
// 1. SPA ROUTING VIEW SWITCHER
// =========================================================
function switchView(viewId) {
    // Deactivate all sections
    const sections = document.querySelectorAll(".view-section");
    sections.forEach(sec => sec.classList.remove("active"));

    // Activate selected section
    const activeSec = document.getElementById(viewId);
    if (activeSec) {
        activeSec.classList.add("active");
    }

    // Toggle active state in navigation
    const navBtns = document.querySelectorAll(".nav-btn");
    navBtns.forEach(btn => {
        btn.classList.remove("active");
        if (btn.getAttribute("data-target") === viewId) {
            btn.classList.add("active");
        }
    });

    // Re-trigger icon rendering
    lucide.createIcons();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// =========================================================
// 2. FILE UPLOADER & DRAG-AND-DROP CONTROLLER
// =========================================================
function setupDragAndDrop() {
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("fileInput");
    const scanBtn = document.getElementById("scanBtn");
    const removeFileBtn = document.getElementById("removeFileBtn");
    const imagePreview = document.getElementById("imagePreview");
    const dropzonePrompt = document.getElementById("dropzone-prompt");
    const dropzonePreview = document.getElementById("dropzone-preview");

    // Click on dropzone opens local file browser
    dropzone.addEventListener("click", (e) => {
        if (e.target !== removeFileBtn && !removeFileBtn.contains(e.target)) {
            fileInput.click();
        }
    });

    // Traditional file selector change
    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    // Drag-over styling hooks
    ["dragenter", "dragover"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.add("dragover");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.remove("dragover");
        }, false);
    });

    // Handle dropped files
    dropzone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    // Remove file action
    removeFileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.value = "";
        uploadedFile = null;
        imagePreview.src = "";
        dropzonePreview.style.display = "none";
        dropzonePrompt.style.display = "flex";
        scanBtn.disabled = true;
        resetDetector();
    });
}

function handleFileSelect(file) {
    const scanBtn = document.getElementById("scanBtn");
    const imagePreview = document.getElementById("imagePreview");
    const dropzonePrompt = document.getElementById("dropzone-prompt");
    const dropzonePreview = document.getElementById("dropzone-preview");

    // Check file type
    if (!file.type.startsWith("image/")) {
        alert("Please upload a valid image file (JPG, PNG).");
        return;
    }

    uploadedFile = file;
    scanBtn.disabled = false;

    // Load file preview
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        dropzonePrompt.style.display = "none";
        dropzonePreview.style.display = "block";
    };
    reader.readAsDataURL(file);
}

// =========================================================
// 3. SCAN & NEURAL SCANNERS TRIGGER
// =========================================================
function runDiagnostics() {
    if (!uploadedFile) return;

    // Retrieve Panel Elements
    const emptyState = document.getElementById("panel-empty");
    const loaderState = document.getElementById("panel-loader");
    const warningState = document.getElementById("panel-warning");
    const resultsState = document.getElementById("panel-results");
    const loaderStatus = document.getElementById("loader-status");

    // Transition views to loader state
    emptyState.style.display = "none";
    warningState.style.display = "none";
    resultsState.style.display = "none";
    loaderState.style.display = "block";

    // Set stage status triggers
    loaderStatus.innerText = "Pre-processing tissues & validating leaf morphology...";

    setTimeout(() => {
        loaderStatus.innerText = "Aligning cells & invoking Convolutional Neural Network...";
    }, 1000);

    // Prepare HTTP Multi-part form payload
    const formData = new FormData();
    formData.append("image", uploadedFile);

    fetch("/predict", {
        method: "POST",
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Diagnostics API encountered a severe execution error.");
        }
        return response.json();
    })
    .then(data => {
        loaderState.style.display = "none";

        if (data.isValid === false) {
            // Morph validation failed
            document.getElementById("warning-message").innerText = data.error_message;
            warningState.style.display = "block";
            lucide.createIcons();
            return;
        }

        // Successfully diagnosed!
        currentAnalysisResult = data;
        renderDiagnosticsResult(data);
    })
    .catch(error => {
        loaderState.style.display = "none";
        alert(`Diagnostics Failed: ${error.message}`);
        resetDetector();
    });
}

function resetDetector() {
    document.getElementById("panel-empty").style.display = "flex";
    document.getElementById("panel-loader").style.display = "none";
    document.getElementById("panel-warning").style.display = "none";
    document.getElementById("panel-results").style.display = "none";
    currentAnalysisResult = null;
}

// =========================================================
// 4. POPULATE DIAGNOSTIC SCAN REPORT
// =========================================================
function renderDiagnosticsResult(data) {
    const resultsState = document.getElementById("panel-results");
    resultsState.style.display = "block";

    // Format Class Name nicely for the interface title
    // e.g., 'Tomato___Bacterial_spot' -> 'Tomato Bacterial Spot'
    // e.g., 'weed_broadleaf' -> 'Broadleaf Weed Invasion'
    let prettyTitle = data.prediction.replace("___", " ").replace("_", " ");
    if (prettyTitle.includes("healthy") || prettyTitle.includes("Healthy")) {
        prettyTitle = prettyTitle.replace("healthy", "Leaf").replace("Healthy", "Leaf") + " (Healthy)";
    }
    document.getElementById("res-disease-name").innerText = prettyTitle;

    // Badges population
    const healthBadge = document.getElementById("res-health-status");
    const severityBadge = document.getElementById("res-severity");

    const isHealthy = prettyTitle.toLowerCase().includes("healthy");
    healthBadge.innerText = isHealthy ? "Healthy" : "Infected";
    healthBadge.className = "status-badge" + (isHealthy ? "" : " infected");

    const severity = data.disease_info.severity;
    severityBadge.innerText = `${severity} Severity`;
    severityBadge.className = "severity-badge " + severity.toLowerCase();

    // Pathogen & Confidence Circular Ring styling
    document.getElementById("res-pathogen").innerText = data.disease_info.pathogen;
    document.getElementById("res-confidence").innerText = `${data.confidence}%`;
    
    // Dynamically adjust conic conic-gradient ring based on confidence
    const ring = document.querySelector(".gauge-ring");
    ring.style.background = `radial-gradient(closest-side, #0f172a 75%, transparent 0%), conic-gradient(var(--primary) ${data.confidence}%, rgba(255,255,255,0.05) 0%)`;

    // Symptoms
    const symptomsList = document.getElementById("res-symptoms");
    symptomsList.innerHTML = "";
    data.disease_info.symptoms.forEach(item => {
        const li = document.createElement("li");
        li.innerText = item;
        symptomsList.appendChild(li);
    });

    // Causes
    const causesList = document.getElementById("res-causes");
    causesList.innerHTML = "";
    data.disease_info.causes.forEach(item => {
        const li = document.createElement("li");
        li.innerText = item;
        causesList.appendChild(li);
    });

    // Prevention
    const prevList = document.getElementById("res-prevention");
    prevList.innerHTML = "";
    data.disease_info.prevention.forEach(item => {
        const li = document.createElement("li");
        li.innerText = item;
        prevList.appendChild(li);
    });

    // Treatment
    const treatList = document.getElementById("res-treatment");
    treatList.innerHTML = "";
    data.disease_info.treatment.forEach(item => {
        const li = document.createElement("li");
        li.innerText = item;
        treatList.appendChild(li);
    });

    // Tip
    document.getElementById("res-professional-tip").innerText = data.disease_info.professional_tip;

    // Load Lucide Icons in updated content
    lucide.createIcons();

    // Auto-update crop selector inside calculation page to this diagnosis!
    const calCropSelect = document.getElementById("cal-crop");
    if (calCropSelect) {
        calCropSelect.value = data.prediction;
        // Trigger recalculated metrics instantly
        calculateSprayerCalibration();
    }
}

// Result profile/management tabs toggle
function setupResultTabs() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const targetContentId = btn.getAttribute("data-sub");
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            document.getElementById(targetContentId).classList.add("active");
        });
    });
}

// =========================================================
// 5. CROP HUB - AGRONOMY ENCYCLOPEDIA & DRAWER
// =========================================================
function loadAgronomyDatabase() {
    fetch("/classes")
    .then(res => res.json())
    .then(database => {
        appClasses = database;
        
        // Render Encyclopedia
        renderEncyclopedia(database);

        // Bind Search filtering listeners
        const searchInput = document.getElementById("encyclopedia-search");
        searchInput.addEventListener("input", (e) => {
            filterEncyclopedia(e.target.value);
        });

        // Setup dosage selector options
        setupDosageSelector(database);
    })
    .catch(err => console.error("Error loading agronomy DB:", err));
}

function renderEncyclopedia(database) {
    const grid = document.getElementById("encyclopedia-grid");
    grid.innerHTML = "";

    Object.keys(database).forEach(key => {
        const info = database[key];
        
        let prettyName = info.disease_name;
        if (prettyName.toLowerCase().includes("healthy")) {
            prettyName = prettyName.replace("healthy", "Leaf").replace("Healthy", "Leaf") + " (Healthy)";
        }

        const card = document.createElement("div");
        card.className = "ency-card";
        card.setAttribute("data-search", `${info.crop} ${info.disease_name} ${info.type}`.toLowerCase());

        card.innerHTML = `
            <div class="ency-header">
                <span class="ency-crop">${info.crop}</span>
                <span class="ency-severity ${info.severity.toLowerCase()}">${info.severity} Severity</span>
            </div>
            <h3 class="ency-title">${prettyName}</h3>
            <span class="ency-pathogen font-code">Pathogen: ${info.pathogen}</span>
            <p class="ency-desc">${info.symptoms[0]}</p>
            <button class="ency-action" onclick="openDrawer('${key}')">View Expert Profile</button>
        `;

        grid.appendChild(card);
    });
}

function filterEncyclopedia(query) {
    const cards = document.querySelectorAll(".ency-card");
    const cleanQuery = query.toLowerCase().trim();

    cards.forEach(card => {
        const searchStr = card.getAttribute("data-search");
        if (searchStr.includes(cleanQuery)) {
            card.style.display = "flex";
        } else {
            card.style.display = "none";
        }
    });
}

// Drawer overlay controller
function openDrawer(classKey) {
    const info = appClasses[classKey];
    if (!info) return;

    let prettyTitle = info.disease_name;
    if (prettyTitle.toLowerCase().includes("healthy")) {
        prettyTitle = prettyTitle.replace("healthy", "Leaf").replace("Healthy", "Leaf") + " (Healthy)";
    }

    document.getElementById("drawer-title").innerText = prettyTitle;
    document.getElementById("drawer-crop").innerText = info.crop;
    
    const severityBadge = document.getElementById("drawer-severity");
    severityBadge.innerText = `${info.severity} Severity`;
    severityBadge.className = "severity-badge " + info.severity.toLowerCase();

    document.getElementById("drawer-pathogen").innerText = info.pathogen;
    document.getElementById("drawer-type").innerText = info.type;

    // Render lists helper
    const populateList = (elementId, items) => {
        const ul = document.getElementById(elementId);
        ul.innerHTML = "";
        items.forEach(item => {
            const li = document.createElement("li");
            li.innerText = item;
            ul.appendChild(li);
        });
    };

    populateList("drawer-symptoms", info.symptoms);
    populateList("drawer-causes", info.causes);
    populateList("drawer-prevention", info.prevention);
    populateList("drawer-treatment", info.treatment);

    document.getElementById("drawer-tip").innerText = info.professional_tip;

    // Activate slide drawer
    document.getElementById("encyclopedia-drawer").classList.add("active");
    document.body.style.overflow = "hidden"; // Disable background scrolling
    lucide.createIcons();
}

function closeDrawer() {
    document.getElementById("encyclopedia-drawer").classList.remove("active");
    document.body.style.overflow = ""; // Re-enable background scrolling
}

// =========================================================
// 6. AGRONOMY APPLICATION DOSAGE CALCULATOR
// =========================================================
function setupDosageSelector(database) {
    const select = document.getElementById("cal-crop");
    select.innerHTML = "";

    Object.keys(database).forEach(key => {
        const info = database[key];
        let prettyName = `${info.crop} — ${info.disease_name}`;
        if (info.disease_name.toLowerCase().includes("healthy")) {
            prettyName = `${info.crop} (Healthy Leaf Standard)`;
        }
        
        const opt = document.createElement("option");
        opt.value = key;
        opt.innerText = prettyName;
        select.appendChild(opt);
    });

    // Bind recalculate actions on inputs
    const inputs = ["cal-crop", "cal-area", "cal-unit", "cal-method"];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener("input", calculateSprayerCalibration);
    });

    // Also trigger initial calculation
    calculateSprayerCalibration();
}

function calculateSprayerCalibration() {
    const cropKey = document.getElementById("cal-crop").value;
    const area = parseFloat(document.getElementById("cal-area").value);
    const unit = document.getElementById("cal-unit").value;
    const method = document.getElementById("cal-method").value;

    const info = appClasses[cropKey];
    if (!info || isNaN(area) || area <= 0) return;

    const calculator = info.dosage_calculator;

    // Convert area to Acres
    let acres = area;
    if (unit === "hectares") {
        acres = area * 2.47105;
    } else if (unit === "sq_meters") {
        acres = area / 4046.86;
    }

    // Baseline values from database
    const baseWater = calculator.water_per_acre;      // liters
    const baseChemical = calculator.chemical_per_acre; // kg or liters or units

    // Modifiers based on spraying nozzle equipment type
    let waterModifier = 1.0;
    let chemModifier = 1.0;
    let nozzleText = "Hollow Cone Nozzle (fine droplets)";
    let pressureText = "Medium (2.0 to 3.0 Bar)";

    if (method === "knapsack") {
        waterModifier = 1.0;
        chemModifier = 1.0;
        nozzleText = "Hollow Cone Nozzle (excellent leaf coverage)";
        pressureText = "Low-Medium (1.5 to 2.5 Bar)";
    } else if (method === "tractor") {
        waterModifier = 1.25; // boom sprayers require higher fluid volume due to speed drift
        chemModifier = 1.05;
        nozzleText = "Flat Fan Nozzle (low-drift, uniform spray)";
        pressureText = "Medium-High (3.0 to 4.0 Bar)";
    } else if (method === "drone") {
        waterModifier = 0.08; // Drone systems use ultra-concentrated low-volume formulations
        chemModifier = 0.95;  // Highly targeted, reduces waste slightly
        nozzleText = "Centrifugal Rotary Nozzle (droplet size calibration)";
        pressureText = "Calibrated Electronic Control";
    }

    // Perform final Math calculations
    const finalWater = Math.ceil(baseWater * acres * waterModifier);
    const finalChem = baseChemical * acres * chemModifier;

    // Render results
    const waterOut = document.getElementById("cal-out-water");
    const chemOut = document.getElementById("cal-out-chem");
    const chemLabel = document.getElementById("cal-out-chem-label");

    // Dynamic Labels (Chemical or Organic Neem Oil/Seeds)
    const isOrganic = calculator.chemical_name.toLowerCase().includes("organic") || calculator.chemical_name.toLowerCase().includes("seed") || calculator.chemical_name.toLowerCase().includes("kelp");
    chemLabel.innerHTML = `${calculator.chemical_name} <span class="badge-container"><span class="severity-badge low">${isOrganic ? "Organic" : "Chemical"}</span></span>`;

    // Water Formatting
    waterOut.innerText = `${finalWater} Liters`;

    // Chemical/Liquid Formatting
    if (finalChem === 0) {
        chemOut.innerText = "0 (Not Required)";
    } else if (calculator.chemical_name.includes("Seed")) {
        chemOut.innerText = `${finalChem.toFixed(1)} kg of seed`;
    } else if (isOrganic) {
        // If organic, represent in Liters/mL
        if (finalChem >= 1.0) {
            chemOut.innerText = `${finalChem.toFixed(2)} Liters`;
        } else {
            chemOut.innerText = `${(finalChem * 1000).toFixed(0)} mL`;
        }
    } else {
        // Chemical fungicide represent in kg or grams
        if (finalChem >= 1.0) {
            chemOut.innerText = `${finalChem.toFixed(2)} kg`;
        } else {
            chemOut.innerText = `${(finalChem * 1000).toFixed(0)} grams`;
        }
    }

    // Detail parameters rendering
    document.getElementById("cal-out-dilution").innerText = calculator.dilution_rate;
    document.getElementById("cal-out-pressure").innerText = pressureText;
    document.getElementById("cal-out-nozzle").innerText = nozzleText;
    document.getElementById("cal-out-interval").innerText = calculator.spray_interval;

    // Toggle tab colors based on organic standard
    const intervalBadge = document.getElementById("cal-out-interval");
    if (isOrganic) {
        intervalBadge.className = "text-green";
    } else {
        intervalBadge.className = "text-yellow";
    }
}

// Tab switches in Crop Hub
const hubTabButtons = document.querySelectorAll(".hub-tab-btn");
hubTabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        hubTabButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const targetSubId = btn.getAttribute("data-sub");
        document.querySelectorAll(".hub-sub-content").forEach(c => c.classList.remove("active"));
        document.getElementById(targetSubId).classList.add("active");

        lucide.createIcons();
    });
});

// =========================================================
// 7. COMPILING DOWNLOADABLE FIELD REPORTS
// =========================================================
function downloadReport() {
    if (!currentAnalysisResult) return;

    const data = currentAnalysisResult;
    const info = data.disease_info;

    let prettyTitle = data.prediction.replace("___", " ").replace("_", " ");
    const isHealthy = prettyTitle.toLowerCase().includes("healthy");
    if (isHealthy) {
        prettyTitle = prettyTitle.replace("healthy", "Leaf").replace("Healthy", "Leaf") + " (Healthy)";
    }

    const reportContent = `========================================================================
                    CROPGUARD AI - FIELD DIAGNOSTICS REPORT
========================================================================
Timestamp       : ${new Date().toLocaleString()}
Identified Crop : ${info.crop}
Diagnosis       : ${prettyTitle}
Health Status   : ${isHealthy ? "HEALTHY - No Infection Detected" : "INFECTED"}
Confidence      : ${data.confidence}%
Severity Level  : ${info.severity}
Pathogen Agent  : ${info.pathogen}
Condition Type  : ${info.type}
------------------------------------------------------------------------

🩺 PRIMARY SYMPTOMS:
${info.symptoms.map(s => `  • ${s}`).join("\n")}

⚠️ WHY IT OCCURRED (CAUSES):
${info.causes.map(c => `  • ${c}`).join("\n")}

🛡️ RECOMMENDED PREVENTION STRATEGIES:
${info.prevention.map(p => `  • ${p}`).join("\n")}

💉 PRESCRIBED FIELD TREATMENTS:
${info.treatment.map(t => `  • ${t}`).join("\n")}

🧪 CALIBRATED SPRAYER DOSAGE PARAMETERS (Per Acre):
  • Recommended product : ${info.dosage_calculator.chemical_name}
  • Standard dilution   : ${info.dosage_calculator.dilution_rate}
  • Water volume / Acre : ${info.dosage_calculator.water_per_acre} Liters
  • Product rate / Acre : ${info.dosage_calculator.chemical_per_acre} ${isHealthy ? "Units" : (info.dosage_calculator.chemical_name.toLowerCase().includes("neem") || info.dosage_calculator.chemical_name.toLowerCase().includes("kelp") ? "Liters" : "kg")}
  • Application cycle   : ${info.dosage_calculator.spray_interval}

------------------------------------------------------------------------
💡 PROFESSIONAL FARMING TIP:
"${info.professional_tip}"

========================================================================
This report was compiled and digitally verified by the CropGuard AI 
Neural Diagnostics Engine. Use for precise agronomic monitoring.
========================================================================`;

    const blob = new Blob([reportContent], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    
    // Clean filename
    const cleanFilename = prettyTitle.replace(/[\s()]/g, "_");
    link.download = `CropGuard_Field_Report_${cleanFilename}.txt`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Print Window handler
function printReport() {
    if (!currentAnalysisResult) return;

    const data = currentAnalysisResult;
    const info = data.disease_info;
    let prettyTitle = data.prediction.replace("___", " ").replace("_", " ");
    const isHealthy = prettyTitle.toLowerCase().includes("healthy");
    if (isHealthy) {
        prettyTitle = prettyTitle.replace("healthy", "Leaf").replace("Healthy", "Leaf") + " (Healthy)";
    }

    // Open a new clean printable tab
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
        <html>
        <head>
            <title>CropGuard AI - Field Diagnosis Report</title>
            <style>
                body {
                    font-family: 'Helvetica Neue', Arial, sans-serif;
                    color: #1e293b;
                    padding: 40px;
                    line-height: 1.6;
                }
                .report-container {
                    max-width: 800px;
                    margin: 0 auto;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 40px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #10b981;
                    padding-bottom: 25px;
                    margin-bottom: 30px;
                }
                .header h1 {
                    color: #0f172a;
                    margin: 0;
                    font-size: 28px;
                    font-weight: 800;
                }
                .header p {
                    color: #64748b;
                    margin: 5px 0 0;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .meta-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }
                .meta-table td {
                    padding: 10px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .meta-table td.label {
                    font-weight: bold;
                    color: #64748b;
                    width: 30%;
                }
                .meta-table td.val {
                    color: #0f172a;
                    font-weight: 600;
                }
                .section {
                    margin-bottom: 25px;
                }
                .section h3 {
                    border-left: 4px solid #10b981;
                    padding-left: 10px;
                    color: #0f172a;
                    margin-bottom: 12px;
                    font-size: 16px;
                }
                .list {
                    padding-left: 20px;
                }
                .list li {
                    margin-bottom: 8px;
                }
                .tip-box {
                    background: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    border-radius: 8px;
                    padding: 15px 20px;
                    margin-top: 30px;
                }
                .tip-box strong {
                    color: #15803d;
                    display: block;
                    margin-bottom: 4px;
                }
                .footer {
                    text-align: center;
                    margin-top: 40px;
                    font-size: 12px;
                    color: #94a3b8;
                    border-top: 1px solid #f1f5f9;
                    padding-top: 20px;
                }
                @media print {
                    body { padding: 0; }
                    .report-container { border: none; box-shadow: none; padding: 0; }
                }
            </style>
        </head>
        <body onload="window.print();">
            <div class="report-container">
                <div class="header">
                    <h1>CROPGUARD AI FIELD REPORT</h1>
                    <p>Verified Agronomic Health Diagnostic Document</p>
                </div>
                <table class="meta-table">
                    <tr>
                        <td class="label">Compiled Timestamp</td>
                        <td class="val">${new Date().toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td class="label">Identified Crop</td>
                        <td class="val">${info.crop}</td>
                    </tr>
                    <tr>
                        <td class="label">Diagnosis Profile</td>
                        <td class="val">${prettyTitle}</td>
                    </tr>
                    <tr>
                        <td class="label">Current Status</td>
                        <td class="val">${isHealthy ? "HEALTHY - Good Condition" : "INFECTED — Requires Attention"}</td>
                    </tr>
                    <tr>
                        <td class="label">AI Scanner Confidence</td>
                        <td class="val">${data.confidence}%</td>
                    </tr>
                    <tr>
                        <td class="label">Severity Level</td>
                        <td class="val" style="color: ${info.severity === "High" ? "#ef4444" : (info.severity === "Medium" ? "#f59e0b" : "#10b981")}">${info.severity}</td>
                    </tr>
                    <tr>
                        <td class="label">Pathogen Agent</td>
                        <td class="val font-code">${info.pathogen}</td>
                    </tr>
                </table>

                <div class="section">
                    <h3>🩺 Primary Symptoms</h3>
                    <ul class="list">
                        ${info.symptoms.map(s => `<li>${s}</li>`).join("")}
                    </ul>
                </div>

                <div class="section">
                    <h3>⚠️ Biological / Environmental Causes</h3>
                    <ul class="list">
                        ${info.causes.map(c => `<li>${c}</li>`).join("")}
                    </ul>
                </div>

                <div class="section">
                    <h3>🛡️ Long-Term Prevention Strategies</h3>
                    <ul class="list">
                        ${info.prevention.map(p => `<li>${p}</li>`).join("")}
                    </ul>
                </div>

                <div class="section">
                    <h3>💉 Immediate Treatment Interventions</h3>
                    <ul class="list">
                        ${info.treatment.map(t => `<li>${t}</li>`).join("")}
                    </ul>
                </div>

                <div class="section">
                    <h3>🧪 Calibrated Sprayer Calibration Recommendation (Per Acre)</h3>
                    <ul class="list">
                        <li><strong>Target product:</strong> ${info.dosage_calculator.chemical_name} (${isOrganic ? "Organic Botanical Solution" : "Chemical Treatment"})</li>
                        <li><strong>Mixing Dilution:</strong> ${info.dosage_calculator.dilution_rate}</li>
                        <li><strong>Water carrier rate per acre:</strong> ${info.dosage_calculator.water_per_acre} Liters</li>
                        <li><strong>Active product rate per acre:</strong> ${info.dosage_calculator.chemical_per_acre} ${isHealthy ? "Units" : (info.dosage_calculator.chemical_name.toLowerCase().includes("neem") || info.dosage_calculator.chemical_name.toLowerCase().includes("kelp") ? "Liters" : "kg")}</li>
                        <li><strong>Ideal spraying frequency:</strong> ${info.dosage_calculator.spray_interval}</li>
                    </ul>
                </div>

                <div class="tip-box">
                    <strong>💡 Professional Farming Tip:</strong>
                    "${info.professional_tip}"
                </div>

                <div class="footer">
                    This document is digitally certified by CropGuard AI Systems. <br>
                    Use precise calculations and follow regional spraying standards.
                </div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}
