import { describe, expect, it } from "vitest";
import { FixedClock } from "@/core/clock";
import { ore } from "@/core/money";
import { budgetTierFor, ingredientNameMatches, resolveIngredients, runPlanPipeline } from "@/core/pipeline";
import type { MealRequest, Product, StoreOption } from "@/core/types";
import type { PipelineDeps } from "@/ports";

const store:StoreOption={chain:"coop",storeId:"1",name:"Coop",tier:"full",distanceKm:1,confirmedAt:"2026-01-01T00:00:00Z"};
const product=(id:string,name:string,categoryPath:string[],section:Product["section"]="KÖTT & PROTEIN"):Product=>({id,name,concept:"",brand:null,priceOre:ore(5000),packageSize:500,packageUnit:"g",comparison:{priceOre:ore(10000),unit:"kg"},section,categoryPath,dietaryTags:[]});
const request:MealRequest={location:"Umeå",budgetSek:"200",portions:4,maxDistanceKm:5,maxCookMinutes:30,dietary:[],pantry:[],vibe:"kycklingpasta"};

describe("ingredient resolution",()=>{
  it("supports whole-word and compounds, rejects frozen prepared meals, and records burrata unmatched",()=>{
    expect(ingredientNameMatches("kyckling","Färsk kycklingfilé")).toBe(true);
    expect(ingredientNameMatches("kyckling","kycklingpasta")).toBe(true);
    const ingredients=[{namn:"kyckling",mangd:400,enhet:"g",kategori:"KÖTT & PROTEIN",roll:"huvud"},{namn:"burrata",mangd:125,enhet:"g",kategori:"MEJERI",roll:"komplement"}] as const;
    const result=resolveIngredients(store,ingredients,new Map([["kyckling",[product("ready","Frozen Take Away Kyckling Teriyaki",["Fryst","Färdigrätter"]),product("raw","Kycklingfilé",["Kött","Fågel"])]],["burrata",[]]]));
    expect(result.candidatesByName.get("kyckling")?.map((p)=>p.id)).toEqual(["raw"]);expect(result.unmatched.map((i)=>i.namn)).toEqual(["burrata"]);
  });
});

describe("pipeline",()=>{
  it.each([[3499,1,"snav"],[3500,1,"lagom"],[7499,1,"lagom"],[7500,1,"generos"]] as const)("maps %i öre/%i to %s",(budget,portions,tier)=>expect(budgetTierFor(budget,portions)).toBe(tier));
  it("generates before searching and keeps unmatched ingredients",async()=>{const events:string[]=[];const deps:PipelineDeps={stores:{async resolve(){events.push("stores");return{location:{lat:0,lon:0,label:"Umeå",isDemoDefault:true},stores:[store]}}},recipes:{async generate(){events.push("recipe");return{titel:"Pasta",forklaring:"Bra",uppskattadTidMin:20,ingredienser:[{namn:"pasta",mangd:320,enhet:"g",kategori:"TORRVAROR",roll:"huvud"},{namn:"burrata",mangd:125,enhet:"g",kategori:"MEJERI",roll:"komplement"}],steg:[{text:"Koka 320 g pasta i 10 minuter.",ingredienser:["pasta"],tidSek:600}]}}},products:{async search(q){events.push(`search:${q.concept}`);return{products:q.concept==="pasta"?[product("pasta","Pasta",["Torrvaror","Pasta"],"TORRVAROR")]:[],rejections:[]}}},prices:{async quote(){return[]}},nutrition:{async lookup(){return[]}}};const result=await runPlanPipeline(request,deps,{clock:new FixedClock(0),deadlineAt:100000});expect(events.indexOf("recipe")).toBeLessThan(events.indexOf("search:pasta"));expect(result.outcome).toBe("ok");expect(result.unmatchedIngredients).toEqual([{namn:"burrata",mangd:125,enhet:"g"}]);});
});
