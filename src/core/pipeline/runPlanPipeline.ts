import type { PipelineDeps, PortCallOptions, RecipeDraft, RecipeIngredientRole, BudgetTier } from "@/ports";
import { compareStores, type BasketRequirement } from "../basket";
import { isPastDeadline, type PipelineContext } from "../clock";
import { evaluateConstraints } from "../constraints/evaluate";
import { repairOverBudget } from "../constraints/repair";
import { sumOre, ZERO_ORE } from "../money";
import { aggregateNutrition, type NutritionInputLine } from "../nutrition";
import { storeKey, type Basket, type BasketAdjustment, type MealRequest, type PlanOutcome, type PlanResult, type Provenance, type StoreOption } from "../types";
import { resolveIngredients } from "./resolveIngredients";
import { validateRequest } from "./validate";

const RESULTS_PER_INGREDIENT = 10;
const MAX_STORES = 3;
const MAX_PRODUCT_CONCURRENCY = 6;
const DEFAULT_STAGE_BUDGETS = { storeResolveMs: 4_000, productSearchMs: 8_000, recipeMs: 18_000, nutritionMs: 2_000 } as const;

/** Per-person thresholds: under 35 kr = snäv, 35–74.99 kr = lagom, 75 kr+ = generös. */
export function budgetTierFor(budgetOre: number, portions: number): BudgetTier {
  const perPortion = budgetOre / portions;
  return perPortion < 3_500 ? "snav" : perPortion < 7_500 ? "lagom" : "generos";
}

const role = (value: RecipeIngredientRole): BasketRequirement["role"] => value === "huvud" ? "core" : value === "komplement" ? "supporting" : "optional_garnish";
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("sv-SE");
const pantryOwns = (name: string, pantry: MealRequest["pantry"]) => pantry.some((claim) => fold(claim.concept) === fold(name) || fold(claim.raw).includes(fold(name)));

function stagePort(ctx: PipelineContext, budget: keyof typeof DEFAULT_STAGE_BUDGETS): PortCallOptions {
  return { clock: ctx.clock, deadlineAt: Math.min(ctx.deadlineAt, ctx.clock.now() + (ctx.stageBudgets?.[budget] ?? DEFAULT_STAGE_BUDGETS[budget])) };
}

async function mapBounded<T, R>(items: readonly T[], concurrency: number, work: (item:T)=>Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length); let next = 0;
  async function worker() { while (next < items.length) { const index = next++; output[index] = await work(items[index]); } }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}

function terminal(outcome: Extract<PlanOutcome,"infeasible"|"unknown">, reason:string, nearestFullStore?:PlanResult["nearestFullStore"]): PlanResult {
  return { outcome, basket:null, nutrition:null, comparison:null, constraints:{checks:[],outcome}, adjustments:[], recipe:null, unmatchedIngredients:[], candidateRejections:[], overshootOre:ZERO_ORE, reason, provenance:[], ...(nearestFullStore !== undefined ? { nearestFullStore } : {}) };
}

function shortlist(stores:readonly StoreOption[], maxDistanceKm:number): StoreOption[] {
  const ranked = [...stores].filter((s)=>s.tier==="full"&&s.distanceKm<=maxDistanceKm).sort((a,b)=>a.distanceKm-b.distanceKm||b.confirmedAt.localeCompare(a.confirmedAt)||storeKey(a).localeCompare(storeKey(b)));
  const chains = new Set<string>(); const diverse = ranked.filter((s)=>!chains.has(s.chain)&&Boolean(chains.add(s.chain))).slice(0,MAX_STORES);
  const selected = new Set(diverse.map(storeKey)); return [...diverse,...ranked.filter((s)=>!selected.has(storeKey(s)))].slice(0,MAX_STORES);
}

function retotal(base:Basket, lines:Basket["lines"]):Basket { return {...base,lines,totalOre:lines.length?sumOre(lines.map((line)=>line.purchase.priceOre)):ZERO_ORE}; }

export async function runPlanPipeline(request:MealRequest,deps:PipelineDeps,ctx:PipelineContext):Promise<PlanResult> {
  const interpreted=validateRequest(request); const nowIso=ctx.clock.nowIso();
  const guard=()=>isPastDeadline(ctx)?terminal("unknown","deadline_exceeded"):null;
  if(guard()) return guard()!;
  let discovery; try{discovery=await deps.stores.resolve(request.location,stagePort(ctx,"storeResolveMs"));}catch{return terminal("unknown","store_discovery_failed");}
  const stores=shortlist(discovery.stores,interpreted.maxDistanceKm);
  if(!stores.length){const partial=discovery.stores.some((s)=>s.tier!=="full"&&s.distanceKm<=interpreted.maxDistanceKm+1);const nearest=[...discovery.stores].filter((s)=>s.tier==="full").sort((a,b)=>a.distanceKm-b.distanceKm||storeKey(a).localeCompare(storeKey(b)))[0];return terminal("infeasible",partial?"only_partial_stores_in_range":"no_store_in_range",partial&&nearest?{name:nearest.name,distanceKm:nearest.distanceKm}:undefined);}

  // The single content-producing call happens before any product search.
  let draft:RecipeDraft;
  try{draft=await deps.recipes.generate({vibe:interpreted.vibe,portions:interpreted.portions,dietary:interpreted.dietary.map((d)=>d.id),maxCookMinutes:interpreted.maxCookMinutes,pantry:interpreted.pantry.map((p)=>p.concept),budgetTier:budgetTierFor(interpreted.budgetOre,interpreted.portions),nonce:ctx.nonce},stagePort(ctx,"recipeMs"));}catch{return terminal("unknown","recipe_generation_failed");}
  if(guard()) return guard()!;

  const ingredients=draft.ingredienser.filter((item)=>!pantryOwns(item.namn,request.pantry));
  const pairs=stores.flatMap((store)=>ingredients.map((ingredient)=>({store,ingredient})));
  let searches;
  try{searches=await mapBounded(pairs,MAX_PRODUCT_CONCURRENCY,async({store,ingredient})=>({store,ingredient,found:await deps.products.search({concept:ingredient.namn,store,limit:RESULTS_PER_INGREDIENT},stagePort(ctx,"productSearchMs"))}));}catch{return terminal("unknown","product_search_failed");}
  if(guard()) return guard()!;

  const resolutions=stores.map((store)=>{
    const byName=new Map<string,readonly import("../types").Product[]>();
    for(const hit of searches.filter((entry)=>storeKey(entry.store)===storeKey(store))) byName.set(hit.ingredient.namn,hit.found.products);
    return {store,resolution:resolveIngredients(store,ingredients,byName)};
  });
  const requirements:BasketRequirement[]=ingredients.map((item)=>({concept:item.namn,recipeAmount:item.mangd,unit:item.enhet,role:role(item.roll)}));
  const selection=compareStores({requirements,stores:resolutions.map(({store,resolution})=>({store,candidatesByConcept:resolution.candidatesByName})),source:"primat",retrievedAtIso:nowIso});
  const chosen=resolutions.find((item)=>storeKey(item.store)===storeKey(selection.chosen.store))!;
  let basket=selection.chosen; const adjustments:BasketAdjustment[]=[];
  for(const owned of draft.ingredienser.filter((item)=>pantryOwns(item.namn,request.pantry))) adjustments.push({kind:"pantry_cap",concept:owned.namn,deltaOre:ZERO_ORE,detail:`${owned.namn} finns i skafferiet och köps inte`});

  let overshootOre=ZERO_ORE; let steps=draft.steg.map((step)=>({text:step.text,durationSeconds:step.tidSek,ingredienser:step.ingredienser}));
  if(basket.totalOre>interpreted.budgetOre){const repair=repairOverBudget({basket,budgetOre:interpreted.budgetOre,requirements:requirements.filter((r)=>basket.lines.some((line)=>line.namn===r.concept)),candidatesByConcept:chosen.resolution.candidatesByName});basket=repair.basket;adjustments.push(...repair.adjustments);overshootOre=repair.overshootOre;}

  let facts; try{facts=await deps.nutrition.lookup(ingredients.map((item)=>({concept:item.namn})),stagePort(ctx,"nutritionMs"));}catch{return terminal("unknown","nutrition_lookup_failed");}
  const nutrients=new Map(facts.map((fact)=>[fold(fact.concept),fact.per100g]));
  const nutritionLines:NutritionInputLine[]=ingredients.filter((item)=>item.enhet==="g").map((item)=>({concept:item.namn,recipeGrams:item.mangd,per100g:nutrients.get(fold(item.namn))??null}));
  const nutrition=aggregateNutrition(nutritionLines,interpreted.portions);
  const constraints=evaluateConstraints({budgetOre:interpreted.budgetOre,basketTotalOre:basket.totalOre,requestedPortions:interpreted.portions,recipePortions:interpreted.portions,maxDistanceKm:interpreted.maxDistanceKm,storeDistanceKm:basket.store.distanceKm,dietary:interpreted.dietary,nutrition,estimatedCookMinutes:draft.uppskattadTidMin,maxCookMinutes:interpreted.maxCookMinutes,coverageImpossible:false,providerFailure:false});
  const provenance:Provenance[]=[{source:"primat",retrievedAt:nowIso,priceType:"regular"},{source:"nutrition",retrievedAt:nowIso,coverage:nutrition.coverageRatio},{source:"recipe-generator",retrievedAt:nowIso}];
  return {outcome:constraints.outcome,basket:retotal(basket,basket.lines),nutrition,comparison:selection.comparison,constraints,adjustments,recipe:{title:draft.titel,portions:interpreted.portions,steps},unmatchedIngredients:chosen.resolution.unmatched.map(({namn,mangd,enhet})=>({namn,mangd,enhet})),candidateRejections:[...searches.flatMap((hit)=>hit.found.rejections),...resolutions.flatMap((item)=>item.resolution.rejections)],overshootOre,reason:null,provenance};
}
