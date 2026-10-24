# No Man's Agriculture, Bakery & Foundry

An advanced, interactive React and Tailwind CSS companion app for *No Man's Sky* designed to eliminate spreadsheet fatigue. Whether you are scaling up a 20-biodome agricultural farm, running multi-stage dairy and sugar batches through the Nutrient Processor, or engineering 15.6 Million Unit Stasis Devices and Fusion Ignitors, this app visualizes your entire production pipeline as a live circuit board.

![App Preview](https://img.shields.io/badge/Status-Active%20Development-cyan) ![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Vite%20%7C%20Tailwind%20%7C%20Supabase-purple)

---

## Key Features

* **Tier-0 Agriculture & Outpost Engine:** Configure your biodome layouts and gas extractors. Click **Harvest All Biodomes** or collect livestock yields to automatically restock your pantry inventory.
* **Nutrient Processor 50-Stack Calculator:** Automatically breaks down multi-stage baking recipes (like *The Stellarator* and *Anomalous Doughnuts*) into 50-stack processor cycles and warns you about multi-branch ingredient splits (such as splitting Cream between Churned Butter and Stellar Custard).
* **Bidirectional SVG Pipe Bracket:** Click any ingredient or sub-assembly to instantly illuminate its upstream supply chain in glowing purple or its downstream outputs in amber, complete with live Bezier connector pipes.
* **Smart Regrowth Timers & 1:1 Refiner Doublers:** Tracks exact harvest run ETAs and provides one-click refiner expansion shortcuts when crops are short.
* **Dual Crafting Modes:** Toggle seamlessly between **Baking & Buffs** (Nutrient Ingestor passive stat bonuses) and **Industrial Mega-Crafts** (Stasis Devices and Fusion Ignitors).
* **Multi-Device Cloud Sync:** Built on Supabase Auth and PostgreSQL JSONB tables so your inventory and active batch progress sync instantly across desktop, tablet, and mobile devices.

---

## Tech Stack

* **Frontend:** React, Vite, Tailwind CSS
* **Icons:** `lucide-react`
* **Database & Auth:** Supabase (PostgreSQL with Row Level Security)
* **Hosting:** GitHub Pages / Vercel

