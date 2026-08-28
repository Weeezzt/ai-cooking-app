export type PrimatUnit = "g" | "ml" | "st" | "kg" | "l" | "m";

export interface PrimatAttribution { readonly text: string; readonly url: string }
export interface PrimatPlace { readonly latitude: number; readonly longitude: number; readonly label: string }
export interface PrimatStore {
  readonly chain: string; readonly store_id: string; readonly key: string; readonly name: string;
  readonly city: string; readonly km: number; readonly tier: "full" | "offers_only" | null;
  readonly selected: boolean; readonly confirmed_at?: string;
}
export interface PrimatResolveResponse {
  readonly place: PrimatPlace; readonly default_selection: readonly string[]; readonly stores: readonly PrimatStore[];
}
export interface PrimatProduct {
  readonly chain: string; readonly store_id: string; readonly product_id: string; readonly name: string;
  readonly brand: string | null; readonly category: string | null; readonly amount: number;
  readonly unit: PrimatUnit; readonly package: string; readonly available: boolean; readonly gtin: string | null;
  readonly prices: {
    readonly regular: number; readonly member: number | null;
    readonly multiprice: { readonly price: number; readonly quantity: number } | null;
    readonly member_multiprice?: { readonly price: number; readonly quantity: number } | null;
    readonly comparison: { readonly price: number; readonly unit: string } | null;
    readonly offer: { readonly price: number; readonly label: string; readonly valid_from: string; readonly valid_until: string } | null;
    readonly effective: number;
  };
  readonly changed_at: string; readonly confirmed_at: string;
  readonly urls: { readonly primat: string; readonly source: string };
}
export interface PrimatProductsResponse {
  readonly count: number; readonly attribution: PrimatAttribution; readonly data: readonly PrimatProduct[];
}
