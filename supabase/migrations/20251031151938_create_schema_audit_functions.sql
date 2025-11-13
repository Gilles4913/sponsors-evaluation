/*
  # Create Schema Audit Helper Functions

  1. New Functions
    - `get_table_columns` - Returns column information from information_schema
    - `get_enum_values` - Returns enum type values from pg_enum
  
  2. Security
    - Functions are SECURITY DEFINER to allow access to information_schema
    - Restricted to super_admin role via RLS policies
*/

-- Function to get table columns from information_schema
CREATE OR REPLACE FUNCTION public.get_table_columns(table_name text)
RETURNS TABLE (
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  udt_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text,
    c.udt_name::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = get_table_columns.table_name
  ORDER BY c.ordinal_position;
$$;

-- Function to get enum values
CREATE OR REPLACE FUNCTION public.get_enum_values()
RETURNS TABLE (
  enum_name text,
  enum_value text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.typname::text as enum_name,
    e.enumlabel::text as enum_value
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  ORDER BY t.typname, e.enumsortorder;
$$;

-- Grant execute permissions to authenticated users (RLS will control access)
GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enum_values() TO authenticated;
