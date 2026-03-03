# Supabase RLS Policy Documentation

## #5: Row Level Security (RLS) Policy Checks

This document describes the expected RLS policies for the ImmoControl database.
All tables should have RLS enabled with policies restricting access to the authenticated user's own data.

### Required Policies per Table

#### `properties`
- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id`
- **DELETE**: `auth.uid() = user_id`

#### `tenants`
- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id`
- **DELETE**: `auth.uid() = user_id`

#### `contacts`
- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id`
- **DELETE**: `auth.uid() = user_id`

#### `loans`
- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id`
- **DELETE**: `auth.uid() = user_id`

#### `payments`
- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id`
- **DELETE**: `auth.uid() = user_id`

#### `todos`
- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id`
- **DELETE**: `auth.uid() = user_id`

#### `tickets`
- **SELECT**: `auth.uid() = user_id OR auth.uid() = assigned_to`
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id OR auth.uid() = assigned_to`
- **DELETE**: `auth.uid() = user_id`

#### `documents`
- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id`
- **DELETE**: `auth.uid() = user_id`

#### `notes`
- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id`
- **DELETE**: `auth.uid() = user_id`

#### `deals`
- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id`
- **DELETE**: `auth.uid() = user_id`

#### `profiles`
- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id`
- Profiles should not be deletable via client

#### `nebenkosten`
- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id`
- **DELETE**: `auth.uid() = user_id`

### Team/Shared Access Policies

For team features (co-investors, shared properties):
- **Shared properties**: Access via `team_members` join table
- **SELECT**: `auth.uid() = user_id OR EXISTS(SELECT 1 FROM team_members WHERE team_members.user_id = auth.uid() AND team_members.owner_id = properties.user_id)`
- **INSERT/UPDATE/DELETE**: Only the owner (`auth.uid() = user_id`)

### Tenant Portal Policies

For tenant-facing features:
- Tenants can only see their own data via `tenant_users` table
- **SELECT on payments**: `tenant_id IN (SELECT id FROM tenants WHERE email = auth.email())`
- **SELECT on tickets**: `tenant_id IN (SELECT id FROM tenants WHERE email = auth.email())`

### Verification Checklist

- [ ] All tables have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] All tables have at least SELECT/INSERT/UPDATE policies
- [ ] No table allows unrestricted access
- [ ] Team sharing uses explicit join table, not relaxed policies
- [ ] Storage buckets have RLS policies matching document ownership
- [ ] Edge functions validate user identity before data access
