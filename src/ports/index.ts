import type { Clock } from "@/core/clock";
import type { CandidateRejection, CanonicalUnit, NutrientVector, Ore, Product, StoreOption, StoreSection } from "@/core/types";
export interface DataAttribution { readonly text:string; readonly url:string }
export interface PortCallOptions { readonly deadlineAt:number; readonly clock:Clock }
export interface ResolvedLocation { readonly lat:number; readonly lon:number; readonly label:string; readonly isDemoDefault:boolean }
export interface StoreDiscoveryResult { readonly location:ResolvedLocation; readonly stores:readonly StoreOption[]; readonly attribution?:DataAttribution }
export interface StoreDiscovery { resolve(place:string|null, options:PortCallOptions):Promise<StoreDiscoveryResult> }
export interface ProductSearchQuery { readonly concept:string; readonly store:StoreOption; readonly limit:number }
export interface ProductSearchResult { readonly products:readonly Product[]; readonly rejections:readonly CandidateRejection[]; readonly attribution?:DataAttribution }
export interface ProductSearch { search(query:ProductSearchQuery, options:PortCallOptions):Promise<ProductSearchResult> }
export interface PriceQuote { readonly productId:string; readonly storeKey:string; readonly priceOre:Ore; readonly priceType:"regular"|"member"|"offer"|"multiprice"; readonly retrievedAtIso:string }
export interface PriceSource { quote(productIds:readonly string[],store:StoreOption,options:PortCallOptions):Promise<readonly PriceQuote[]> }
export interface NutritionFact { readonly concept:string; readonly per100g:NutrientVector; readonly source:string; readonly retrievedAtIso:string }
export interface NutritionLookup { readonly concept:string; readonly gtin?:string }
export interface NutritionSource { lookup(concepts:readonly NutritionLookup[],options:PortCallOptions):Promise<readonly NutritionFact[]> }
export type BudgetTier = "snav" | "lagom" | "generos";
export type RecipeIngredientRole = "huvud" | "komplement" | "garnering";
export interface RecipeGenerationInput { readonly vibe:string; readonly portions:number; readonly dietary:readonly string[]; readonly maxCookMinutes:number|null; readonly pantry:readonly string[]; readonly budgetTier:BudgetTier; readonly validationIssues?:readonly string[]; readonly nonce?:number; readonly demoFallbackOnly?:boolean }
export interface RecipeIngredientDraft { readonly namn:string; readonly mangd:number; readonly enhet:CanonicalUnit; readonly kategori:StoreSection; readonly roll:RecipeIngredientRole }
export interface RecipeStepDraft { readonly text:string; readonly ingredienser:readonly string[]; readonly tidSek:number }
export interface RecipeDraft { readonly titel:string; readonly forklaring:string; readonly uppskattadTidMin:number; readonly ingredienser:readonly RecipeIngredientDraft[]; readonly steg:readonly RecipeStepDraft[] }
export interface RecipeGenerator { generate(input:RecipeGenerationInput,options:PortCallOptions):Promise<RecipeDraft> }
export interface PipelineDeps { readonly stores:StoreDiscovery; readonly products:ProductSearch; readonly prices:PriceSource; readonly nutrition:NutritionSource; readonly recipes:RecipeGenerator }
