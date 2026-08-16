export type NutCategory = 
  | 'vers-gebrand' 
  | 'rauw' 
  | 'mixen' 
  | 'zoutjes-pinda' 
  | 'zuidvruchten' 
  | 'chocolade-cadeau';

export type Allergen = 
  | 'peanuts' 
  | 'tree-nuts' 
  | 'gluten' 
  | 'lactose' 
  | 'sesame' 
  | 'soy';

export type DietaryTag = 
  | 'vegan' 
  | 'keto' 
  | 'raw' 
  | 'organic' 
  | 'low-carb' 
  | 'high-protein' 
  | 'gluten-free' 
  | 'sugar-free';

export interface NutProduct {
  id: string;
  name: string;
  dutchCategoryName: string;
  category: NutCategory;
  pricePer100g: number;
  pricePer250g: number;
  pricePer500g: number;
  pricePer1000g: number;
  description: string;
  allergens: Allergen[];
  dietary: DietaryTag[];
  origin: string;
  tasteProfile: string;
  imageUrl: string;
  recommendedOccasions: string[];
  isPopular?: boolean;
  inStock: boolean;
}

export interface UserPreferences {
  occasion: string; // e.g. "borrel", "gezond-tussendoortje", "sport", "cadeau", "feest"
  peopleCount: number;
  budget: number; // in Euros
  mixPreference: string; // e.g. "luxe-ongebrand", "vers-gebrand-gezouten", "zoutjes-pinda", "luxe-borrelplank", "zoet-en-hartig"
  dietary: DietaryTag[];
  allergensToAvoid: Allergen[];
  customNotes: string;
  avgConsented: boolean;
}

export interface RecommendationItem {
  productId: string;
  productName: string;
  packageSizeGrams: number; // e.g. 250, 500, 1000
  packageCount: number;
  pricePerUnit: number;
  subtotalPrice: number;
  reasoning: string;
  product?: NutProduct;
}

export interface NutRecommendation {
  id: string;
  title: string;
  createdAt: string;
  introduction: string;
  portionAdvice: string;
  items: RecommendationItem[];
  totalWeightGrams: number;
  totalPrice: number;
  budgetStatus: 'within' | 'slightly-over' | 'under';
  dietaryGuarantees: string[];
  presentationTips: string[];
  originalPreferences: UserPreferences;
}

export interface CartItem {
  id: string;
  product: NutProduct;
  packageSizeGrams: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isCustomMix?: boolean;
  mixTitle?: string;
}

export interface SavedConfiguration {
  id: string;
  name: string;
  savedAt: string;
  recommendation: NutRecommendation;
  emailSentTo?: string;
}

export interface CheckoutFormData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  paymentMethod: 'ideal' | 'bancontact' | 'creditcard' | 'applepay';
  notes?: string;
  agreeTerms: boolean;
}
