/**
 * E-Commerce Product Taxonomy Enrichment & Relation Discovery Engine
 * Implements concepts from E-Commerce Ontology Mining:
 * 1. Taxonomy Enrichment: Attaching fine-grained categories to core taxonomy
 * 2. Attribute Applicability: Validating whether an attribute belongs to a product category
 * 3. Attribute Importance: Scoring decision-relevance of attributes (0.0 to 1.0)
 */

export interface TaxonomyNode {
  categoryId: string;
  categoryName: string;
  hypernymPath: string[]; // e.g. ["Apparel", "Baby & Toddler", "Rompers & Onesies"]
  applicableAttributes: string[];
}

export interface AttributeRelation {
  name: string;
  value: any;
  unitCode?: string;
  isApplicable: boolean;
  importanceScore: number; // 0.0 to 1.0
}

/**
 * Core E-Commerce Category Taxonomies with Applicable Attributes
 */
const CATEGORY_TAXONOMY_MAP: Record<string, TaxonomyNode> = {
  "rompers": {
    categoryId: "cat_apparel_rompers",
    categoryName: "Baby & Toddler Rompers",
    hypernymPath: ["Apparel & Accessories", "Baby & Toddler Clothing", "Rompers & Onesies"],
    applicableAttributes: [
      "Shipping Weight", "Material", "Factory Location", "MOQ", 
      "Korean Benchmark Retail Price", "Estimated ROI Margin", "Closure Type", "Target Gender"
    ]
  },
  "electronics": {
    categoryId: "cat_consumer_electronics",
    categoryName: "Consumer Electronics",
    hypernymPath: ["Electronics", "Gadgets & Accessories"],
    applicableAttributes: [
      "Shipping Weight", "Battery Capacity", "Voltage", "MOQ", 
      "Korean Benchmark Retail Price", "Estimated ROI Margin", "Factory Location"
    ]
  },
  "living": {
    categoryId: "cat_home_living",
    categoryName: "Home & Living Accessories",
    hypernymPath: ["Home & Garden", "Kitchen & Living"],
    applicableAttributes: [
      "Shipping Weight", "Material", "Dimensions", "MOQ", 
      "Korean Benchmark Retail Price", "Estimated ROI Margin", "Factory Location"
    ]
  }
};

/**
 * Attribute Importance Dictionary (How much customers care during purchase decisions)
 */
const ATTRIBUTE_IMPORTANCE_SCORES: Record<string, number> = {
  "MOQ": 0.95,
  "Estimated ROI Margin": 0.95,
  "Korean Benchmark Retail Price": 0.90,
  "Shipping Weight": 0.85,
  "Material": 0.85,
  "Factory Location": 0.70,
  "Battery Capacity": 0.85,
  "Closure Type": 0.50,
  "Target Gender": 0.60
};

/**
 * Detect product category taxonomy node from product title & text
 */
export function resolveProductTaxonomy(title: string): TaxonomyNode {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('romper') || lowerTitle.includes('onesie') || lowerTitle.includes('롬퍼') || lowerTitle.includes('아동복')) {
    return CATEGORY_TAXONOMY_MAP["rompers"];
  }
  if (lowerTitle.includes('charger') || lowerTitle.includes('battery') || lowerTitle.includes('usb') || lowerTitle.includes('전자기기')) {
    return CATEGORY_TAXONOMY_MAP["electronics"];
  }
  
  return CATEGORY_TAXONOMY_MAP["living"];
}

/**
 * Validate Attribute Applicability & Calculate Importance Scores
 */
export function enrichProductRelations(taxonomy: TaxonomyNode, rawProperties: any[]): AttributeRelation[] {
  if (!Array.isArray(rawProperties)) return [];

  return rawProperties.map(prop => {
    const name = prop.name;
    const isApplicable = taxonomy.applicableAttributes.includes(name);
    const importanceScore = ATTRIBUTE_IMPORTANCE_SCORES[name] || 0.50;

    return {
      name: prop.name,
      value: prop.value,
      unitCode: prop.unitCode,
      isApplicable,
      importanceScore
    };
  });
}

/**
 * Enriches a raw JSON-LD product document with Taxonomy Tree & Attribute Relations
 */
export function miningEnrichJsonLd(dataJsonLd: any): any {
  if (!dataJsonLd) return dataJsonLd;

  const title = dataJsonLd.name || "Product";
  const taxonomy = resolveProductTaxonomy(title);
  const enrichedProperties = enrichProductRelations(taxonomy, dataJsonLd.additionalProperty || []);

  // Filter out non-applicable attributes (Knowledge Cleaning)
  const cleanProperties = enrichedProperties.filter(p => p.isApplicable);

  return {
    ...dataJsonLd,
    taxonomyHierarchy: {
      categoryPath: taxonomy.hypernymPath,
      fineGrainedCategory: taxonomy.categoryName,
      categoryId: taxonomy.categoryId
    },
    additionalProperty: cleanProperties,
    attributeImportanceMap: cleanProperties.reduce((acc: any, curr) => {
      acc[curr.name] = curr.importanceScore;
      return acc;
    }, {})
  };
}
