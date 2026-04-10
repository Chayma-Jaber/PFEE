export interface Category {
  id: number;
  idOrigin?: number;
  name: string;
  link: string;
  publicName: string;
  position: number;
  parentCategory: number | null;
  subCategories: Category[];
  // SEO metadata fields
  metaTitle?: string;
  keywords?: string;
  metaDescription?: string;
  htmlDescription?: string;
  fontColor?: string;
}

export interface CategoryTitle {
  id: number;
  name: string;
  publicName?: string;
  link: string;
  parentCategory: number;
  idorigin?: number;
}

export interface ProductTitle {
  id: number;
  title: string;
  category: number;
}

export interface SearchResult {
  text: string;
  type: 'category' | 'product';
  id: number;
  link?: string;
  parentCategory?: number;
}