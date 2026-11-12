-- CivicCircle seed data placeholder
-- Run against a configured Supabase project to seed initial data.
-- No schema definitions here — migrations handle schema.

INSERT INTO cities (slug, name, region) VALUES
  ('general', 'General', 'City-wide'),
  ('ask-civiccircle', 'Ask CivicCircle', 'Q&A'),
  ('food-dining', 'Food & Dining', 'Restaurants'),
  ('jobs-careers', 'Jobs & Careers', 'Employment'),
  ('housing-rent', 'Housing & Rent', 'Real Estate'),
  ('events', 'Events', 'Local Events'),
  ('marketplace', 'Marketplace', 'Buy & Sell'),
  ('recommendations', 'Recommendations', 'Tips'),
  ('tech-startups', 'Tech & Startups', 'Technology'),
  ('fitness-health', 'Fitness & Health', 'Wellness'),
  ('travel', 'Travel', 'Tourism'),
  ('local-news', 'Local News', 'News')
ON CONFLICT (slug) DO NOTHING;
