/**
 * Barsha E-Commerce - Full Realistic Data Seed for SQL Server
 * Seeds: customers, addresses, orders, reviews, support tickets,
 * loyalty, gift cards, outfits, promotions, newsletter, notifications
 */
import * as bcrypt from 'bcrypt';

const sql = require('mssql');

const CONFIG = {
  server: 'DESKTOP-KOR5QAB',
  user: 'admin',
  password: 'admin123',
  database: 'barsha',
  options: { encrypt: false, trustServerCertificate: true },
};

function esc(s: string): string {
  return (s || '').replace(/'/g, "''");
}

function randomDate(start: Date, end: Date): string {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function randomPrice(min: number, max: number): string {
  return (min + Math.random() * (max - min)).toFixed(3);
}

async function seed() {
  const pool = await sql.connect(CONFIG);
  console.log('Connected to SQL Server barsha database');

  const q = (query: string) => pool.request().query(query);
  const count = async (table: string) => {
    const r = await q(`SELECT COUNT(*) as cnt FROM ${table}`);
    return r.recordset[0].cnt;
  };

  // ─── CUSTOMERS ───
  if ((await count('users')) < 10) {
    console.log('Seeding customers...');
    const customers = [
      { email: 'sarah.benali@gmail.com', phone: '+21622334455', first: 'Sarah', last: 'Ben Ali', gender: 'female' },
      { email: 'ahmed.trabelsi@gmail.com', phone: '+21655667788', first: 'Ahmed', last: 'Trabelsi', gender: 'male' },
      { email: 'fatma.bouazizi@yahoo.fr', phone: '+21698112233', first: 'Fatma', last: 'Bouazizi', gender: 'female' },
      { email: 'youssef.hammami@outlook.com', phone: '+21650443322', first: 'Youssef', last: 'Hammami', gender: 'male' },
      { email: 'amira.jebali@gmail.com', phone: '+21629887766', first: 'Amira', last: 'Jebali', gender: 'female' },
      { email: 'mehdi.chaabane@gmail.com', phone: '+21655998877', first: 'Mehdi', last: 'Chaabane', gender: 'male' },
      { email: 'ines.maaloul@gmail.com', phone: '+21622556677', first: 'Ines', last: 'Maaloul', gender: 'female' },
      { email: 'karim.gharbi@gmail.com', phone: '+21698223344', first: 'Karim', last: 'Gharbi', gender: 'male' },
    ];
    const hash = await bcrypt.hash('Customer123!', 10);
    for (const c of customers) {
      await q(`INSERT INTO users (email, phone, password_hash, first_name, last_name, gender, role, is_active, is_verified)
               VALUES ('${c.email}', '${c.phone}', '${hash}', N'${c.first}', N'${c.last}', '${c.gender}', 'customer', 1, 1)`);
    }
    console.log(`  ${customers.length} customers created`);
  }

  // Get user IDs
  const users = (await q("SELECT id, email FROM users WHERE role='customer'")).recordset;
  const adminUser = (await q("SELECT id FROM users WHERE role='super_admin'")).recordset[0];

  // ─── ADDRESSES ───
  if ((await count('addresses')) === 0) {
    console.log('Seeding addresses...');
    const cities = ['Tunis', 'Sousse', 'Sfax', 'Monastir', 'Nabeul', 'Bizerte', 'Gabes', 'Kairouan'];
    for (const u of users) {
      const city = cities[Math.floor(Math.random() * cities.length)];
      await q(`INSERT INTO addresses (user_id, label, first_name, last_name, phone, street, city, state, postal_code, country, is_default, is_billing, is_shipping)
               VALUES (${u.id}, 'Domicile', N'${esc(u.email.split('@')[0])}', 'Client', '+21600000000', N'${Math.floor(Math.random()*100)+1} Rue de la Liberte', N'${city}', N'${city}', '${1000+Math.floor(Math.random()*9000)}', 'TN', 1, 1, 1)`);
    }
    console.log(`  ${users.length} addresses created`);
  }

  // Get product IDs
  const products = (await q("SELECT id, title, price, current_price FROM products")).recordset;

  // ─── PRODUCT VARIANTS (if missing) ───
  if ((await count('product_variants')) === 0) {
    console.log('Seeding product variants...');
    const colors = ['NOIR', 'BLANC', 'BLEU', 'ROUGE', 'BEIGE', 'GRIS', 'ROSE', 'VERT'];
    const sizes = ['S', 'M', 'L', 'XL'];
    let varCount = 0;
    for (const p of products) {
      const numColors = 2 + Math.floor(Math.random() * 3);
      const selectedColors = colors.sort(() => Math.random() - 0.5).slice(0, numColors);
      for (const color of selectedColors) {
        for (const size of sizes) {
          const stock = Math.floor(Math.random() * 15) + 1;
          await q(`INSERT INTO product_variants (product_id, sku, couleur, taille, stock, price_adjust, position)
                   VALUES (${p.id}, 'BSH-${p.id}-${color}-${size}', N'${color}', '${size}', ${stock}, 0, 0)`);
          varCount++;
        }
      }
    }
    console.log(`  ${varCount} variants created`);
  }

  // ─── ORDERS ───
  if ((await count('orders')) === 0) {
    console.log('Seeding orders...');
    const statuses = ['delivered', 'delivered', 'delivered', 'shipped', 'processing', 'confirmed', 'pending', 'cancelled'];
    const paymentStatuses = ['paid', 'paid', 'paid', 'paid', 'pending', 'pending', 'pending', 'failed'];
    const methods = ['ctp', 'cod', 'ctp', 'ctp', 'cod'];

    for (let i = 0; i < 25; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const payStatus = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
      const method = methods[Math.floor(Math.random() * methods.length)];
      const numItems = 1 + Math.floor(Math.random() * 4);
      let subtotal = 0;
      const orderDate = randomDate(new Date('2026-01-01'), new Date('2026-04-14'));
      const ref = `ORD-2026${String(i+1).padStart(5, '0')}`;
      const shipping = subtotal > 150 ? 0 : 7;

      // Calculate subtotal from random products
      const orderProducts = [];
      for (let j = 0; j < numItems; j++) {
        const prod = products[Math.floor(Math.random() * products.length)];
        const qty = 1 + Math.floor(Math.random() * 3);
        const price = prod.current_price || prod.price;
        subtotal += price * qty;
        orderProducts.push({ prod, qty, price });
      }

      const total = subtotal + shipping;
      const addr = JSON.stringify({firstName:'Client',lastName:'Barsha',street:'Rue Test',city:'Tunis',postalCode:'1000',country:'TN'}).replace(/'/g, "''");

      await q(`INSERT INTO orders (reference, user_id, status, payment_status, subtotal, discount_amount, shipping_amount, tax_amount, total_amount, shipping_address, shipping_method, payment_method, source, created_at)
               VALUES ('${ref}', ${user.id}, '${status}', '${payStatus}', ${subtotal.toFixed(3)}, 0, ${shipping}, 0, ${total.toFixed(3)}, N'${addr}', 'standard', '${method}', 'web', '${orderDate}')`);

      // Get the order ID
      const orderResult = await q(`SELECT TOP 1 id FROM orders WHERE reference='${ref}'`);
      const orderId = orderResult.recordset[0].id;

      // Insert order items
      for (const item of orderProducts) {
        await q(`INSERT INTO order_items (order_id, product_id, sku, title, unit_price, quantity, discount_amount)
                 VALUES (${orderId}, ${item.prod.id}, 'BSH-${item.prod.id}', N'${esc(item.prod.title)}', ${item.price}, ${item.qty}, 0)`);
      }
    }
    console.log('  25 orders with items created');
  }

  // ─── SUPPORT TICKETS ───
  if ((await count('support_tickets')) === 0) {
    console.log('Seeding support tickets...');
    const subjects = [
      'Probleme de livraison', 'Article endommage', 'Demande de remboursement',
      'Question sur ma commande', 'Taille incorrecte', 'Suivi de colis',
      'Demande echange', 'Probleme de paiement'
    ];
    const ticketStatuses = ['open', 'in_progress', 'resolved', 'closed', 'open', 'waiting_customer'];
    const priorities = ['low', 'medium', 'high', 'medium', 'low'];

    for (let i = 0; i < 12; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const subject = subjects[Math.floor(Math.random() * subjects.length)];
      const status = ticketStatuses[Math.floor(Math.random() * ticketStatuses.length)];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      const date = randomDate(new Date('2026-02-01'), new Date('2026-04-14'));

      await q(`INSERT INTO support_tickets (user_id, subject, description, category, priority, status, contact_email, created_at)
               VALUES (${user.id}, N'${subject}', N'Bonjour, j ai un probleme avec ma commande recente.', 'order', '${priority}', '${status}', '${user.email}', '${date}')`);

      const ticketResult = await q(`SELECT TOP 1 id FROM support_tickets ORDER BY id DESC`);
      const ticketId = ticketResult.recordset[0].id;

      await q(`INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message, is_internal, created_at)
               VALUES (${ticketId}, ${user.id}, 'customer', N'Bonjour, j ai besoin d aide avec ma commande.', 0, '${date}')`);

      if (status !== 'open') {
        await q(`INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message, is_internal, created_at)
                 VALUES (${ticketId}, ${adminUser.id}, 'agent', N'Bonjour, nous avons bien recu votre demande. Nous allons traiter votre dossier.', 0, '${date}')`);
      }
    }
    console.log('  12 support tickets with messages created');
  }

  // ─── PRODUCT REVIEWS ───
  if ((await count('product_reviews')) === 0) {
    console.log('Seeding product reviews...');
    const comments = [
      'Tres beau produit, je recommande!', 'Bonne qualite, taille correcte.',
      'Un peu cher mais belle matiere.', 'Parfait pour la saison.',
      'Livraison rapide, article conforme.', 'Couleur fidele a la photo.',
      'Bon rapport qualite-prix.', 'Confortable et elegant.',
    ];
    for (let i = 0; i < 30; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const product = products[Math.floor(Math.random() * products.length)];
      const rating = 3 + Math.floor(Math.random() * 3); // 3-5
      const comment = comments[Math.floor(Math.random() * comments.length)];
      const date = randomDate(new Date('2026-01-15'), new Date('2026-04-14'));

      try {
        await q(`INSERT INTO product_reviews (product_id, user_id, rating, title, comment, is_verified_purchase, is_approved, helpful_count, not_helpful_count, created_at)
                 VALUES (${product.id}, ${user.id}, ${rating}, N'Avis client', N'${comment}', 1, 1, ${Math.floor(Math.random()*10)}, ${Math.floor(Math.random()*3)}, '${date}')`);
      } catch(e) { /* skip duplicates */ }
    }
    console.log('  ~30 product reviews created');
  }

  // ─── LOYALTY ACCOUNTS ───
  if ((await count('loyalty_accounts')) === 0) {
    console.log('Seeding loyalty accounts...');
    const tiers = ['BRONZE', 'BRONZE', 'SILVER', 'SILVER', 'GOLD', 'BRONZE', 'BRONZE', 'PLATINUM'];
    for (let i = 0; i < users.length; i++) {
      const points = Math.floor(Math.random() * 5000);
      const tier = tiers[i % tiers.length];
      await q(`INSERT INTO loyalty_accounts (user_id, total_points, available_points, lifetime_points, tier)
               VALUES (${users[i].id}, ${points}, ${points}, ${points + Math.floor(Math.random()*2000)}, '${tier}')`);

      const accResult = await q(`SELECT TOP 1 id FROM loyalty_accounts WHERE user_id=${users[i].id}`);
      const accId = accResult.recordset[0].id;

      // Add some transactions
      for (let j = 0; j < 3; j++) {
        const txPoints = 50 + Math.floor(Math.random() * 200);
        const date = randomDate(new Date('2026-01-01'), new Date('2026-04-14'));
        await q(`INSERT INTO loyalty_transactions (account_id, points, type, description, created_at)
                 VALUES (${accId}, ${txPoints}, 'EARN', N'Achat en ligne', '${date}')`);
      }
    }
    console.log(`  ${users.length} loyalty accounts with transactions created`);
  }

  // ─── GIFT CARDS ───
  if ((await count('gift_cards')) === 0) {
    console.log('Seeding gift cards...');
    const amounts = [25, 50, 75, 100, 150];
    for (let i = 0; i < 8; i++) {
      const amount = amounts[Math.floor(Math.random() * amounts.length)];
      const balance = Math.random() > 0.3 ? amount : amount * Math.random();
      const code = `GIFT-${String(1000 + i).padStart(4, '0')}-${String(Math.floor(Math.random()*9999)).padStart(4, '0')}`;
      const sender = users[Math.floor(Math.random() * users.length)];
      const isRedeemed = balance < amount ? 1 : 0;
      const date = randomDate(new Date('2026-01-01'), new Date('2026-04-14'));

      await q(`INSERT INTO gift_cards (code, amount, balance, currency, sender_id, recipient_email, recipient_name, sender_name, message, is_active, is_redeemed, purchased_at, created_at)
               VALUES ('${code}', ${amount}, ${balance.toFixed(3)}, 'TND', ${sender.id}, 'ami@example.com', N'Un ami', N'${esc(sender.email.split('@')[0])}', N'Joyeux anniversaire!', 1, ${isRedeemed}, '${date}', '${date}')`);
    }
    console.log('  8 gift cards created');
  }

  // ─── STORE CREDITS ───
  if ((await count('store_credits')) === 0) {
    console.log('Seeding store credits...');
    for (const u of users.slice(0, 4)) {
      const balance = (10 + Math.random() * 50).toFixed(3);
      await q(`INSERT INTO store_credits (user_id, balance, currency)
               VALUES (${u.id}, ${balance}, 'TND')`);
    }
    console.log('  4 store credits created');
  }

  // ─── OUTFITS ───
  if ((await count('outfits')) === 0) {
    console.log('Seeding outfits...');
    const outfitNames = [
      { name: 'Look Bureau Chic', desc: 'Un ensemble elegant pour le bureau', occasion: 'bureau' },
      { name: 'Style Decontracte', desc: 'Parfait pour le weekend', occasion: 'casual' },
      { name: 'Soiree Elegante', desc: 'Pour une soiree speciale', occasion: 'soiree' },
      { name: 'Look Sportif', desc: 'Confort et style au quotidien', occasion: 'sport' },
    ];
    for (const o of outfitNames) {
      const prods = products.sort(() => Math.random() - 0.5).slice(0, 3).map((p: any) => p.id);
      const totalPrice = products.filter((p: any) => prods.includes(p.id)).reduce((sum: number, p: any) => sum + (p.current_price || p.price), 0);
      const prodsJson = JSON.stringify(prods).replace(/'/g, "''");
      await q(`INSERT INTO outfits (name, description, occasion, products, total_price, savings, is_published, view_count, like_count, created_by)
               VALUES (N'${o.name}', N'${o.desc}', '${o.occasion}', '${prodsJson}', ${totalPrice.toFixed(3)}, ${(totalPrice*0.1).toFixed(3)}, 1, ${Math.floor(Math.random()*200)}, ${Math.floor(Math.random()*50)}, ${adminUser.id})`);
    }
    console.log('  4 outfits created');
  }

  // ─── PROMOTIONS ───
  if ((await count('promotions')) === 0) {
    console.log('Seeding promotions...');
    await q(`INSERT INTO promotions (name, description, type, discount_type, discount_value, is_active, priority, valid_from, valid_to)
             VALUES (N'Soldes Ete 2026', N'Jusqu a -40% sur une selection', 'FLASH_SALE', 'PERCENTAGE', 40, 1, 1, '2026-04-01', '2026-06-30')`);
    await q(`INSERT INTO promotions (name, description, type, discount_type, discount_value, is_active, priority, valid_from, valid_to)
             VALUES (N'Vente Flash Weekend', N'-25% ce weekend seulement', 'FLASH_SALE', 'PERCENTAGE', 25, 1, 2, '2026-04-12', '2026-04-14')`);
    console.log('  2 promotions created');
  }

  // ─── NEWSLETTER SUBSCRIBERS ───
  if ((await count('newsletter_subscribers')) === 0) {
    console.log('Seeding newsletter subscribers...');
    for (const u of users) {
      await q(`INSERT INTO newsletter_subscribers (email, first_name, source, is_confirmed)
               VALUES ('${u.email}', N'${esc(u.email.split('@')[0])}', 'footer', 1)`);
    }
    console.log(`  ${users.length} newsletter subscribers created`);
  }

  // ─── NOTIFICATIONS ───
  if ((await count('notifications')) === 0) {
    console.log('Seeding notifications...');
    for (const u of users.slice(0, 5)) {
      const date = randomDate(new Date('2026-03-01'), new Date('2026-04-14'));
      await q(`INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
               VALUES (${u.id}, 'ORDER', N'Commande confirmee', N'Votre commande a ete confirmee et sera expediee bientot.', 0, '${date}')`);
      await q(`INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
               VALUES (${u.id}, 'PROMOTION', N'Soldes Barsha', N'Profitez de -40% sur notre collection ete!', 0, '${date}')`);
    }
    console.log('  10 notifications created');
  }

  // ─── WISHLIST ───
  if ((await count('wishlist_items')) === 0) {
    console.log('Seeding wishlist items...');
    for (const u of users.slice(0, 5)) {
      const wishProds = products.sort(() => Math.random() - 0.5).slice(0, 3);
      for (const p of wishProds) {
        await q(`INSERT INTO wishlist_items (user_id, product_id)
                 VALUES (${u.id}, ${p.id})`);
      }
    }
    console.log('  ~15 wishlist items created');
  }

  // ─── RETURN REQUESTS ───
  if ((await count('return_requests')) === 0) {
    console.log('Seeding return requests...');
    const orders = (await q("SELECT TOP 5 id, user_id FROM orders WHERE status='delivered'")).recordset;
    const returnStatuses = ['pending', 'approved', 'rejected', 'pending', 'approved'];
    for (let i = 0; i < Math.min(orders.length, 4); i++) {
      const o = orders[i];
      const status = returnStatuses[i];
      const date = randomDate(new Date('2026-03-01'), new Date('2026-04-14'));
      await q(`INSERT INTO return_requests (order_id, user_id, status, reason, description, created_at)
               VALUES (${o.id}, ${o.user_id}, '${status}', N'Taille incorrecte', N'L article ne correspond pas a la taille commandee.', '${date}')`);
    }
    console.log(`  ${Math.min(orders.length, 4)} return requests created`);
  }

  // ─── Verify final counts ───
  console.log('\n=== FINAL DATABASE STATUS ===');
  const tables = (await q("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")).recordset;
  for (const t of tables) {
    const c = await count(t.TABLE_NAME);
    if (c > 0) console.log(`  ${String(c).padStart(4)} ${t.TABLE_NAME}`);
  }

  await sql.close();
  console.log('\nSeed complete!');
}

seed().catch(err => { console.error('Seed failed:', err.message); sql.close(); process.exit(1); });
