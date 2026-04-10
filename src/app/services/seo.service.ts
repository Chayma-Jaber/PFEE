import { Injectable } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  constructor(private title: Title, private meta: Meta) {}

  /**
   * Update the page title with proper formatting
   * @param title The title to set
   */
  updateTitle(title: string) {
    this.title.setTitle(`${title} | Barsha`);
  }

  /**
   * Update the meta description tag
   * @param content The description content
   */
  updateDescription(content: string) {
    // Ensure description is not too long (Google typically displays ~155-160 characters)
    const trimmedContent = content.length > 160 ? content.substring(0, 157) + '...' : content;
    this.meta.updateTag({ name: 'description', content: trimmedContent });
  }

  /**
   * Update the meta keywords tag
   * @param content The keywords content
   */
  updateKeywords(content: string) {
    this.meta.updateTag({ name: 'keywords', content });
  }

  /**
   * Update the canonical URL
   * @param url The canonical URL to set
   */
  updateCanonicalUrl(url: string) {
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /**
   * Add structured data to the page
   * @param data The structured data object
   */
  addStructuredData(data: any) {
    let script = document.querySelector('#structured-data') as HTMLScriptElement | null;
    if (script) {
      document.head.removeChild(script);
    }

    script = document.createElement('script') as HTMLScriptElement;
    script.id = 'structured-data';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    document.head.appendChild(script);
  }

  /**
   * Set all SEO metadata for a page in one call
   * @param title Page title
   * @param description Meta description
   * @param keywords Meta keywords
   * @param canonicalUrl Canonical URL
   * @param structuredData Optional structured data
   */
  setAllMetadata(title: string, description: string, keywords: string, canonicalUrl: string, structuredData?: any) {
    this.updateTitle(title);
    this.updateDescription(description);
    this.updateKeywords(keywords);
    this.updateCanonicalUrl(canonicalUrl);

    if (structuredData) {
      this.addStructuredData(structuredData);
    }
  }

  addSitelinksSearchBox() {
    const sitelinksData = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      'url': 'https://www.barsha.com.tn/fr/',
      'potentialAction': {
        '@type': 'SearchAction',
        'target': {
          '@type': 'EntryPoint',
          'urlTemplate': 'https://www.barsha.com.tn/fr/search?q={search_term_string}'
        },
        'query-input': 'required name=search_term_string'
      }
    };
    this.addStructuredData(sitelinksData);
  }

  addProductSitelinks(product: any) {
    const productData = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      'name': product.title,
      'image': product.colors[0]?.mainImage || '',
      'description': product.description || '',
      'brand': {
        '@type': 'Brand',
        'name': 'Barsha'
      },
      'offers': {
        '@type': 'Offer',
        'price': product.price,
        'priceCurrency': 'TND',
        'availability': product.tailles?.some((t: any) => t.qte > 0) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        'url': `https://www.barsha.com.tn/fr/tn/${product.id}-${product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      }
    };
    this.addStructuredData(productData);
  }

  /**
   * Add enhanced category sitelinks for better search results display
   * @param category The category object
   */
  addCategorySitelinks(category: any) {
    // Generate a clean URL slug from the category name
    const categorySlug = category.name.toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Create the canonical URL for the category
    const categoryUrl = `https://www.barsha.com.tn/fr/tn/${category.id}-${categorySlug}`;

    // Create enhanced structured data for the category
    const categoryData = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': category.metaTitle || category.name,
      'description': category.metaDescription || `Découvrez notre collection ${category.name} chez Barsha. Retrouvez les dernières tendances mode et des vêtements de qualité.`,
      'url': categoryUrl,
      'provider': {
        '@type': 'Organization',
        'name': 'Barsha',
        'url': 'https://www.barsha.com.tn',
        'logo': 'https://www.barsha.com.tn/assets/images/logo.png'
      },
      'potentialAction': {
        '@type': 'ViewAction',
        'target': categoryUrl
      }
    };

    // Add the structured data to the page
    this.addStructuredData(categoryData);
  }
}