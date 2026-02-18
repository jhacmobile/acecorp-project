-- PHILGAS ENTERPRISE MASTER PRODUCT IMPORT
-- Source: Provided CSV Data
-- Target: products, brands, categories, stocks

DO $$ 
DECLARE 
    store_record RECORD;
BEGIN 
    -- 1. Create temporary staging table
    CREATE TEMP TABLE csv_staging (
        name TEXT,
        brand TEXT,
        type TEXT,
        price NUMERIC,
        size TEXT
    );

    -- 2. Insert Data from CSV (Mapping columns as requested)
    INSERT INTO csv_staging (name, brand, type, price, size) VALUES
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
    ('Rubber', 'Generic', 'Spare Parts', 20, 'N/A'),
    ('Hose With Clamp', 'Generic', 'Spare Parts', 1, 'N/A'),
    ('Reca (Snap-On)', 'Reca', 'Spare Parts', 1, 'N/A'),
    ('TPA (Snap-On)', 'TPA', 'Spare Parts', 550, 'N/A'),
    ('Sungas (Pol-Valve)', 'Sungas', 'Spare Parts', 350, 'N/A'),
    ('Regulator', 'Generic', 'Spare Parts', 350, 'N/A'),
    ('Total Gas,Pol-Valve,50', 'Total Gas', 'Refill', 1, '50KG'),
    ('Gasul,Pol-Valve,50', 'Gasul', 'Refill', 1, '50KG'),
    ('Solane,Pol-Valve,50', 'Solane', 'Refill', 1, '50KG'),
    ('Philgas,Pol-Valve,50', 'Philgas', 'Refill', 3300, '50KG'),
    ('Total Gas,Pol-Valve,22', 'Total Gas', 'Refill', 1, '22KG'),
    ('Gasul,Pol-Valve,22', 'Gasul', 'Refill', 1, '22KG'),
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

    -- 3. Synchronize Brands Registry
    TRUNCATE TABLE brands CASCADE;
    INSERT INTO brands (id, name)
    SELECT row_number() OVER ()::TEXT, brand 
    FROM (SELECT DISTINCT brand FROM csv_staging) b;

    -- 4. Synchronize Categories (Product Types) Registry
    TRUNCATE TABLE categories CASCADE;
    INSERT INTO categories (id, name)
    SELECT row_number() OVER ()::TEXT, type 
    FROM (SELECT DISTINCT type FROM csv_staging) t;

    -- 5. Populate Master Product Catalog
    TRUNCATE TABLE products CASCADE;
    INSERT INTO products (id, name, brand, type, size, price, status)
    SELECT row_number() OVER ()::TEXT, name, brand, type, size, price, 'Active'
    FROM csv_staging;

    -- 6. Initialize Inventory Stocks for ALL Stores
    -- This ensures that these products appear in every store's POS terminal immediately.
    TRUNCATE TABLE stocks CASCADE;
    FOR store_record IN SELECT id FROM stores LOOP
        INSERT INTO stocks (id, product_id, store_id, quantity, initial_stock, status)
        SELECT 
            (store_record.id || '-' || id)::TEXT,
            id, 
            store_record.id, 
            0, -- Default quantity is 0 (Ready for manual enrollment/delivery)
            0,
            'Active'
        FROM products;
    END LOOP;

    -- 7. Cleanup
    DROP TABLE csv_staging;

    RAISE NOTICE 'Master Product Sync Successful. Inventory initialized for all nodes.';
END $$;