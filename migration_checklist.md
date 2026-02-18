
# AceCorp Database Migration Checklist

Follow these steps to move from your old Supabase account to the new one:

## 1. Export Data (Old Account)
- [ ] Log in to Old Supabase Dashboard.
- [ ] Go to **Table Editor**.
- [ ] For each of these, export as CSV: `products`, `brands`, `categories`, `employees`, `customers`, `stores`.
- [ ] (Optional) Export `orders` and `payroll_history` if you need past data.
- [ ] Download current `logo_url` image from Storage bucket `assets`.

## 2. Initialize (New Account)
- [ ] Create a new Supabase Project.
- [ ] Open **SQL Editor**.
- [ ] Copy and run the entire content of `full_system_setup.sql`.
- [ ] Go to **Storage**, create a public bucket named `assets`.
- [ ] Upload your logo image to the `assets` bucket.

## 3. Import Data (New Account)
- [ ] Go to **Table Editor**.
- [ ] Import CSVs in this order to respect dependencies:
    1. `brands`
    2. `categories`
    3. `products`
    4. `stores`
    5. `stocks`
    6. `employees`
    7. `customers`
    8. `orders`

## 4. Connect App
- [ ] Copy the new **Project URL** and **Anon Key** from Project Settings -> API.
- [ ] Update your hosting platform's environment variables OR edit `NEW_PROJECT_URL` and `NEW_PROJECT_KEY` in `supabaseClient.ts`.
- [ ] Re-deploy/Refresh your application.

## 5. Verification
- [ ] Log in to the application.
- [ ] Check if `Inventory Hub` shows products.
- [ ] Check if `HR Hub` shows employees.
- [ ] Perform a test "Draft" order in the `Terminal`.
