/*
  # Add widget_layouts table for cross-device dashboard persistence

  ## Summary
  Stores per-user dashboard widget order in Supabase so layouts
  survive browser clears and work across devices.

  ## New Tables
  - `widget_layouts`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK to auth.users)
    - `layout_key` (text) - e.g. "dashboard-widgets"
    - `widget_order` (jsonb) - ordered array of widget IDs
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only read/write their own layouts
*/

CREATE TABLE IF NOT EXISTS widget_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  layout_key text NOT NULL DEFAULT 'dashboard-widgets',
  widget_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, layout_key)
);

ALTER TABLE widget_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own widget layouts"
  ON widget_layouts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own widget layouts"
  ON widget_layouts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own widget layouts"
  ON widget_layouts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own widget layouts"
  ON widget_layouts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_widget_layouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER widget_layouts_updated_at
  BEFORE UPDATE ON widget_layouts
  FOR EACH ROW EXECUTE FUNCTION update_widget_layouts_updated_at();
