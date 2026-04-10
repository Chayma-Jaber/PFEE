export interface Product {
  sku: string;
  title: string;
  id: number;
  idOrigin?: number; // Original product ID for tracking and redirection
  price: number;
  currentPrice: number;
  discount?: boolean; // Indicates if product has a discount
  discountValue?: number; // Discount percentage value
  imageInterval?: any;
  Persona: string; // Changed from persona to Persona to match API response
  activeImageIndex: number;
  complements: [];
  declinaisons: {
    id: number;
    libellet: string;
    couleur: string;
    active: boolean;
    texture?: { 
      url: string;
      ext: string;
      name: string;
      width: number;
      height: number;
      medium?: any;
    };
    images: {
      url: string;
      ext: string;
      name: string;
      width: number;
      height: number;
      medium?: {
        url: string;
        name: string;
        width: number;
        height: number;
      };
    }[];
  }[];
  categories: { id: number }[];
  Famille: string;
  Ligne: string;
  tailles: { size: string; qte: number; state?: string, ean13: string; }[];
  colors: { name: string; textureImage: string; mainImage: string }[];
  selectedColorIndex: number;
  isInWishlist: boolean;
  articlesSimilaires: {
    image: string;
    nom: string;
    prix: string;
    colors: string[];
    isInWishlist: boolean;
  }[];
  // Additional properties for API compatibility
  firstImg?: {
    url: string;
    ext: string;
    name: string;
    width: number;
    height: number;
    medium?: {
      url: string;
      name: string;
      width: number;
      height: number;
    };
  };
  secondImg?: {
    url: string;
    ext: string;
    name: string;
    width: number;
    height: number;
    medium?: {
      url: string;
      name: string;
      width: number;
      height: number;
    };
  };
}
export interface FilterOptions {
  taille: string[];
  couleur: { name: string; code: string }[];
  prix: { min: number; max: number; current: number };
  ordre: 'croissant' | 'décroissant';
}

export interface SelectedFilters {
  taille: string[];
  couleur: string[];
  prix: number;
  ordre: 'croissant' | 'décroissant';
}