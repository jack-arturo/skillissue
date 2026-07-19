CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  organization TEXT,
  source TEXT DEFAULT 'lead-capture',
  consent_status TEXT NOT NULL DEFAULT 'subscribed' CHECK (consent_status IN ('subscribed', 'pending', 'unsubscribed')),
  consented_at TEXT,
  unsubscribed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_consent ON contacts(consent_status);

CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  schema TEXT NOT NULL,
  email_template_key TEXT DEFAULT 'lead-confirmation',
  notify_template_key TEXT DEFAULT 'internal-notification',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id TEXT NOT NULL,
  contact_id INTEGER,
  email TEXT NOT NULL,
  data TEXT NOT NULL,
  source TEXT DEFAULT 'lead-capture',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_contact ON submissions(contact_id);
CREATE INDEX IF NOT EXISTS idx_submissions_form ON submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

CREATE TABLE IF NOT EXISTS email_templates (
  key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('subject', 'html', 'text')),
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (key, channel)
);

CREATE TABLE IF NOT EXISTS email_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER,
  submission_id INTEGER,
  template_key TEXT,
  provider TEXT DEFAULT 'resend',
  provider_id TEXT,
  to_email TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);

CREATE INDEX IF NOT EXISTS idx_email_events_contact ON email_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_events_submission ON email_events(submission_id);
CREATE INDEX IF NOT EXISTS idx_email_events_created ON email_events(created_at DESC);

CREATE VIEW IF NOT EXISTS lead_capture_stats AS
SELECT
  (SELECT COUNT(*) FROM contacts) AS total_contacts,
  (SELECT COUNT(*) FROM contacts WHERE consent_status = 'subscribed') AS subscribed_contacts,
  (SELECT COUNT(*) FROM contacts WHERE consent_status = 'unsubscribed') AS unsubscribed_contacts,
  (SELECT COUNT(*) FROM submissions) AS total_submissions,
  (SELECT COUNT(*) FROM submissions WHERE status = 'new') AS new_submissions,
  DATE((SELECT MIN(created_at) FROM contacts)) AS first_contact,
  DATE((SELECT MAX(created_at) FROM contacts)) AS last_contact;

INSERT OR IGNORE INTO forms (id, name, description, schema, email_template_key, notify_template_key, created_at, updated_at)
VALUES
  ('signup', 'Signup', 'Simple email signup form', '{"required":["email"],"fields":["email","name","source"]}', 'welcome', 'internal-notification', datetime('now'), datetime('now')),
  ('lead', 'Lead form', 'General web lead form', '{"required":["email","message"],"fields":["email","name","organization","message","source"]}', 'lead-confirmation', 'internal-notification', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO email_templates (key, channel, name, body, updated_at)
VALUES
  ('welcome', 'subject', 'Welcome subject', 'Welcome to {{appName}}', datetime('now')),
  ('welcome', 'html', 'Welcome HTML', '<h1>You are on the list.</h1><p>Thanks{{namePhrase}}. We will follow up soon.</p><p><a href="{{baseUrl}}">Visit {{appName}}</a></p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>', datetime('now')),
  ('welcome', 'text', 'Welcome text', 'Welcome to {{appName}}.\n\nThanks{{namePhrase}}. We will follow up soon.\n\nSite: {{baseUrl}}\nUnsubscribe: {{unsubscribeUrl}}', datetime('now')),
  ('lead-confirmation', 'subject', 'Lead confirmation subject', 'We received your note', datetime('now')),
  ('lead-confirmation', 'html', 'Lead confirmation HTML', '<h1>Your note is in.</h1><p>Thanks{{namePhrase}}. We received your message and will follow up with the next practical step.</p><p><a href="{{baseUrl}}">Visit {{appName}}</a></p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>', datetime('now')),
  ('lead-confirmation', 'text', 'Lead confirmation text', 'Your note is in.\n\nThanks{{namePhrase}}. We received your message and will follow up with the next practical step.\n\nSite: {{baseUrl}}\nUnsubscribe: {{unsubscribeUrl}}', datetime('now')),
  ('internal-notification', 'subject', 'Internal notification subject', 'New {{formId}} lead from {{email}}', datetime('now')),
  ('internal-notification', 'html', 'Internal notification HTML', '<h1>New {{formId}} lead</h1><p><strong>Email:</strong> {{email}}</p><p><strong>Name:</strong> {{name}}</p><pre>{{dataSummary}}</pre>', datetime('now')),
  ('internal-notification', 'text', 'Internal notification text', 'New {{formId}} lead\n\nEmail: {{email}}\nName: {{name}}\n\n{{dataSummary}}', datetime('now')),
  ('test-email', 'subject', 'Test email subject', '{{appName}} test email', datetime('now')),
  ('test-email', 'html', 'Test email HTML', '<h1>{{appName}} test email</h1><p>If you received this, Resend is configured.</p>', datetime('now')),
  ('test-email', 'text', 'Test email text', '{{appName}} test email\n\nIf you received this, Resend is configured.', datetime('now'));
