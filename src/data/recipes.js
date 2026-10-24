export const RECIPES = {
    // Baking Staples
    glass_grains: [{ id: 'frost_crystal', qty: 1 }],
    refined_flour: [{ id: 'glass_grains', qty: 1 }],
    cactus_nectar: [{ id: 'cactus_flesh', qty: 1 }],
    processed_sugar: [{ id: 'cactus_nectar', qty: 1 }],
    wild_yeast: [{ id: 'faecium', qty: 1 }],
    cream: [{ id: 'fresh_milk', qty: 1 }],
    churned_butter: [{ id: 'cream', qty: 1 }],
    clarified_oil: [{ id: 'churned_butter', qty: 2 }],
    sweetened_butter: [{ id: 'churned_butter', qty: 1 }, { id: 'processed_sugar', qty: 1 }],
    delicate_meringue: [{ id: 'creature_egg', qty: 1 }, { id: 'processed_sugar', qty: 1 }],
    silicon_egg: [{ id: 'chromatic_metal', qty: 1 }],
    proto_cream: [{ id: 'proto_milk', qty: 1 }],
    proto_butter: [{ id: 'proto_cream', qty: 1 }],
    sweetened_proto_butter: [{ id: 'proto_butter', qty: 1 }, { id: 'processed_sugar', qty: 1 }],
    dough: [{ id: 'refined_flour', qty: 1 }, { id: 'wild_yeast', qty: 1 }],

    // Baking Doughs, Batters & Fillings
    lumpen_doughnut: [
        { id: 'dough', qty: 1 },
        { id: 'processed_sugar', qty: 1 },
        { id: 'clarified_oil', qty: 1 }
    ],
    cake_batter: [
        { id: 'sweetened_butter', qty: 1 },
        { id: 'refined_flour', qty: 1 },
        { id: 'creature_egg', qty: 1 }
    ],
    extra_fluffy_batter: [
        { id: 'delicate_meringue', qty: 1 },
        { id: 'refined_flour', qty: 1 },
        { id: 'creature_egg', qty: 1 }
    ],
    proto_batter: [
        { id: 'sweetened_proto_butter', qty: 1 },
        { id: 'refined_flour', qty: 1 },
        { id: 'creature_egg', qty: 1 }
    ],
    writhing_batter: [
        { id: 'delicate_meringue', qty: 1 },
        { id: 'refined_flour', qty: 1 },
        { id: 'larval_core', qty: 1 }
    ],
    stellar_custard: [
        { id: 'silicon_egg', qty: 1 },
        { id: 'cream', qty: 1 },
        { id: 'processed_sugar', qty: 1 }
    ],
    anomalous_jam: [
        { id: 'hexaberry', qty: 1 },
        { id: 'processed_sugar', qty: 1 }
    ],
    monstrous_custard: [
        { id: 'larval_core', qty: 1 },
        { id: 'cream', qty: 1 },
        { id: 'processed_sugar', qty: 1 }
    ],

    // Baking Final Dishes
    the_stellarator: [{ id: 'lumpen_doughnut', qty: 1 }, { id: 'stellar_custard', qty: 1 }],
    anomalous_doughnut: [{ id: 'lumpen_doughnut', qty: 1 }, { id: 'anomalous_jam', qty: 1 }],
    extra_fluffy_cream_cake: [{ id: 'extra_fluffy_batter', qty: 1 }, { id: 'cream', qty: 1 }],
    questionably_sweet_cake: [{ id: 'cake_batter', qty: 1 }, { id: 'sticky_honey', qty: 1 }],
    most_curious_cake: [{ id: 'proto_batter', qty: 1 }, { id: 'sticky_honey', qty: 1 }],
    perpetual_cake: [
        { id: 'cake_batter', qty: 1 },
        { id: 'anomalous_jam', qty: 1 },
        { id: 'cream', qty: 1 }
    ],
    cake_of_the_lost: [{ id: 'writhing_batter', qty: 1 }, { id: 'monstrous_custard', qty: 1 }],
    monstrous_doughnut: [{ id: 'lumpen_doughnut', qty: 1 }, { id: 'monstrous_custard', qty: 1 }],

    // Industrial Tier 2: Base Crafts
    glass: [{ id: 'frost_crystal', qty: 50 }],
    lubricant: [{ id: 'faecium', qty: 50 }, { id: 'gamma_root', qty: 400 }],
    poly_fibre: [{ id: 'cactus_flesh', qty: 100 }, { id: 'star_bulb', qty: 200 }],
    heat_capacitor: [{ id: 'solanium', qty: 200 }, { id: 'frost_crystal', qty: 100 }],
    acid: [{ id: 'mordite', qty: 25 }, { id: 'fungal_mould', qty: 600 }],
    unstable_gel: [{ id: 'cactus_flesh', qty: 200 }],
    thermic_condensate: [{ id: 'sulphurine', qty: 250 }, { id: 'condensed_carbon', qty: 50 }],
    nitrogen_salt: [{ id: 'nitrogen', qty: 250 }, { id: 'condensed_carbon', qty: 50 }],
    enriched_carbon: [{ id: 'radon', qty: 250 }, { id: 'condensed_carbon', qty: 50 }],
    aronium: [{ id: 'paraffinium', qty: 50 }, { id: 'ionised_cobalt', qty: 50 }],
    magno_gold: [{ id: 'phosphorus', qty: 50 }, { id: 'ionised_cobalt', qty: 50 }],
    grantine: [{ id: 'dioxite', qty: 50 }, { id: 'ionised_cobalt', qty: 50 }],
    dirty_bronze: [{ id: 'pyrite', qty: 50 }, { id: 'pure_ferrite', qty: 100 }],
    lemmium: [{ id: 'uranium', qty: 50 }, { id: 'pure_ferrite', qty: 100 }],
    herox: [{ id: 'ammonia', qty: 50 }, { id: 'ionised_cobalt', qty: 50 }],

    // Industrial Tier 3: Sub-Assemblies
    living_glass: [{ id: 'glass', qty: 5 }, { id: 'lubricant', qty: 1 }],
    hot_ice: [{ id: 'enriched_carbon', qty: 1 }, { id: 'nitrogen_salt', qty: 1 }],
    cryo_pump: [{ id: 'hot_ice', qty: 1 }, { id: 'thermic_condensate', qty: 1 }],
    cryogenic_chamber: [{ id: 'living_glass', qty: 1 }, { id: 'cryo_pump', qty: 1 }],
    liquid_explosive: [{ id: 'acid', qty: 1 }, { id: 'unstable_gel', qty: 1 }],
    organic_catalyst: [{ id: 'thermic_condensate', qty: 1 }, { id: 'enriched_carbon', qty: 1 }],
    fusion_accelerant: [{ id: 'organic_catalyst', qty: 1 }, { id: 'nitrogen_salt', qty: 1 }],
    portable_reactor: [{ id: 'liquid_explosive', qty: 1 }, { id: 'fusion_accelerant', qty: 1 }],
    circuit_board: [{ id: 'poly_fibre', qty: 1 }, { id: 'heat_capacitor', qty: 1 }],
    semiconductor: [{ id: 'thermic_condensate', qty: 1 }, { id: 'nitrogen_salt', qty: 1 }],
    superconductor: [{ id: 'semiconductor', qty: 1 }, { id: 'enriched_carbon', qty: 1 }],
    quantum_processor: [{ id: 'circuit_board', qty: 1 }, { id: 'superconductor', qty: 1 }],
    iridesite: [{ id: 'aronium', qty: 1 }, { id: 'magno_gold', qty: 1 }, { id: 'grantine', qty: 1 }],
    geodesite: [{ id: 'dirty_bronze', qty: 1 }, { id: 'lemmium', qty: 1 }, { id: 'herox', qty: 1 }],

    // Industrial Tier 4: Mega-Crafts
    stasis_device: [
        { id: 'quantum_processor', qty: 1 },
        { id: 'cryogenic_chamber', qty: 1 },
        { id: 'iridesite', qty: 1 }
    ],
    fusion_ignitor: [
        { id: 'quantum_processor', qty: 1 },
        { id: 'portable_reactor', qty: 1 },
        { id: 'geodesite', qty: 1 }
    ]
};