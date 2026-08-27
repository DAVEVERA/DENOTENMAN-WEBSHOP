-- Add VModel as an additive Design Studio provider. Existing jobs and assets stay unchanged.
ALTER TYPE "DesignProvider" ADD VALUE IF NOT EXISTS 'VMODEL';
