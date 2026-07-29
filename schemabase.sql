-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.subsidiaries (
  subsidiary_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text,
  code text,
  created_at timestamp with time zone,
  CONSTRAINT subsidiaries_pkey PRIMARY KEY (subsidiary_id)
);
CREATE TABLE public.suppliers (
  supplier_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  supplier_name text,
  contact_person text,
  contact_number text,
  email text,
  address text,
  CONSTRAINT suppliers_pkey PRIMARY KEY (supplier_id)
);
CREATE TABLE public.products (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  product_sku text,
  description text,
  category text,
  unit text,
  created_at timestamp with time zone,
  sub_category character varying,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.branches (
  branch_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  subsidiary_id bigint,
  name text,
  address text,
  status text,
  created_at timestamp with time zone,
  CONSTRAINT branches_pkey PRIMARY KEY (branch_id),
  CONSTRAINT fk_branches_subsidiary FOREIGN KEY (subsidiary_id) REFERENCES public.subsidiaries(subsidiary_id)
);
CREATE TABLE public.users (
  user_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  username text,
  password text,
  name text,
  role text,
  branch_id bigint,
  created_at timestamp with time zone,
  auth_id uuid,
  email text,
  CONSTRAINT users_pkey PRIMARY KEY (user_id),
  CONSTRAINT users_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES auth.users(id),
  CONSTRAINT fk_users_branch FOREIGN KEY (branch_id) REFERENCES public.branches(branch_id)
);
CREATE TABLE public.inventory (
  inventory_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  product_id bigint,
  location text,
  stock_qty double precision,
  last_updated timestamp with time zone,
  CONSTRAINT inventory_pkey PRIMARY KEY (inventory_id),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.purchase_requests (
  pr_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  pr_no text,
  requested_by bigint,
  date_needed text,
  date_received text,
  priority text,
  justification text,
  notes text,
  status text,
  created_at timestamp with time zone,
  CONSTRAINT purchase_requests_pkey PRIMARY KEY (pr_id),
  CONSTRAINT fk_pr_requester FOREIGN KEY (requested_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.requests (
  request_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  reference_no text,
  branch_id bigint,
  subsidiary_id bigint,
  requested_by bigint,
  status text,
  remarks text,
  expected_delivery text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  date_received text,
  CONSTRAINT requests_pkey PRIMARY KEY (request_id),
  CONSTRAINT fk_requests_branch FOREIGN KEY (branch_id) REFERENCES public.branches(branch_id),
  CONSTRAINT fk_requests_subsidiary FOREIGN KEY (subsidiary_id) REFERENCES public.subsidiaries(subsidiary_id),
  CONSTRAINT fk_requests_user FOREIGN KEY (requested_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.branch_inventory (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  branch_id bigint,
  product_id bigint,
  stock_qty double precision,
  last_updated timestamp with time zone,
  CONSTRAINT branch_inventory_pkey PRIMARY KEY (id),
  CONSTRAINT fk_bi_branch FOREIGN KEY (branch_id) REFERENCES public.branches(branch_id),
  CONSTRAINT fk_bi_product FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.inventory_batches (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  product_id bigint,
  quantity double precision,
  cost double precision,
  expiry_date text,
  date_received timestamp with time zone,
  reference_no text,
  created_at timestamp with time zone,
  CONSTRAINT inventory_batches_pkey PRIMARY KEY (id),
  CONSTRAINT fk_batches_product FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.purchase_orders (
  po_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  po_number text,
  supplier_id bigint,
  pr_id bigint,
  total_amount real,
  status text,
  created_at timestamp with time zone,
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (po_id),
  CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES public.suppliers(supplier_id),
  CONSTRAINT fk_po_pr FOREIGN KEY (pr_id) REFERENCES public.purchase_requests(pr_id)
);
CREATE TABLE public.request_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  request_id bigint,
  product_id bigint,
  quantity double precision,
  unit text,
  supplied_qty double precision,
  received_qty double precision,
  commi_price real,
  CONSTRAINT request_items_pkey PRIMARY KEY (id),
  CONSTRAINT fk_req_items_request FOREIGN KEY (request_id) REFERENCES public.requests(request_id),
  CONSTRAINT fk_req_items_product FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.inventory_logs (
  log_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  product_id bigint,
  action_type text,
  quantity double precision,
  reference_no text,
  user_id bigint,
  remarks text,
  created_at timestamp with time zone,
  CONSTRAINT inventory_logs_pkey PRIMARY KEY (log_id),
  CONSTRAINT fk_inv_logs_product FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT fk_inv_logs_user FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.inventory_branch_logs (
  branch_log_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  stock_code text,
  subsidiary_id bigint,
  branch_id bigint,
  product_id bigint,
  action_type text,
  quantity double precision,
  commi_price real,
  reason text,
  reference_no text,
  user_id bigint,
  remarks text,
  created_at timestamp with time zone,
  CONSTRAINT inventory_branch_logs_pkey PRIMARY KEY (branch_log_id),
  CONSTRAINT fk_logs_subsidiary FOREIGN KEY (subsidiary_id) REFERENCES public.subsidiaries(subsidiary_id),
  CONSTRAINT fk_logs_branch FOREIGN KEY (branch_id) REFERENCES public.branches(branch_id),
  CONSTRAINT fk_logs_product FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.purchase_order_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  po_id bigint,
  product_id bigint,
  quantity double precision,
  unit_price real,
  total_price real,
  received_qty double precision,
  expiry_date text,
  quality_rating text,
  CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT fk_po_items_po FOREIGN KEY (po_id) REFERENCES public.purchase_orders(po_id),
  CONSTRAINT fk_po_items_product FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.purchase_request_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  pr_id bigint,
  product_id bigint,
  quantity double precision,
  unit text,
  fulfilled_qty double precision,
  CONSTRAINT purchase_request_items_pkey PRIMARY KEY (id),
  CONSTRAINT fk_pr_items_pr FOREIGN KEY (pr_id) REFERENCES public.purchase_requests(pr_id),
  CONSTRAINT fk_pr_items_product FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.branch_inventory_batches (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  branch_id bigint,
  product_id bigint,
  quantity double precision,
  commi_price real,
  date_received timestamp with time zone,
  reference_no text,
  created_at timestamp with time zone,
  stocked_out_qty double precision,
  CONSTRAINT branch_inventory_batches_pkey PRIMARY KEY (id)
);
CREATE TABLE public.inventory_daily_reports (
  report_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  report_date text,
  product_id bigint,
  beginning_qty double precision,
  stock_in double precision,
  stock_out double precision,
  ending_qty double precision,
  created_at timestamp with time zone,
  actual_sold double precision,
  actual_stock double precision,
  expected_ending_qty double precision,
  variance double precision,
  status text DEFAULT 'draft'::text,
  remarks text,
  branch_id bigint,
  CONSTRAINT inventory_daily_reports_pkey PRIMARY KEY (report_id)
);
CREATE TABLE public.fulfillment_transactions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  request_id bigint,
  request_item_id bigint,
  product_id bigint,
  quantity double precision,
  status text,
  sent_date timestamp with time zone,
  sent_by_user_id bigint,
  received_date text,
  received_by_user_id bigint,
  commissary_remarks text,
  receiver_remarks text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  commi_price real DEFAULT 0,
  CONSTRAINT fulfillment_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_fulfill_request FOREIGN KEY (request_id) REFERENCES public.requests(request_id),
  CONSTRAINT fk_fulfill_req_item FOREIGN KEY (request_item_id) REFERENCES public.request_items(id),
  CONSTRAINT fk_fulfill_product FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT fk_fulfill_sender FOREIGN KEY (sent_by_user_id) REFERENCES public.users(user_id),
  CONSTRAINT fk_fulfill_receiver FOREIGN KEY (received_by_user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.notification_reads (
  id integer NOT NULL DEFAULT nextval('notification_reads_id_seq'::regclass),
  user_id integer NOT NULL,
  notification_type character varying NOT NULL,
  item_id integer NOT NULL,
  read_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notification_reads_pkey PRIMARY KEY (id)
);
CREATE TABLE public.login_attempts (
  id integer NOT NULL DEFAULT nextval('login_attempts_id_seq'::regclass),
  ip_address character varying NOT NULL,
  username character varying,
  success boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT login_attempts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.audit_logs (
  log_id integer NOT NULL DEFAULT nextval('audit_logs_log_id_seq'::regclass),
  user_id integer,
  action character varying NOT NULL,
  resource_type character varying NOT NULL,
  resource_id integer,
  old_values jsonb,
  new_values jsonb,
  ip_address character varying,
  user_agent text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (log_id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);