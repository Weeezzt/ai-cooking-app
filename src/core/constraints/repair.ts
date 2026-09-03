/** Pure, bounded AD-7 basket repair. Candidate lists are capped at five (AD-3). */
import { buildBasket, type BasketRequirement } from "../basket/build";
import { ore, subOre, ZERO_ORE } from "../money";
import type { Basket, BasketAdjustment, Ore, Product, RecipeStep, RequirementRole } from "../types";

const MAX_ALTERNATIVES_PER_CONCEPT = 5;
export interface RepairInput { readonly basket: Basket; readonly budgetOre: Ore; readonly requirements: readonly BasketRequirement[]; readonly candidatesByConcept: ReadonlyMap<string, readonly Product[]>; readonly steps?: readonly RecipeStep[] }
export interface RepairResult { readonly basket: Basket; readonly steps: readonly RecipeStep[]; readonly adjustments: readonly BasketAdjustment[]; readonly withinBudget: boolean; readonly overshootOre: Ore }
const roleRank: Record<RequirementRole, number> = { optional_garnish: 0, supporting: 1, core: 2 };

export function mergeDuplicateRequirements(requirements: readonly BasketRequirement[]) {
  const grouped = new Map<string, BasketRequirement[]>();
  for (const r of requirements) grouped.set(r.concept, [...(grouped.get(r.concept) ?? []), r]);
  const merged: BasketRequirement[] = [], adjustments: BasketAdjustment[] = [];
  for (const concept of [...grouped.keys()].sort()) {
    const group = grouped.get(concept) as BasketRequirement[], first = group[0];
    merged.push({ ...first, recipeAmount: group.reduce((n, r) => n + r.recipeAmount, 0), role: group.reduce((best, r) => roleRank[r.role] > roleRank[best] ? r.role : best, first.role), forcedProductId: group.length === 1 ? first.forcedProductId : undefined });
    if (group.length > 1) adjustments.push({ kind: "merge_duplicate", concept, deltaOre: ZERO_ORE, detail: `${group.length} kravrader slogs ihop före prissättning` });
  }
  return { requirements: merged, adjustments };
}

interface Choice { basket: Basket; substitutions: number; waste: number; ids: string }
function compareChoice(a: Choice, b: Choice, budget: Ore): number { return Math.max(0, a.basket.totalOre-budget)-Math.max(0,b.basket.totalOre-budget) || a.substitutions-b.substitutions || a.waste-b.waste || a.ids.localeCompare(b.ids); }
function enumerate(input: RepairInput, requirements: readonly BasketRequirement[]): Choice | null {
  const original = new Map(input.basket.lines.map((l) => [l.namn, l.product.id]));
  const choices = requirements.map((r) => [...(input.candidatesByConcept.get(r.concept) ?? [])].sort((a,b) => a.id.localeCompare(b.id)).slice(0, MAX_ALTERNATIVES_PER_CONCEPT));
  if (choices.some((c) => c.length === 0)) return null;
  let best: Choice | null = null; const selected: Product[] = [];
  const visit = (index: number): void => {
    if (index === requirements.length) {
      const basket = buildBasket({ store: input.basket.store, requirements: requirements.map((r,i) => ({...r, forcedProductId:selected[i].id})), candidatesByConcept: input.candidatesByConcept, source: input.basket.lines[0]?.provenance.source ?? "repair", retrievedAtIso: input.basket.lines[0]?.provenance.retrievedAt ?? "1970-01-01T00:00:00.000Z" });
      const candidate: Choice = { basket, substitutions: selected.filter((p,i) => original.get(requirements[i].concept) !== p.id).length, waste: basket.lines.reduce((n,l) => n+Math.max(0,(l.purchase.purchasedAmount ?? l.purchase.purchasedGrams)-(l.recipeAmount ?? l.recipeGrams)),0), ids:selected.map((p)=>p.id).join("\0") };
      if (best === null || compareChoice(candidate,best,input.budgetOre)<0) best=candidate; return;
    }
    for (const product of choices[index]) { selected.push(product); visit(index+1); selected.pop(); }
  };
  visit(0); return best;
}

export function repairOverBudget(input: RepairInput): RepairResult {
  const prep=mergeDuplicateRequirements(input.requirements); let requirements=prep.requirements;
  let best=enumerate(input,requirements) ?? {basket:input.basket,substitutions:0,waste:0,ids:""};
  const adjustments=[...prep.adjustments], original=new Map(input.basket.lines.map((l)=>[l.namn,l]));
  let steps=[...(input.steps??[])];
  if(best.basket.totalOre>input.budgetOre) for(const garnish of requirements.filter((r)=>r.role==="optional_garnish").sort((a,b)=>a.concept.localeCompare(b.concept))){
    const removed=best.basket.lines.find((l)=>l.namn===garnish.concept); requirements=requirements.filter((r)=>r.concept!==garnish.concept); best=enumerate(input,requirements)??best;
    if(garnish.requirementId) steps=steps.map((s)=>({ step:{...s,ingredienser:s.ingredienser.filter((x)=>x!==garnish.requirementId)}, hadRefs:s.ingredienser.length>0 })).filter(({step,hadRefs})=>!hadRefs||step.ingredienser.length>0).map(({step})=>step);
    adjustments.push({kind:"remove_optional_garnish",concept:garnish.concept,deltaOre:ore(-(removed?.purchase.priceOre??0)),detail:`Garnering och stegreferenser borttagna: ${garnish.concept}`}); if(best.basket.totalOre<=input.budgetOre)break;
  }
  for (const line of best.basket.lines) { const before=original.get(line.namn); if(before&&before.product.id!==line.product.id) adjustments.push({kind:"substitute_cheaper",concept:line.namn,deltaOre:ore(line.purchase.priceOre-before.purchase.priceOre),detail:`Byte: ${before.product.name} → ${line.product.name}`}); }
  const over=Math.max(0,best.basket.totalOre-input.budgetOre); return {basket:best.basket,steps,adjustments,withinBudget:over===0,overshootOre:over===0?ZERO_ORE:subOre(best.basket.totalOre,input.budgetOre)};
}
