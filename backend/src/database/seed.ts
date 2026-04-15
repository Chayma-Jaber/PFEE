/**
 * Barsha E-Commerce - Database Seed Script for SQL Server
 * Run with: npx ts-node -r tsconfig-paths/register src/database/seed.ts
 */
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as fs from 'fs';

async function seed() {
  const dataSource = new DataSource({
    type: 'mssql',
    host: 'DESKTOP-KOR5QAB',
    port: 1433,
    username: 'admin',
    password: 'admin123',
    database: 'barsha',
    entities: [path.resolve(__dirname, '../**/*.entity{.ts,.js}')],
    synchronize: false,
    options: { encrypt: false, trustServerCertificate: true },
  });

  await dataSource.initialize();
  console.log('Connected to SQL Server barsha database');

  const qr = dataSource.createQueryRunner();

  // ─── Seed Admin User ───
  const existingAdmin = await qr.query(
    "SELECT id FROM users WHERE email = 'admin@barsha.com.tn'"
  );
  if (existingAdmin.length === 0) {
    const passwordHash = await bcrypt.hash('Admin123!', 10);
    await qr.query(
      `INSERT INTO users (email, phone, password_hash, first_name, last_name, role, is_active, is_verified)
       VALUES ('admin@barsha.com.tn', '+21600000000', '${passwordHash}', 'Admin', 'Barsha', 'super_admin', 1, 1)`
    );
    console.log('Admin user created: admin@barsha.com.tn / Admin123!');
  } else {
    console.log('Admin user already exists');
  }

  // ─── Seed Demo Customer ───
  const existingCustomer = await qr.query(
    "SELECT id FROM users WHERE email = 'demo@barsha.com.tn'"
  );
  if (existingCustomer.length === 0) {
    const passwordHash = await bcrypt.hash('Demo123!', 10);
    await qr.query(
      `INSERT INTO users (email, phone, password_hash, first_name, last_name, role, is_active, is_verified)
       VALUES ('demo@barsha.com.tn', '+21611111111', '${passwordHash}', 'Wassim', 'Demo', 'customer', 1, 1)`
    );
    console.log('Demo customer created: demo@barsha.com.tn / Demo123!');
  }

  // ─── Seed Categories ───
  const existingCats = await qr.query("SELECT COUNT(*) as cnt FROM categories");
  if (existingCats[0].cnt === 0) {
    const categories = [
      { name: 'Femme', slug: 'femme', position: 1, is_featured: 1, is_active: 1, description: 'Collection Femme' },
      { name: 'Homme', slug: 'homme', position: 2, is_featured: 1, is_active: 1, description: 'Collection Homme' },
      { name: 'Enfant', slug: 'enfant', position: 3, is_featured: 1, is_active: 1, description: 'Collection Enfant' },
      { name: 'Accessoires', slug: 'accessoires', position: 4, is_featured: 1, is_active: 1, description: 'Accessoires' },
      { name: 'Nouveautés', slug: 'nouveautes', position: 5, is_featured: 1, is_active: 1, description: 'Nouveautés' },
      { name: 'Soldes', slug: 'soldes', position: 6, is_featured: 1, is_active: 1, description: 'Articles en promotion' },
    ];
    for (const cat of categories) {
      await qr.query(
        `INSERT INTO categories (name, slug, position, is_featured, is_active, description)
         VALUES ('${cat.name}', '${cat.slug}', ${cat.position}, ${cat.is_featured}, ${cat.is_active}, '${cat.description}')`
      );
    }
    console.log(`Seeded ${categories.length} categories`);
  }

  // ─── Seed Products from JSON ───
  const productsPath = path.resolve(__dirname, '../../data/barsha_products.json');
  if (fs.existsSync(productsPath)) {
    const existingProducts = await qr.query("SELECT COUNT(*) as cnt FROM products");
    if (existingProducts[0].cnt === 0) {
      const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
      let count = 0;

      for (const p of productsData.slice(0, 100)) { // Seed first 100 products
        const price = parseFloat(p.prix || p.price || '0') || 0;
        const currentPrice = parseFloat(p.currentPrice || p.prix || '0') || 0;
        const discount = price > 0 && currentPrice < price ? Math.round((1 - currentPrice / price) * 100) : 0;
        const title = (p.nom || p.name || '').replace(/'/g, "''");
        const desc = (p.description || '').replace(/'/g, "''").substring(0, 500);
        const sku = (p.reference || `BSH-${p.id}`).replace(/'/g, "''");
        const slug = (p.nom || p.name || `product-${p.id}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
        const famille = p.famille || 'UNISEX';
        const firstImg = (p.image || p.firstImg || '').replace(/'/g, "''");
        const secondImg = (p.secondImg || '').replace(/'/g, "''");
        const composition = (p.composition || '').replace(/'/g, "''").substring(0, 500);
        const totalStock = parseInt(p.stock || '0', 10) || 0;

        try {
          await qr.query(
            `INSERT INTO products (sku, title, slug, description, price, current_price, discount, famille, total_stock, is_active, is_featured, is_bestseller, is_new, first_image_url, second_image_url, external_id, composition, brand, view_count, order_count)
             VALUES ('${sku}', N'${title}', '${slug}', N'${desc}', ${price}, ${currentPrice}, ${discount}, '${famille}', ${totalStock}, 1, 0, 0, 0, '${firstImg}', '${secondImg}', '${p.id}', N'${composition}', 'Barsha', 0, 0)`
          );

          // Get the inserted product ID
          const inserted = await qr.query("SELECT TOP 1 id FROM products ORDER BY id DESC");
          const productId = inserted[0].id;

          // Create variants
          const couleurs = p.couleurs || p.colors || [];
          const tailles = p.tailles || p.sizes || [];
          if (Array.isArray(couleurs) && couleurs.length > 0) {
            for (const c of couleurs.slice(0, 5)) {
              const color = (typeof c === 'string' ? c : c?.name || '').replace(/'/g, "''");
              const sizes = tailles.length > 0 ? tailles.slice(0, 5) : ['TU'];
              for (const s of sizes) {
                const size = (typeof s === 'string' ? s : s?.name || 'TU').replace(/'/g, "''");
                const variantSku = `${sku}-${color}-${size}`.replace(/\s+/g, '-').toUpperCase().substring(0, 100);
                const stock = Math.floor(totalStock / Math.max(couleurs.length * sizes.length, 1));
                await qr.query(
                  `INSERT INTO product_variants (product_id, sku, couleur, taille, stock, price_adjust, position)
                   VALUES (${productId}, '${variantSku}', N'${color}', '${size}', ${stock}, 0, 0)`
                );
              }
            }
          }

          count++;
        } catch (err) {
          // Skip products with issues
        }
      }
      console.log(`Seeded ${count} products with variants`);
    } else {
      console.log(`Products already exist (${existingProducts[0].cnt})`);
    }
  }

  // ─── Seed FAQs ───
  const existingFaqs = await qr.query("SELECT COUNT(*) as cnt FROM faqs");
  if (existingFaqs[0].cnt === 0) {
    const faqs = [
      { category_slug: 'livraison', category_name: 'Livraison', question: 'Quels sont les délais de livraison ?', answer: 'La livraison standard prend 3-5 jours ouvrables en Tunisie.' },
      { category_slug: 'livraison', category_name: 'Livraison', question: 'Quels sont les frais de livraison ?', answer: 'Livraison gratuite pour les commandes de plus de 150 TND. Sinon 7 TND.' },
      { category_slug: 'retours', category_name: 'Retours', question: 'Quelle est la politique de retour ?', answer: 'Retour possible sous 14 jours.' },
      { category_slug: 'paiement', category_name: 'Paiement', question: 'Modes de paiement acceptés ?', answer: 'Carte bancaire (CTP), paiement à la livraison, cartes cadeaux.' },
      { category_slug: 'compte', category_name: 'Mon Compte', question: 'Comment creer un compte ?', answer: 'Cliquez sur Inscrire et remplissez le formulaire.' },
    ];
    for (const faq of faqs) {
      await qr.query(
        `INSERT INTO faqs (category_slug, category_name, question, answer, position, is_active, is_featured, helpful_count, not_helpful_count)
         VALUES ('${faq.category_slug}', N'${faq.category_name}', N'${faq.question}', N'${faq.answer}', 1, 1, 1, 0, 0)`
      );
    }
    console.log('FAQs seeded');
  }

  // ─── Seed Coupons ───
  const existingCoupons = await qr.query("SELECT COUNT(*) as cnt FROM coupons");
  if (existingCoupons[0].cnt === 0) {
    await qr.query(
      `INSERT INTO coupons (code, description, discount_type, discount_value, min_purchase, max_discount, usage_limit, usage_count, is_active, per_user_limit, applies_to)
       VALUES ('WELCOME10', N'10% de réduction nouveaux clients', 'PERCENTAGE', 10, 50, 30, 1000, 0, 1, 1, 'ALL')`
    );
    await qr.query(
      `INSERT INTO coupons (code, description, discount_type, discount_value, min_purchase, max_discount, usage_limit, usage_count, is_active, per_user_limit, applies_to)
       VALUES ('BARSHA20', N'20% de réduction spéciale', 'PERCENTAGE', 20, 100, 50, 500, 0, 1, 1, 'ALL')`
    );
    console.log('Coupons seeded');
  }

  // ─── Seed Banners ───
  const existingBanners = await qr.query("SELECT COUNT(*) as cnt FROM banners");
  if (existingBanners[0].cnt === 0) {
    await qr.query(
      `INSERT INTO banners (title, subtitle, image_url, link_url, position, is_active)
       VALUES (N'Collection Été 2026', N'Découvrez les nouveautés', 'https://images.zen.com.tn/barsha/Plan_de_travail_1_copie_100_ce5184b57e.jpg', '/tn/1-femme', 1, 1)`
    );
    await qr.query(
      `INSERT INTO banners (title, subtitle, image_url, link_url, position, is_active)
       VALUES (N'Soldes -50%', N'Sur une selection d articles', 'https://images.zen.com.tn/barsha/Plan_de_travail_1_copie_2_100_1aef92deda.jpg', '/tn/14-promotion-femme', 2, 1)`
    );
    console.log('Banners seeded');
  }

  await dataSource.destroy();
  console.log('Seed complete!');
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
