
-- ACECORP ENTERPRISE INVENTORY INITIALIZATION (V1.3.7)
-- This script performs a clean sync of Brands, Categories, and Products.

DO $$ 
DECLARE 
    store_record RECORD;
BEGIN 
    -- 0. PRE-SYNC SCHEMA CHECK: Ensure 'stocks' table has 'id' column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stocks' AND column_name='id') THEN
        ALTER TABLE stocks ADD COLUMN id TEXT;
    END IF;

    -- Ensure 'products' table has 'size' column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='size') THEN
        ALTER TABLE products ADD COLUMN size TEXT DEFAULT 'N/A';
    END IF;

    -- 1. Create temporary table to hold the data for processing
    CREATE TEMP TABLE temp_product_import (
        name TEXT,
        brand TEXT,
        type TEXT,
        price NUMERIC,
        size TEXT
    );

    -- 2. Insert the Master Product list
    INSERT INTO temp_product_import (name, brand, type, price, size) VALUES
    ('Philkalan,2.7-Emp', 'Philgas', 'Empty Cylinders', 0, '2.7KG'),
    ('Philgas,Pol-Valve,11-Emp', 'Philgas', 'Empty Cylinders', 0, '11KG'),
    ('Total Gas,Pol-Valve,50-Emp', 'Total Gas', 'Empty Cylinders', 0, '50KG'),
    ('Gasul,Pol-Valve,50-Emp', 'Gasul', 'Empty Cylinders', 0, '50KG'),
    ('Solane,Pol-Valve,50-Emp', 'Solane', 'Empty Cylinders', 0, '50KG'),
    ('Philgas,Pol-Valve,50-Emp', 'Philgas', 'Empty Cylinders', 0, '50KG'),
    ('Total Gas,Pol-Valve,22-Emp', 'Total Gas', 'Empty Cylinders', 0, '22KG'),
    ('Gasul,Pol-Valve,22-Emp', 'Gasul', 'Empty Cylinders', 0, '22KG'),
    ('Philgas,Pol-Valve,22-Emp', 'Philgas', 'Empty Cylinders', 0, '22KG'),
    ('Gasulette,2.7-Emp', 'Gasul', 'Empty Cylinders', 0, '2.7KG'),
    ('Philkalan,2.7-Cyl', 'Philgas', 'Cylinders', 930, '2.7KG'),
    ('Liquigas,2.7-Emp', 'Liquigas', 'Empty Cylinders', 0, '2.7KG'),
    ('Shine Gas,2.7-Emp', 'Shine Gas', 'Empty Cylinders', 0, '2.7KG'),
    ('Super Kalan,2.7-Emp', 'Super Kalan', 'Empty Cylinders', 0, '2.7KG'),
    ('Total Gas,Snap-On,11-Emp', 'Total Gas', 'Empty Cylinders', 0, '11KG'),
    ('Fiesta Gas,Snap-On,11-Emp', 'Fiesta', 'Empty Cylinders', 0, '11KG'),
    ('Gasul,Snap-On,11-Emp', 'Gasul', 'Empty Cylinders', 0, '11KG'),
    ('Solane,Snap-On,11-Emp', 'Solane', 'Empty Cylinders', 0, '11KG'),
    ('Liquigas,Pol-Valve,11-Emp', 'Liquigas', 'Empty Cylinders', 0, '11KG'),
    ('Fiesta Gas,Pol-Valve,11-Emp', 'Fiesta', 'Empty Cylinders', 0, '11KG'),
    ('Gasul,Pol-Valve,11-Emp', 'Gasul', 'Empty Cylinders', 0, '11KG'),
    ('Total Gas,Pol-Valve,11-Emp', 'Total Gas', 'Empty Cylinders', 0, '11KG'),
    ('Solane,Pol-Valve,11-Emp', 'Solane', 'Empty Cylinders', 0, '11KG'),
    ('Philgas,Pol-Valve,11-Cyl', 'Philgas', 'Cylinders', 1870, '11KG'),
    ('Rubber Seal', 'Generic', 'Spare Parts', 20, 'N/A'),
    ('Hose With Clamp', 'Generic', 'Spare Parts', 450, 'N/A'),
    ('Reca (Snap-On)', 'Reca', 'Spare Parts', 450, 'N/A'),
    ('TPA (Snap-On)', 'TPA', 'Spare Parts', 550, 'N/A'),
    ('Sungas (Pol-Valve)', 'Sungas', 'Spare Parts', 350, 'N/A'),
    ('Regulator', 'Generic', 'Spare Parts', 350, 'N/A'),
    ('Total Gas,Pol-Valve,50', 'Total Gas', 'Refill', 3300, '50KG'),
    ('Gasul,Pol-Valve,50', 'Gasul', 'Refill', 3300, '50KG'),
    ('Solane,Pol-Valve,50', 'Solane', 'Refill', 3300, '50KG'),
    ('Philgas,Pol-Valve,50', 'Philgas', 'Refill', 3300, '50KG'),
    ('Total Gas,Pol-Valve,22', 'Total Gas', 'Refill', 1300, '22KG'),
    ('Gasul,Pol-Valve,22', 'Gasul', 'Refill', 1300, '22KG'),
    ('Philgas,Pol-Valve,22', 'Philgas', 'Refill', 1300, '22KG'),
    ('Gasulette,2.7', 'Gasul', 'Refill', 225, '2.7KG'),
    ('Philkalan,2.7', 'Philgas', 'Refill', 220, '2.7KG'),
    ('Liquigas,2.7', 'Liquigas', 'Refill', 220, '2.7KG'),
    ('Shine Gas,2.7', 'Shine Gas', 'Refill', 220, '2.7KG'),
    ('Super Kalan,2.7', 'Super Kalan', 'Refill', 220, '2.7KG'),
    ('Total Gas,Snap-On,11', 'Total Gas', 'Refill', 690, '11KG'),
    ('Fiesta Gas,Snap-On,11', 'Fiesta', 'Refill', 690, '11KG'),
    ('Gasul,Snap-On,11', 'Gasul', 'Refill', 690, '11KG'),
    ('Solane,Snap-On,11', 'Solane', 'Refill', 690, '11KG'),
    ('Liquigas,Pol-Valve,11', 'Liquigas', 'Refill', 690, '11KG'),
    ('Fiesta Gas,Pol-Valve,11', 'Fiesta', 'Refill', 690, '11KG'),
    ('Gasul,Pol-Valve,11', 'Gasul', 'Refill', 690, '11KG'),
    ('Total Gas,Pol-Valve,11', 'Total Gas', 'Refill', 690, '11KG'),
    ('Solane,Pol-Valve,11', 'Solane', 'Refill', 690, '11KG'),
    ('Philgas,Pol-Valve,11', 'Philgas', 'Refill', 630, '11KG');

    -- 3. Synchronize Brands
    TRUNCATE TABLE brands CASCADE;
    INSERT INTO brands (id, name)
    SELECT row_number() OVER ()::TEXT, brand 
    FROM (SELECT DISTINCT brand FROM temp_product_import) sub;

    -- 4. Synchronize Categories (Product Types)
    TRUNCATE TABLE categories CASCADE;
    INSERT INTO categories (id, name)
    SELECT row_number() OVER ()::TEXT, type 
    FROM (SELECT DISTINCT type FROM temp_product_import) sub;

    -- 5. Populate Master Product Registry
    TRUNCATE TABLE products CASCADE;
    INSERT INTO products (id, name, brand, type, size, price, status)
    SELECT row_number() OVER ()::TEXT, name, brand, type, size, price, 'Active'
    FROM temp_product_import;

    -- 6. Initialize Store Inventory (Populate Stocks for all existing stores)
    TRUNCATE TABLE stocks CASCADE;
    FOR store_record IN SELECT id FROM stores LOOP
        INSERT INTO stocks (id, product_id, store_id, quantity, initial_stock)
        SELECT 
            (store_record.id || '-' || id)::TEXT,
            id, 
            store_record.id, 
            10, -- Default initial stock level
            10
        FROM products;
    END LOOP;

    -- 7. Cleanup
    DROP TABLE temp_product_import;
END $$;
