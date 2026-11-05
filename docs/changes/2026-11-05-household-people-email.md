# Household: household_people() returns email (migration 29)
- New migration `20261104000029_household_people_email.sql`: drop + recreate `household_people()` with an `email` column (Figma member rows; PRD: members see names and emails). Migration 28 is restored to the content applied on staging; applied migrations are not edited.
- Test: a member sees the owner's email. Local SQL check 126/126 (`bash tools/sql_local_test.sh`).
- Staging note: migrations 25-28 were found already applied on staging (versions 20261105052757..052950) before this session applied anything; counts unchanged (0 transactions, 4 wallets, 308 categories, 4 profiles, 57 policies).
