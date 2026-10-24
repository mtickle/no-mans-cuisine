import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import {
  ChefHat,
  Cpu,
  Sprout,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Layers,
  ShoppingCart,
  Sparkles,
  Zap,
  Rewind,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  RotateCcw,
  PackageCheck,
  XCircle,
  Clock,
  Flame,
  Milk,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Hammer
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { ITEMS } from '@data/items';
import { RECIPES } from '@data/recipes';
import { BAKING_DISHES } from '@data/baking_dishes';
import { INDUSTRIAL_ITEMS } from '@data/industrial_items';
import { DEFAULT_INVENTORY } from '@data/default_inventory';
import { DEFAULT_BIODOMES } from '@data/default_biodomes';
import { DEFAULT_PICKUP_PRESETS } from '@data/default_pickup_presets';


const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const STORAGE_KEY = 'nms_manufacturing_tier0_v3';


// ==========================================
// 2. GRAPH & TIER-0 FARM CALCULATOR ENGINE
// ==========================================
function buildRecipeBracket(targetId, batchSize, inventory, biodomes) {
  const nodeMap = {};

  function traverse(itemId, qtyNeeded, consumerId = null) {
    const item = ITEMS[itemId];
    if (!nodeMap[itemId]) {
      nodeMap[itemId] = {
        ...item,
        totalNeeded: 0,
        consumers: {},
        inputs: RECIPES[itemId] || []
      };
    }
    nodeMap[itemId].totalNeeded += qtyNeeded;

    if (consumerId) {
      nodeMap[itemId].consumers[consumerId] =
        (nodeMap[itemId].consumers[consumerId] || 0) + qtyNeeded;
    }

    const recipeInputs = RECIPES[itemId];
    if (recipeInputs) {
      recipeInputs.forEach((inp) => {
        traverse(inp.id, inp.qty * qtyNeeded, itemId);
      });
    }
  }

  traverse(targetId, batchSize);

  const enrichedNodes = Object.values(nodeMap)
    .sort((a, b) => a.order - b.order)
    .map((node) => {
      const onHand = inventory[node.id] || 0;
      const deficit = Math.max(0, node.totalNeeded - onHand);
      const cyclesOf50 = node.stackCap === 50 ? Math.ceil(node.totalNeeded / 50) : 1;
      const consumerEntries = Object.entries(node.consumers).map(([cId, qty]) => ({
        id: cId,
        name: ITEMS[cId]?.name || cId,
        qty
      }));

      // Tier 0 Biodome Harvest & Regrowth Math
      const domeCount = biodomes?.[node.id] || 0;
      const harvestYield = node.isCrop ? domeCount * node.yieldPerDome : 0;
      const harvestsNeeded =
        deficit > 0 && harvestYield > 0 ? Math.ceil(deficit / harvestYield) : 0;
      const hoursToRegrow = harvestsNeeded * (node.growthHours || 0);

      // 1:1 Refiner Crop Doubler Availability
      const doublerMineralId = node.doublerMineral;
      const doublerMineralStock = doublerMineralId ? inventory[doublerMineralId] || 0 : 0;
      const canRefinerDouble =
        deficit > 0 &&
        doublerMineralId &&
        ITEMS[doublerMineralId] &&
        onHand > 0 &&
        doublerMineralStock > 0;

      return {
        ...node,
        onHand,
        deficit,
        cyclesOf50,
        consumerEntries,
        isSplit: consumerEntries.length > 1,
        domeCount,
        harvestYield,
        harvestsNeeded,
        hoursToRegrow,
        doublerMineralName: doublerMineralId ? ITEMS[doublerMineralId]?.name : null,
        doublerMineralStock,
        canRefinerDouble
      };
    });

  const edges = [];
  enrichedNodes.forEach((node) => {
    node.consumerEntries.forEach((c) => {
      edges.push({
        id: `${node.id}__${c.id}`,
        fromId: node.id,
        toId: c.id,
        qty: c.qty
      });
    });
  });

  return {
    allMap: Object.fromEntries(enrichedNodes.map((n) => [n.id, n])),
    tier1: enrichedNodes.filter((n) => n.tier === 1),
    tier2: enrichedNodes.filter((n) => n.tier === 2),
    tier3: enrichedNodes.filter((n) => n.tier === 3),
    tier4: enrichedNodes.filter((n) => n.tier === 4),
    splits: enrichedNodes.filter((n) => n.isSplit),
    edges
  };
}

function computeBidirectionalSpotlight(startId, allMap, directionMode = 'both') {
  if (!startId || !allMap[startId]) {
    return {
      distances: {},
      upstreamSubQty: {},
      upstreamEdges: new Set(),
      downstreamEdges: new Set()
    };
  }

  const distances = { [startId]: 0 };
  const upstreamSubQty = {};
  const upstreamEdges = new Set();
  const downstreamEdges = new Set();

  if (directionMode === 'both' || directionMode === 'forward') {
    const fwdQueue = [{ id: startId, dist: 0 }];
    while (fwdQueue.length > 0) {
      const { id, dist } = fwdQueue.shift();
      const node = allMap[id];
      if (!node) continue;

      node.consumerEntries.forEach((consumer) => {
        downstreamEdges.add(`${id}__${consumer.id}`);
        if (distances[consumer.id] === undefined || dist + 1 < distances[consumer.id]) {
          distances[consumer.id] = dist + 1;
          fwdQueue.push({ id: consumer.id, dist: dist + 1 });
        }
      });
    }
  }

  if (directionMode === 'both' || directionMode === 'backward') {
    const startQty = allMap[startId].totalNeeded;

    function traverseBackwards(currId, neededQty, dist) {
      if (currId !== startId) {
        upstreamSubQty[currId] = (upstreamSubQty[currId] || 0) + neededQty;
        if (distances[currId] === undefined || dist < distances[currId]) {
          distances[currId] = dist;
        }
      }
      const recipeInputs = RECIPES[currId] || [];
      recipeInputs.forEach((inp) => {
        upstreamEdges.add(`${inp.id}__${currId}`);
        traverseBackwards(inp.id, neededQty * inp.qty, dist - 1);
      });
    }

    traverseBackwards(startId, startQty, 0);
  }

  return { distances, upstreamSubQty, upstreamEdges, downstreamEdges };
}

// ==========================================
// 3. MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          mode: parsed.mode || 'baking',
          inventory: { ...DEFAULT_INVENTORY, ...(parsed.inventory || {}) },
          biodomes: { ...DEFAULT_BIODOMES, ...(parsed.biodomes || {}) },
          pickups: { ...DEFAULT_PICKUP_PRESETS, ...(parsed.pickups || {}) },
          selectedRecipe: parsed.selectedRecipe || 'the_stellarator',
          batchSize: parsed.batchSize || 50,
          completedSteps: parsed.completedSteps || {}
        };
      } catch (e) {
        console.error(e);
      }
    }
    return {
      mode: 'baking',
      inventory: DEFAULT_INVENTORY,
      biodomes: DEFAULT_BIODOMES,
      pickups: DEFAULT_PICKUP_PRESETS,
      selectedRecipe: 'the_stellarator',
      batchSize: 50,
      completedSteps: {}
    };
  });

  const [farmDrawerOpen, setFarmDrawerOpen] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [focusedNodeId, setFocusedNodeId] = useState('stellar_custard');
  const [traceDirection, setTraceDirection] = useState('both');
  const [svgPipes, setSvgPipes] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 600 });

  const bracketContainerRef = useRef(null);
  const nodeRefs = useRef({});

  const [session, setSession] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [syncing, setSyncing] = useState(false);

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const updateAppState = (updater) => {
    setState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

      if (supabase && session?.user) {
        supabase
          .from('user_manufacturing_state')
          .upsert({
            user_id: session.user.id,
            inventory: next.inventory,
            biodomes: next.biodomes,
            active_batch: {
              mode: next.mode,
              recipeId: next.selectedRecipe,
              targetCount: next.batchSize,
              completedSteps: next.completedSteps,
              pickups: next.pickups
            },
            updated_at: new Date().toISOString()
          })
          .then();
      }
      return next;
    });
  };

  const bracket = useMemo(
    () => buildRecipeBracket(state.selectedRecipe, state.batchSize, state.inventory, state.biodomes),
    [state.selectedRecipe, state.batchSize, state.inventory, state.biodomes]
  );

  const spotlight = useMemo(
    () => computeBidirectionalSpotlight(focusedNodeId, bracket.allMap, traceDirection),
    [focusedNodeId, bracket.allMap, traceDirection]
  );

  const activeSequenceTrail = useMemo(() => {
    return Object.entries(spotlight.distances)
      .sort((a, b) => a[1] - b[1])
      .map(([id, dist]) => ({
        ...bracket.allMap[id],
        dist,
        subQty: spotlight.upstreamSubQty[id]
      }));
  }, [spotlight, bracket.allMap]);

  // Measure DOM cards and compute smooth cubic Bezier SVG paths
  const recalculatePipes = useCallback(() => {
    const container = bracketContainerRef.current;
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    setCanvasSize({
      width: container.scrollWidth,
      height: container.scrollHeight
    });

    const computed = [];

    bracket.edges.forEach((edge) => {
      const fromEl = nodeRefs.current[edge.fromId];
      const toEl = nodeRefs.current[edge.toId];
      if (!fromEl || !toEl) return;

      const fRect = fromEl.getBoundingClientRect();
      const tRect = toEl.getBoundingClientRect();

      const fromNode = bracket.allMap[edge.fromId];
      const toNode = bracket.allMap[edge.toId];
      if (!fromNode || !toNode) return;

      let d = '';

      if (fromNode.tier < toNode.tier) {
        const startX = fRect.right - cRect.left + container.scrollLeft;
        const startY = fRect.top - cRect.top + fRect.height / 2 + container.scrollTop;
        const endX = tRect.left - cRect.left + container.scrollLeft;
        const endY = tRect.top - cRect.top + tRect.height / 2 + container.scrollTop;
        const ctrlOffset = Math.max(28, (endX - startX) * 0.5);

        d = `M ${startX} ${startY} C ${startX + ctrlOffset} ${startY}, ${endX - ctrlOffset} ${endY}, ${endX} ${endY}`;
      } else {
        const isAdjacentBelow = Math.abs(tRect.top - fRect.bottom) < 36;
        if (isAdjacentBelow) {
          const midX = fRect.left - cRect.left + fRect.width / 2 + container.scrollLeft;
          const startY = fRect.bottom - cRect.top + container.scrollTop;
          const endY = tRect.top - cRect.top + container.scrollTop;
          d = `M ${midX} ${startY} L ${midX} ${endY}`;
        } else {
          const startX = fRect.right - cRect.left + container.scrollLeft;
          const startY = fRect.top - cRect.top + fRect.height / 2 + container.scrollTop;
          const endX = tRect.right - cRect.left + container.scrollLeft;
          const endY = tRect.top - cRect.top + tRect.height / 2 + container.scrollTop;
          const loopOut = 22;
          d = `M ${startX} ${startY} C ${startX + loopOut} ${startY}, ${endX + loopOut} ${endY}, ${endX} ${endY}`;
        }
      }

      computed.push({ ...edge, d });
    });

    setSvgPipes(computed);
  }, [bracket]);

  useLayoutEffect(() => {
    recalculatePipes();
    const timer = setTimeout(recalculatePipes, 60);
    window.addEventListener('resize', recalculatePipes);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', recalculatePipes);
    };
  }, [recalculatePipes, focusedNodeId, state.selectedRecipe, state.batchSize, state.mode, farmDrawerOpen]);

  const activeDish = ITEMS[state.selectedRecipe];
  const focusedNode = focusedNodeId ? bracket.allMap[focusedNodeId] : null;
  const totalUnits = activeDish.unitValue * state.batchSize;
  const totalBuffHours = ((state.batchSize * 10) / 60).toFixed(1);
  const totalBiodomesAllocated = Object.values(state.biodomes).reduce((sum, n) => sum + n, 0);

  // ==========================================
  // TIER 0 FARM, RANCH, REFINER & BATCH ACTIONS
  // ==========================================
  const handleHarvestAllBiodomes = () => {
    let totalAdded = 0;
    updateAppState((prev) => {
      const nextInv = { ...prev.inventory };
      Object.entries(prev.biodomes).forEach(([cropId, domeCount]) => {
        if (domeCount > 0 && ITEMS[cropId]?.yieldPerDome) {
          const added = domeCount * ITEMS[cropId].yieldPerDome;
          nextInv[cropId] = (nextInv[cropId] || 0) + added;
          totalAdded += added;
        }
      });
      return { ...prev, inventory: nextInv };
    });
    triggerToast(`Harvested ${totalBiodomesAllocated} Biodomes (+${totalAdded.toLocaleString()} total crops added to stock!)`);
  };

  const handleCollectRanchRun = () => {
    updateAppState((prev) => {
      const nextInv = { ...prev.inventory };
      ['fresh_milk', 'proto_milk', 'creature_egg', 'sticky_honey'].forEach((id) => {
        const amt = prev.pickups[id] || 0;
        nextInv[id] = (nextInv[id] || 0) + amt;
      });
      return { ...prev, inventory: nextInv };
    });
    triggerToast('Collected Livestock Unit yields (Milk, Eggs & Honey added to Pantry!)');
  };

  const handleEmptyGasDepots = () => {
    updateAppState((prev) => {
      const nextInv = { ...prev.inventory };
      ['radon', 'sulphurine', 'nitrogen', 'condensed_carbon'].forEach((id) => {
        const amt = prev.pickups[id] || 0;
        nextInv[id] = (nextInv[id] || 0) + amt;
      });
      return { ...prev, inventory: nextInv };
    });
    triggerToast('Emptied Gas Extractor Depots (+Radon, Sulphurine, Nitrogen & Carbon!)');
  };

  // 1:1 Refiner Expansion Loop: 1 Crop + 1 Biome Mineral -> 2 Crop (Net +1 Crop per 1 Mineral spent)
  const handleRefinerDoubleCrop = (e, rawNode) => {
    e.stopPropagation();
    const mineralId = rawNode.doublerMineral;
    if (!mineralId || !ITEMS[mineralId]) return;

    const currentCrop = state.inventory[rawNode.id] || 0;
    const currentMineral = state.inventory[mineralId] || 0;
    const maxExpandable = Math.min(rawNode.deficit, currentCrop, currentMineral);

    if (maxExpandable <= 0) return;

    updateAppState((prev) => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        [rawNode.id]: (prev.inventory[rawNode.id] || 0) + maxExpandable,
        [mineralId]: Math.max(0, (prev.inventory[mineralId] || 0) - maxExpandable)
      }
    }));

    triggerToast(
      `Refiner Loop: Combined ${maxExpandable.toLocaleString()} ${ITEMS[mineralId].name} to produce +${maxExpandable.toLocaleString()} ${rawNode.name}!`
    );
  };

  // Deducts all Tier 1 raw inputs for the active batch and resets step checkmarks
  const handleCompleteAndDeductBatch = () => {
    updateAppState((prev) => {
      const nextInv = { ...prev.inventory };
      bracket.tier1.forEach((rawNode) => {
        nextInv[rawNode.id] = Math.max(0, (nextInv[rawNode.id] || 0) - rawNode.totalNeeded);
      });
      return {
        ...prev,
        inventory: nextInv,
        completedSteps: {}
      };
    });
    triggerToast(
      `Completed ${state.batchSize}x ${activeDish.name}! Raw materials deducted from Pantry.`
    );
  };

  const handleModeSwitch = (newMode) => {
    const defaultRecipe = newMode === 'baking' ? 'the_stellarator' : 'stasis_device';
    const defaultBatch = newMode === 'baking' ? 50 : 5;
    const defaultFocus = newMode === 'baking' ? 'stellar_custard' : 'quantum_processor';
    setFocusedNodeId(defaultFocus);
    updateAppState({
      mode: newMode,
      selectedRecipe: defaultRecipe,
      batchSize: defaultBatch
    });
  };

  const handleCardClick = (nodeId) => {
    setFocusedNodeId((prev) => (prev === nodeId ? null : nodeId));
  };

  const toggleStepComplete = (e, node) => {
    e.stopPropagation();
    const key = `${state.selectedRecipe}_${node.id}`;
    const willBeDone = !state.completedSteps[key];

    updateAppState((prev) => ({
      ...prev,
      completedSteps: {
        ...prev.completedSteps,
        [key]: willBeDone
      }
    }));

    if (willBeDone && node.consumerEntries.length > 0) {
      setFocusedNodeId(node.id);
    }
  };

  const handleInventoryChange = (itemId, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    updateAppState((prev) => ({
      ...prev,
      inventory: { ...prev.inventory, [itemId]: num }
    }));
  };

  const handleBiodomeChange = (cropId, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    updateAppState((prev) => ({
      ...prev,
      biodomes: { ...prev.biodomes, [cropId]: num }
    }));
  };

  const activeTargetList = state.mode === 'baking' ? BAKING_DISHES : INDUSTRIAL_ITEMS;
  const cropItems = Object.values(ITEMS).filter((i) => i.isCrop);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Floating Action Toast */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-emerald-950/95 border border-emerald-400 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Navigation & Mode Switcher */}
      <header className="border-b border-cyan-500/30 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-400/40 text-cyan-400">
              {state.mode === 'baking' ? (
                <ChefHat className="w-6 h-6" />
              ) : (
                <Cpu className="w-6 h-6" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wider uppercase text-cyan-300">
                No Man&apos;s Agriculture, Bakery &amp; Foundry
              </h1>
              <p className="text-xs text-slate-400">
                Tier-0 Biodome Engine &bull; 50-Stack Nutrient Processor &bull; Stasis Bracket
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => handleModeSwitch('baking')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${state.mode === 'baking'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              Baking &amp; Buffs (50-Stacks)
            </button>
            <button
              onClick={() => handleModeSwitch('industrial')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${state.mode === 'industrial'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Stasis Device &amp; Fusion Ignitor
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFarmDrawerOpen((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-xs font-semibold text-emerald-300 transition"
            >
              <Sprout className="w-3.5 h-3.5" />
              Tier-0 Farm ({totalBiodomesAllocated} Domes)
              {farmDrawerOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={() => {
                setFocusedNodeId(null);
                updateAppState({ completedSteps: {} });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Steps
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-6">
        {/* TIER 0: AGRICULTURE, RANCH & GAS EXTRACTOR CONTROL DECK */}
        {farmDrawerOpen && (
          <section className="bg-slate-900/95 border border-emerald-500/40 rounded-xl p-5 space-y-4 shadow-xl shadow-emerald-950/20">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-400/40 text-emerald-400">
                  <Sprout className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-300">
                    Tier-0 Agriculture, Livestock &amp; Gas Outpost Engine
                  </h2>
                  <p className="text-xs text-slate-400">
                    One-click base harvest buttons automatically restock your Tier 1 bracket cards below
                  </p>
                </div>
              </div>

              {/* One-Click Base Run Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleHarvestAllBiodomes}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition"
                >
                  <Sprout className="w-4 h-4" />
                  Harvest All {totalBiodomesAllocated} Biodomes
                </button>

                <button
                  onClick={handleCollectRanchRun}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-bold text-xs transition"
                >
                  <Milk className="w-4 h-4 text-amber-400" />
                  +Collect Ranch (Milk/Eggs/Honey)
                </button>

                <button
                  onClick={handleEmptyGasDepots}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 font-bold text-xs transition"
                >
                  <Flame className="w-4 h-4 text-cyan-400" />
                  +Empty Gas Depots (2,500x Each)
                </button>
              </div>
            </div>

            {/* 16-Slot Biodome Allocation Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {cropItems.map((crop) => {
                const domes = state.biodomes[crop.id] || 0;
                const yieldPerRun = domes * crop.yieldPerDome;
                return (
                  <div
                    key={crop.id}
                    className={`p-2.5 rounded-xl border ${domes > 0
                      ? 'bg-slate-950/90 border-emerald-500/40'
                      : 'bg-slate-950/40 border-slate-800 opacity-60'
                      }`}
                  >
                    <div className="text-xs font-bold text-slate-200 truncate">
                      {crop.plantName}
                    </div>
                    <div className="text-[10px] text-emerald-400 truncate">
                      {crop.name} ({crop.growthHours}h)
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="text-[10px] text-slate-400">Domes:</span>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={domes}
                        onChange={(e) => handleBiodomeChange(crop.id, e.target.value)}
                        className="w-14 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-right font-mono text-xs text-emerald-300"
                      />
                    </div>

                    <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex justify-between text-[10px] font-mono">
                      <span className="text-slate-400">Yield:</span>
                      <span className="text-cyan-300 font-semibold">
                        +{yieldPerRun.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Recipe Selector Bar & Batch Controls */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              1. Select Target Blueprint or Recipe
            </label>
            <div
              className={`grid gap-2 ${state.mode === 'baking'
                ? 'grid-cols-2 sm:grid-cols-4'
                : 'grid-cols-1 sm:grid-cols-2'
                }`}
            >
              {activeTargetList.map((id) => {
                const dish = ITEMS[id];
                const active = state.selectedRecipe === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setFocusedNodeId(null);
                      updateAppState({ selectedRecipe: id });
                    }}
                    className={`text-left p-3 rounded-lg border transition ${active
                      ? 'bg-cyan-950/70 border-cyan-400 text-cyan-200 shadow-lg shadow-cyan-950/50'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                  >
                    <div className="font-semibold text-xs truncate">{dish.name}</div>
                    <div className="text-[11px] text-amber-400 mt-1 font-mono">
                      {dish.unitValue.toLocaleString()} U
                    </div>
                    <div className="text-[10px] text-emerald-400 truncate mt-0.5">
                      {dish.buff}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Batch Size, Output Summary & Complete Batch Deduction Button */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                2. Target Batch Quantity
              </label>
              <div className="flex items-center gap-2">
                {(state.mode === 'baking' ? [10, 19, 25, 50, 100] : [1, 5, 10, 20]).map(
                  (preset) => (
                    <button
                      key={preset}
                      onClick={() => updateAppState({ batchSize: preset })}
                      className={`px-2.5 py-1 rounded text-xs font-mono border transition ${state.batchSize === preset
                        ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                        : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                    >
                      {preset}x
                    </button>
                  )
                )}
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={state.batchSize}
                  onChange={(e) =>
                    updateAppState({ batchSize: Math.max(1, parseInt(e.target.value, 10) || 1) })
                  }
                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-right font-mono text-xs text-cyan-300"
                />
              </div>
            </div>

            <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Primary Utility:</span>
                <span className="text-emerald-400 font-semibold">{activeDish.buff}</span>
              </div>
              {state.mode === 'baking' && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Total Buff Time:</span>
                  <span className="text-cyan-300 font-mono">{totalBuffHours} Hours</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Batch Trade Value:</span>
                <span className="text-amber-400 font-mono font-semibold">
                  {totalUnits.toLocaleString()} Units
                </span>
              </div>
            </div>

            <button
              onClick={handleCompleteAndDeductBatch}
              className="w-full py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20 transition"
            >
              <Hammer className="w-4 h-4" />
              Complete Batch &amp; Deduct Raw Stock
            </button>
          </div>
        </section>

        {/* Bidirectional Sequence Spotlight Bar */}
        {focusedNode && (
          <section className="bg-slate-900 border border-cyan-400/50 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Active Circuit Spotlight: {focusedNode.name} (Need {focusedNode.totalNeeded.toLocaleString()})
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {[
                  { id: 'both', label: '↔ Both Directions' },
                  { id: 'backward', label: '⬅ Backwards (Purple Inputs)' },
                  { id: 'forward', label: '➡ Forwards (Amber Outputs)' }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setTraceDirection(mode.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${traceDirection === mode.id
                      ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-300'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                  >
                    {mode.label}
                  </button>
                ))}

                <button
                  onClick={() => setFocusedNodeId(null)}
                  className="ml-2 flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-700"
                >
                  <XCircle className="w-3.5 h-3.5 text-slate-400" />
                  Clear
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeSequenceTrail.map((item, idx) => {
                const isUpstream = item.dist < 0;
                const isDirectInput = item.dist === -1;
                const isSelected = item.dist === 0;
                const isImmediateNext = item.dist === 1;

                return (
                  <React.Fragment key={item.id}>
                    <button
                      onClick={() => setFocusedNodeId(item.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${isSelected
                        ? 'bg-cyan-400 text-slate-950 font-extrabold border-cyan-200 ring-2 ring-cyan-400/50'
                        : isDirectInput
                          ? 'bg-purple-500/25 border-purple-400 text-purple-200 ring-1 ring-purple-400/50'
                          : isUpstream
                            ? 'bg-indigo-950/80 border-indigo-400/60 text-indigo-200'
                            : isImmediateNext
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50'
                              : 'bg-slate-950 border-cyan-500/40 text-cyan-200'
                        }`}
                    >
                      {isDirectInput && (
                        <span className="text-purple-300 font-bold">⬅ INPUT (-1):</span>
                      )}
                      {item.dist < -1 && (
                        <span className="text-indigo-300 font-bold">⬅ STEP {item.dist}:</span>
                      )}
                      {isSelected && <span>★ SELECTED:</span>}
                      {isImmediateNext && (
                        <span className="text-amber-300 font-bold">➡ NEXT (+1):</span>
                      )}
                      {item.dist > 1 && (
                        <span className="text-cyan-400 font-bold">➡ +{item.dist}:</span>
                      )}
                      <span>{item.name}</span>
                      <span className="font-mono text-[11px] opacity-90">
                        ({isUpstream && item.subQty ? `${item.subQty.toLocaleString()}` : item.totalNeeded.toLocaleString()})
                      </span>
                    </button>
                    {idx < activeSequenceTrail.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </section>
        )}

        {/* Left-to-Right Visual Recipe Bracket with Glowing SVG Pipe Overlay */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Interactive SVG Pipe Bracket (Click Any Node to Trace Its Circuit)
              </h2>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-purple-300">
                <span className="w-3 h-1 rounded bg-purple-400 inline-block" />
                ⬅ Upstream Pipes (Required Inputs)
              </span>
              <span className="flex items-center gap-1.5 text-amber-300">
                <span className="w-3 h-1 rounded bg-amber-400 inline-block" />
                ➡ Downstream Pipes (Next Output)
              </span>
            </div>
          </div>

          <div
            ref={bracketContainerRef}
            onScroll={recalculatePipes}
            className="relative min-w-[1040px] py-2"
          >
            {/* SVG Bezier Pipe Layer */}
            <svg
              width={canvasSize.width}
              height={canvasSize.height}
              className="absolute inset-0 pointer-events-none z-0"
            >
              <defs>
                <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {svgPipes.map((pipe) => {
                const isUpstreamPipe = spotlight.upstreamEdges.has(pipe.id);
                const isDownstreamPipe = spotlight.downstreamEdges.has(pipe.id);
                const isHighlighted = isUpstreamPipe || isDownstreamPipe;
                const isDimmed = focusedNodeId !== null && !isHighlighted;

                const strokeColor = isUpstreamPipe
                  ? '#c084fc'
                  : isDownstreamPipe
                    ? '#fbbf24'
                    : '#334155';

                return (
                  <g key={pipe.id}>
                    <path
                      d={pipe.d}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isHighlighted ? 3 : 1.75}
                      strokeOpacity={isDimmed ? 0.14 : isHighlighted ? 0.95 : 0.55}
                      filter={
                        isUpstreamPipe
                          ? 'url(#glow-purple)'
                          : isDownstreamPipe
                            ? 'url(#glow-amber)'
                            : undefined
                      }
                      className="transition-all duration-300"
                    />
                    {isHighlighted && (
                      <path
                        d={pipe.d}
                        fill="none"
                        stroke={isUpstreamPipe ? '#f3e8ff' : '#fef3c7'}
                        strokeWidth={2}
                        strokeDasharray="6 8"
                        className="animate-pulse"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* 4-Column Node Grid */}
            <div className="relative z-10 grid grid-cols-4 gap-12 items-start">
              {[
                { title: 'Tier 1: Raw Inputs (Farm & Outposts)', nodes: bracket.tier1 },
                { title: 'Tier 2: Processed & Refined', nodes: bracket.tier2 },
                { title: 'Tier 3: Sub-Assemblies', nodes: bracket.tier3 },
                { title: 'Tier 4: Final Product', nodes: bracket.tier4 }
              ].map((col) => (
                <div key={col.title} className="space-y-3.5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400 border-b border-slate-800 pb-2 bg-slate-900/90 px-1">
                    {col.title}
                  </div>

                  <div className="space-y-3.5">
                    {col.nodes.map((node) => {
                      const stepKey = `${state.selectedRecipe}_${node.id}`;
                      const isDone = !!state.completedSteps[stepKey];
                      const isRaw = node.tier === 1;

                      const allInputsDone =
                        node.inputs.length > 0 &&
                        node.inputs.every(
                          (inp) => !!state.completedSteps[`${state.selectedRecipe}_${inp.id}`]
                        );

                      const seqDist = spotlight.distances[node.id];
                      const subQtyForAnchor = spotlight.upstreamSubQty[node.id];

                      const isFocusedSource = seqDist === 0;
                      const isDirectUpstreamInput = seqDist === -1;
                      const isEarlierUpstreamPrereq = seqDist !== undefined && seqDist < -1;
                      const isImmediateNext = seqDist === 1;
                      const isFurtherDownstream = seqDist !== undefined && seqDist > 1;
                      const isDimmed = focusedNodeId !== null && seqDist === undefined;

                      return (
                        <div
                          key={node.id}
                          ref={(el) => {
                            if (el) nodeRefs.current[node.id] = el;
                          }}
                          onClick={() => handleCardClick(node.id)}
                          className={`w-full cursor-pointer rounded-xl p-3 border transition-all duration-200 select-none ${isFocusedSource
                            ? 'bg-cyan-950/95 border-cyan-300 ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/25 scale-[1.02]'
                            : isDirectUpstreamInput
                              ? 'bg-purple-950/90 border-purple-400 ring-2 ring-purple-400 shadow-xl shadow-purple-500/25 scale-[1.02]'
                              : isEarlierUpstreamPrereq
                                ? 'bg-indigo-950/85 border-indigo-400/90 ring-1 ring-indigo-400/50 shadow-md shadow-indigo-500/15'
                                : isImmediateNext
                                  ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-400 shadow-xl shadow-amber-500/30 scale-[1.02]'
                                  : isFurtherDownstream
                                    ? 'bg-cyan-950/80 border-cyan-400/80 shadow-md shadow-cyan-500/10'
                                    : isDone
                                      ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                                      : allInputsDone
                                        ? 'bg-emerald-950/70 border-emerald-400 ring-1 ring-emerald-400/50'
                                        : 'bg-slate-950/95 border-slate-800 hover:border-slate-600'
                            } ${isDimmed ? 'opacity-25 hover:opacity-75' : 'opacity-100'}`}
                        >
                          {/* Dynamic Forward & Backward Badges */}
                          {isFocusedSource && (
                            <div className="mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-400 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider">
                              <Sparkles className="w-3 h-3" /> Selected Node
                            </div>
                          )}
                          {isDirectUpstreamInput && (
                            <div className="mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-400 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider">
                              <Rewind className="w-3 h-3" /> Direct Input (-1)
                            </div>
                          )}
                          {isEarlierUpstreamPrereq && (
                            <div className="mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/30 border border-indigo-400/60 text-indigo-200 font-bold text-[10px] uppercase tracking-wider">
                              <ArrowLeft className="w-3 h-3" /> Step {seqDist}
                            </div>
                          )}
                          {isImmediateNext && (
                            <div className="mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider">
                              <Zap className="w-3 h-3" /> Next Output (+1)
                            </div>
                          )}
                          {isFurtherDownstream && (
                            <div className="mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-semibold text-[10px] uppercase tracking-wider">
                              <ArrowRight className="w-3 h-3" /> Step +{seqDist}
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold text-xs text-slate-100">
                              {node.name}
                            </div>
                            <button
                              onClick={(e) => toggleStepComplete(e, node)}
                              title="Mark step completed"
                              className="text-slate-400 hover:text-emerald-400 transition shrink-0"
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-500 hover:text-cyan-300" />
                              )}
                            </button>
                          </div>

                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-cyan-300">
                              Batch: {node.totalNeeded.toLocaleString()}
                            </span>
                            {node.stackCap === 50 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-amber-300">
                                {node.cyclesOf50}x 50-Stack{node.cyclesOf50 > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>

                          {/* Isolated Sub-Recipe Quantity Badge when tracing backwards */}
                          {subQtyForAnchor !== undefined && focusedNode && (
                            <div className="mt-1.5 px-2 py-1 rounded bg-purple-950/90 border border-purple-400/50 flex items-center justify-between text-[11px]">
                              <span className="text-purple-200 truncate mr-1">
                                For {focusedNode.name}:
                              </span>
                              <span className="font-mono font-bold text-purple-300 shrink-0">
                                {subQtyForAnchor.toLocaleString()}
                              </span>
                            </div>
                          )}

                          {/* Upstream recipe inputs caption */}
                          {node.inputs.length > 0 && (
                            <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-300">
                              {node.inputs
                                .map(
                                  (inp) =>
                                    `${(inp.qty * node.totalNeeded).toLocaleString()} ${ITEMS[inp.id].name
                                    }`
                                )
                                .join(' + ')}
                            </div>
                          )}

                          {/* Tier 1 Raw Stock + Biodome Regrowth Timer & Refiner Doubler */}
                          {isRaw && (
                            <div className="mt-2 pt-1.5 border-t border-slate-800/80 space-y-1.5 text-[10px]">
                              <div className="flex justify-between">
                                <span className="text-slate-400">
                                  Stock: {node.onHand.toLocaleString()}
                                </span>
                                {node.deficit > 0 ? (
                                  <span className="text-rose-400 font-semibold">
                                    Short: {node.deficit.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-emerald-400 font-semibold">Stocked</span>
                                )}
                              </div>

                              {/* Live Biodome Regrowth Timer when short */}
                              {node.isCrop && node.deficit > 0 && (
                                <div className="flex items-center justify-between text-amber-300 bg-amber-950/40 px-1.5 py-0.5 rounded">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {node.domeCount > 0
                                      ? `${node.harvestsNeeded} Harvest${node.harvestsNeeded > 1 ? 's' : ''
                                      } (${node.hoursToRegrow}h)`
                                      : '0 Domes Planted'}
                                  </span>
                                  <span>+{node.harvestYield.toLocaleString()}/run</span>
                                </div>
                              )}

                              {/* 1:1 Refiner Crop-Doubler Shortcut Button */}
                              {node.canRefinerDouble && (
                                <button
                                  onClick={(e) => handleRefinerDoubleCrop(e, node)}
                                  className="w-full py-1 px-2 rounded bg-purple-500/25 hover:bg-purple-500/40 border border-purple-400/60 text-purple-200 font-bold flex items-center justify-center gap-1 transition"
                                  title={`1 ${node.name} + 1 ${node.doublerMineralName} -> 2 ${node.name}`}
                                >
                                  <FlaskConical className="w-3 h-3 text-purple-300" />
                                  2x Refine (+{Math.min(node.deficit, node.onHand, node.doublerMineralStock).toLocaleString()} w/ {node.doublerMineralName})
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live Pantry & Raw Resource Shopping List */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Active Recipe Raw Resource Shopping List
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              Showing raw inputs required for {activeDish.name}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {bracket.tier1.map((rawNode) => {
              const onHand = state.inventory[rawNode.id] || 0;
              const deficit = Math.max(0, rawNode.totalNeeded - onHand);
              const subQty = spotlight.upstreamSubQty[rawNode.id];
              const isHighlightedUpstream = subQty !== undefined;

              return (
                <div
                  key={rawNode.id}
                  onClick={() => handleCardClick(rawNode.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${focusedNodeId === rawNode.id
                    ? 'bg-cyan-950/60 border-cyan-400 ring-2 ring-cyan-400'
                    : isHighlightedUpstream
                      ? 'bg-purple-950/50 border-purple-400 ring-2 ring-purple-400/70'
                      : deficit > 0
                        ? 'bg-rose-950/20 border-rose-500/40'
                        : 'bg-emerald-950/20 border-emerald-500/40'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-200">
                      {rawNode.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                      Need: {rawNode.totalNeeded.toLocaleString()}
                    </span>
                  </div>

                  {isHighlightedUpstream && focusedNode && (
                    <div className="mt-1 text-[11px] font-mono font-bold text-purple-300">
                      ⬅ For {focusedNode.name}: {subQty.toLocaleString()}
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {rawNode.source}
                  </div>

                  <div
                    className="mt-3 flex items-center justify-between gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label className="text-[11px] text-slate-400">On Hand:</label>
                    <input
                      type="number"
                      min="0"
                      value={onHand}
                      onChange={(e) => handleInventoryChange(rawNode.id, e.target.value)}
                      className="w-28 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-right font-mono text-xs text-slate-100"
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                    {rawNode.isCrop && deficit > 0 && rawNode.domeCount > 0 ? (
                      <span className="text-amber-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {rawNode.harvestsNeeded} run ({rawNode.hoursToRegrow}h)
                      </span>
                    ) : (
                      <span />
                    )}

                    {deficit > 0 ? (
                      <span className="text-rose-400">
                        Short {deficit.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center justify-end gap-1">
                        <PackageCheck className="w-3.5 h-3.5" /> Ready
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}