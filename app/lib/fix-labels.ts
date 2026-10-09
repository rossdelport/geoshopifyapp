// Plain-English names for each kind of fix (shared by server and UI).

export const FIX_TYPE_LABELS: Record<string, string> = {
  product_description: "Clearer product description",
  product_faq: "Product FAQs",
  product_seo: "Search title & description",
  product_title: "Clearer product title",
  product_type: "Product type",
  guide_page: "New buying guide page",
};

export interface FaqItem {
  q: string;
  a: string;
}

/** New values a fix will publish. */
export interface FixAfter {
  title?: string;
  descriptionHtml?: string;
  seoTitle?: string;
  seoDescription?: string;
  productType?: string;
  faq?: FaqItem[];
  handle?: string;
  bodyHtml?: string;
}

/** What was there before (from our cache when suggested, from Shopify when published). */
export interface FixBefore {
  title?: string;
  description?: string;
  descriptionHtml?: string;
  productType?: string;
  seoTitle?: string;
  seoDescription?: string;
  seo?: { title?: string | null; description?: string | null } | null;
  faq?: string | null;
}
