import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

const genId = () => nanoid();

export function migrateDealContacts(db: Database.Database) {
  console.log('Running migration: add_deal_contacts');

  // Create deal_contacts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS deal_contacts (
      id TEXT PRIMARY KEY,
      deal_id TEXT NOT NULL,
      name TEXT NOT NULL,
      position TEXT,
      phone TEXT,
      email TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
    );
  `);

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_deal_contacts_deal_id ON deal_contacts(deal_id);
  `);

  // Migrate existing contact data from deals table
  const dealsWithContacts = db.prepare(`
    SELECT id, client_name, contact_phone, contact_email
    FROM deals
    WHERE client_name IS NOT NULL
  `).all() as any[];

  if (dealsWithContacts.length > 0) {
    console.log(`Migrating ${dealsWithContacts.length} existing contacts from deals table...`);

    const insertContact = db.prepare(`
      INSERT INTO deal_contacts (id, deal_id, name, position, phone, email, is_primary, "order", created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const deal of dealsWithContacts) {
      // Create primary contact from existing deal data
      insertContact.run(
        genId(),
        deal.id,
        deal.client_name,
        null, // position
        deal.contact_phone || null,
        deal.contact_email || null,
        1, // is_primary
        0, // order
        Date.now()
      );
    }

    console.log('Contact migration completed successfully');
  }

  console.log('Migration add_deal_contacts completed successfully');
}
