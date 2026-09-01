import type { Clock } from "@/core/clock";
import type { CandidateRejection, NutrientVector, Ore, Product, RequirementRole, StoreOption } from "@/core/types";
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
export interface RecipeOptionHandle { readonly optionId:string; readonly concept:string; readonly label:string; readonly form:string; readonly coarseCategory:string; readonly dietaryTags:readonly string[] }
export interface RecipeGenerationInput { readonly portions:number; readonly vibe:string; readonly dietary:readonly string[]; readonly options:readonly RecipeOptionHandle[]; readonly validationIssues?:readonly string[]; readonly nonce?:number; readonly demoFallbackOnly?:boolean }
export interface RecipeRequirementDraft { readonly optionId:string; readonly requiredGrams?:number; readonly requiredMl?:number; readonly requiredCount?:number; readonly role:RequirementRole }
export interface RecipeStepDraft { readonly text:string; readonly durationSeconds:number; readonly optionRefs:readonly string[] }
export interface RecipeDraft { readonly title:string; readonly portions:number; readonly requirements:readonly RecipeRequirementDraft[]; readonly steps:readonly RecipeStepDraft[]; readonly estimatedCookMinutes:number; readonly explanation:string }
export interface RecipeGenerator { generate(input:RecipeGenerationInput,options:PortCallOptions):Promise<RecipeDraft> }
export interface PipelineDeps { readonly stores:StoreDiscovery; readonly products:ProductSearch; readonly prices:PriceSource; readonly nutrition:NutritionSource; readonly recipes:RecipeGenerator }
