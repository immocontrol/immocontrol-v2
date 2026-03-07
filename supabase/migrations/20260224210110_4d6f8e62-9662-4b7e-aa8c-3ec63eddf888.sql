
-- Properties table
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ETW',
  units INTEGER NOT NULL DEFAULT 1,
  purchase_price NUMERIC NOT NULL,
  purchase_date DATE NOT NULL,
  current_value NUMERIC NOT NULL,
  monthly_rent NUMERIC NOT NULL DEFAULT 0,
  monthly_expenses NUMERIC NOT NULL DEFAULT 0,
  monthly_credit_rate NUMERIC NOT NULL DEFAULT 0,
  monthly_cashflow NUMERIC NOT NULL DEFAULT 0,
  remaining_debt NUMERIC NOT NULL DEFAULT 0,
  interest_rate NUMERIC NOT NULL DEFAULT 0,
  sqm NUMERIC NOT NULL DEFAULT 0,
  year_built INTEGER NOT NULL DEFAULT 1970,
  ownership TEXT NOT NULL DEFAULT 'privat',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own properties" ON public.properties FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own properties" ON public.properties FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own properties" ON public.properties FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own properties" ON public.properties FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('property-documents', 'property-documents', false);
CREATE POLICY "Users can upload property documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own property documents" ON storage.objects FOR SELECT USING (bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own property documents" ON storage.objects FOR DELETE USING (bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Property documents table
CREATE TABLE public.property_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_type TEXT,
  category TEXT NOT NULL DEFAULT 'Sonstiges',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own documents" ON public.property_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON public.property_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.property_documents FOR DELETE USING (auth.uid() = user_id);

-- Property notes
CREATE TABLE public.property_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.property_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notes" ON public.property_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON public.property_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.property_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.property_notes FOR DELETE USING (auth.uid() = user_id);

-- Role enum
CREATE TYPE public.app_role AS ENUM ('landlord', 'tenant', 'handworker');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Landlords can manage roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'landlord'));

-- Tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  unit_label TEXT DEFAULT '',
  move_in_date DATE,
  move_out_date DATE,
  monthly_rent NUMERIC DEFAULT 0,
  deposit NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  invitation_token TEXT UNIQUE,
  invitation_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlords can manage own tenants" ON public.tenants FOR ALL USING (auth.uid() = landlord_id);
CREATE POLICY "Tenants can view own record" ON public.tenants FOR SELECT USING (auth.uid() = user_id);
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  category TEXT NOT NULL DEFAULT 'Sonstiges',
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own contacts" ON public.contacts FOR ALL USING (auth.uid() = user_id);

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role app_role NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_tenant_landlord(_tenant_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT landlord_id FROM public.tenants WHERE id = _tenant_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_message_participant(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND (landlord_id = _user_id OR user_id = _user_id))
$$;

CREATE POLICY "Participants can view messages" ON public.messages FOR SELECT USING (public.is_message_participant(auth.uid(), tenant_id));
CREATE POLICY "Participants can send messages" ON public.messages FOR INSERT WITH CHECK (public.is_message_participant(auth.uid(), tenant_id) AND auth.uid() = sender_id);
CREATE POLICY "Recipients can mark as read" ON public.messages FOR UPDATE USING (public.is_message_participant(auth.uid(), tenant_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'landlord');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- Tickets
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.ticket_category AS ENUM ('repair', 'damage', 'maintenance', 'question', 'other', 'documents');

CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category public.ticket_category NOT NULL DEFAULT 'other',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  status public.ticket_status NOT NULL DEFAULT 'open',
  landlord_note TEXT,
  assigned_to_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_to_user_id UUID DEFAULT NULL,
  handworker_note TEXT DEFAULT NULL,
  estimated_cost NUMERIC DEFAULT 0,
  actual_cost NUMERIC DEFAULT 0,
  cost_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can create own tickets" ON public.tickets FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id AND user_id = auth.uid()));
CREATE POLICY "Tenants can view own tickets" ON public.tickets FOR SELECT USING (EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id AND user_id = auth.uid()) OR auth.uid() = landlord_id);
CREATE POLICY "Landlords can update own tickets" ON public.tickets FOR UPDATE USING (auth.uid() = landlord_id);
CREATE POLICY "Landlords can delete own tickets" ON public.tickets FOR DELETE USING (auth.uid() = landlord_id);
CREATE POLICY "Handworkers can view assigned tickets" ON public.tickets FOR SELECT USING (auth.uid() = assigned_to_user_id);
CREATE POLICY "Handworkers can update assigned tickets" ON public.tickets FOR UPDATE USING (auth.uid() = assigned_to_user_id);

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;

-- Payment status
CREATE TYPE public.payment_status AS ENUM ('pending', 'confirmed', 'overdue', 'cancelled');

CREATE TABLE public.rent_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status public.payment_status NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlords can manage own payments" ON public.rent_payments FOR ALL USING (auth.uid() = landlord_id);
CREATE POLICY "Tenants can view own payments" ON public.rent_payments FOR SELECT USING (EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id AND user_id = auth.uid()));
CREATE TRIGGER update_rent_payments_updated_at BEFORE UPDATE ON public.rent_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tenant document access
CREATE POLICY "Tenants can view property documents" ON public.property_documents FOR SELECT USING (EXISTS (SELECT 1 FROM public.tenants WHERE tenants.property_id = property_documents.property_id AND tenants.user_id = auth.uid() AND tenants.is_active = true));
CREATE POLICY "Tenants can download property documents" ON storage.objects FOR SELECT USING (bucket_id = 'property-documents' AND EXISTS (SELECT 1 FROM public.tenants t JOIN public.property_documents pd ON pd.property_id = t.property_id WHERE t.user_id = auth.uid() AND t.is_active = true AND pd.file_path = name));

-- Team members
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  member_user_id UUID,
  member_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'pending',
  invitation_token TEXT DEFAULT md5(gen_random_uuid()::text || random()::text),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(owner_id, member_email)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage team" ON public.team_members FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Members can view own invitations" ON public.team_members FOR SELECT USING (auth.uid() = member_user_id);
CREATE POLICY "Members can accept invitations" ON public.team_members FOR UPDATE USING (auth.uid() = member_user_id);
CREATE POLICY "Members can view invitations by email" ON public.team_members FOR SELECT USING (auth.jwt() ->> 'email' = member_email AND status = 'pending');
CREATE POLICY "Members can accept invitations by email" ON public.team_members FOR UPDATE USING (auth.jwt() ->> 'email' = member_email AND status = 'pending');
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Loans table
CREATE TABLE public.loans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL DEFAULT '',
  loan_amount NUMERIC NOT NULL DEFAULT 0,
  remaining_balance NUMERIC NOT NULL DEFAULT 0,
  interest_rate NUMERIC NOT NULL DEFAULT 0,
  repayment_rate NUMERIC NOT NULL DEFAULT 0,
  monthly_payment NUMERIC NOT NULL DEFAULT 0,
  fixed_interest_until DATE,
  start_date DATE,
  end_date DATE,
  loan_type TEXT NOT NULL DEFAULT 'annuity',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own loans" ON public.loans FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User banks
CREATE TABLE public.user_banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
ALTER TABLE public.user_banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own banks" ON public.user_banks FOR ALL USING (auth.uid() = user_id);

-- Property value history
CREATE TABLE IF NOT EXISTS property_value_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE property_value_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own value history" ON property_value_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own value history" ON property_value_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own value history" ON property_value_history FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_value_history_property ON property_value_history(property_id);

-- Portfolio goals
CREATE TABLE IF NOT EXISTS portfolio_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'value',
  target NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC NOT NULL DEFAULT 0,
  deadline DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE portfolio_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own goals" ON portfolio_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON portfolio_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON portfolio_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON portfolio_goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Maintenance items
CREATE TABLE IF NOT EXISTS maintenance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Sonstiges',
  priority TEXT NOT NULL DEFAULT 'medium',
  estimated_cost NUMERIC NOT NULL DEFAULT 0,
  planned_date DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE maintenance_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own maintenance items" ON maintenance_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own maintenance items" ON maintenance_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own maintenance items" ON maintenance_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own maintenance items" ON maintenance_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Insurances
CREATE TABLE IF NOT EXISTS property_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'Gebäudeversicherung',
  provider TEXT NOT NULL DEFAULT '',
  annual_premium NUMERIC NOT NULL DEFAULT 0,
  renewal_date DATE,
  policy_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE property_insurances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own insurances" ON property_insurances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own insurances" ON property_insurances FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own insurances" ON property_insurances FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own insurances" ON property_insurances FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Todos
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  due_date DATE,
  due_time TIME,
  priority INTEGER NOT NULL DEFAULT 4,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  project TEXT NOT NULL DEFAULT '',
  labels TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own todos" ON todos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own todos" ON todos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own todos" ON todos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own todos" ON todos FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Document expiries
CREATE TABLE IF NOT EXISTS document_expiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE document_expiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own document expiries" ON document_expiries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own document expiries" ON document_expiries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own document expiries" ON document_expiries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own document expiries" ON document_expiries FOR DELETE TO authenticated USING (auth.uid() = user_id);
