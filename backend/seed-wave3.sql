-- Wave 3 demo data: homepage blocks, A/B tests, product positions, sample shipment

IF NOT EXISTS (SELECT 1 FROM homepage_blocks)
BEGIN
  INSERT INTO homepage_blocks ([key], title, type, config, position, is_active, created_at, updated_at) VALUES
  ('hero-soldes', N'Soldes Été -40%', 'banner', N'{"imageUrl":"/assets/images/hero-banner.jpg","ctaUrl":"/tn/shop"}', 1, 1, GETDATE(), GETDATE()),
  ('bestsellers', N'Nos best-sellers', 'products_carousel', N'{"limit":8}', 2, 1, GETDATE(), GETDATE()),
  ('femme-section', N'Collection Femme', 'category_grid', N'{"categorySlugs":["femme"]}', 3, 1, GETDATE(), GETDATE()),
  ('new-arrivals', N'Nouveautés', 'products_carousel', N'{"limit":6}', 4, 1, GETDATE(), GETDATE());
END;

IF NOT EXISTS (SELECT 1 FROM ab_tests)
BEGIN
  INSERT INTO ab_tests ([key], name, variants, is_active, goal_event, created_at, updated_at) VALUES
  ('hero-cta-color', N'Hero CTA color', N'[{"id":"A","label":"Black","weight":50,"config":{"color":"#000"}},{"id":"B","label":"Pink","weight":50,"config":{"color":"#ec4899"}}]', 1, 'ADD_TO_CART', GETDATE(), GETDATE()),
  ('free-ship-threshold', N'Free shipping threshold', N'[{"id":"A","label":"150 TND","weight":50,"config":{"threshold":150}},{"id":"B","label":"120 TND","weight":50,"config":{"threshold":120}}]', 1, 'COMPLETE_PURCHASE', GETDATE(), GETDATE());
END;

IF NOT EXISTS (SELECT 1 FROM product_positions)
BEGIN
  INSERT INTO product_positions (category_id, product_id, position, created_at)
  SELECT TOP 5 1, id, ROW_NUMBER() OVER (ORDER BY id), GETDATE() FROM products WHERE is_active = 1 ORDER BY id;
END;
