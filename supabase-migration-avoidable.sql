-- Migration: add is_avoidable flag to transactions
-- Run this in the Supabase SQL editor

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_avoidable boolean DEFAULT false;
